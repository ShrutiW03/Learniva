require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const quizAnswersCache = {};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// IMPROVED: Generate quiz with better error logging
app.get('/api/generate-quiz/:topic/:userId', async (req, res) => {
    const { topic, userId } = req.params;
    console.log(`Generating quiz for topic: "${topic}"...`);

    const prompt = `
        You are a quiz generator. Your task is to create a quiz with 5 multiple-choice questions on a specific topic.
        Topic: "${topic}"
        IMPORTANT: Format the output strictly as a JSON object. Do not include any text, explanation, or markdown formatting like \`\`\`json outside of the JSON object itself.
        The JSON object must have a single key "questions" which is an array of question objects.
        Each question object in the array must have "question_id" (a number), "question_text", "options" (an array of 4 objects with "option" and "text"), and "correct_option" (a capital letter like "A").
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiResponseContent = response.text().trim();

        // --- ADDED FOR DEBUGGING ---
        console.log("--- Raw Response from Google API ---");
        console.log(aiResponseContent);
        console.log("------------------------------------");
        // ---------------------------

        if (aiResponseContent.startsWith('```json')) {
            aiResponseContent = aiResponseContent.substring('```json\n'.length);
        }
        if (aiResponseContent.endsWith('```')) {
            aiResponseContent = aiResponseContent.slice(0, -3);
        }

        const quizData = JSON.parse(aiResponseContent.trim());

        if (!quizData.questions || quizData.questions.length === 0) {
            throw new Error('API did not return questions in the expected format.');
        }

        const answers = {};
        const questionsForClient = quizData.questions.map(q => {
            answers[q.question_id] = q.correct_option;
            const { correct_option, ...questionForClient } = q;
            return questionForClient;
        });
        
        quizAnswersCache[userId] = answers;
        setTimeout(() => { delete quizAnswersCache[userId]; }, 600000);

        res.json({ status: 'success', questions: questionsForClient });

    } catch (error) {
        console.error('--- ERROR IN QUIZ GENERATION ---');
        console.error(error);
        res.status(500).json({ status: 'error', message: "The API returned an invalid response. Check the server terminal for details." });
    }
});

// (The rest of your server.js file remains the same)
// ... your /api/quiz/submit, /save-course, /signup, /login, /my-courses routes ...
// Make sure you have the rest of the routes from the previous version here

// Submit quiz and generate course
app.post('/api/quiz/submit', async (req, res) => {
    const { userId, topic, answers, duration, learningGoals } = req.body;
    const correctAnswers = quizAnswersCache[userId];

    if (!correctAnswers) {
        return res.status(400).json({ status: 'error', message: 'Quiz session expired or not found. Please start again.' });
    }

    let score = 0;
    const questionIds = Object.keys(answers);
    questionIds.forEach(id => {
        if (answers[id] === correctAnswers[id]) {
            score++;
        }
    });

    delete quizAnswersCache[userId];

    const totalQuestions = questionIds.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    let determinedSkillLevel = 'Beginner';
    if (percentage > 75) determinedSkillLevel = 'Advanced';
    else if (percentage > 40) determinedSkillLevel = 'Intermediate';

    const coursePrompt = `You are an expert curriculum designer. Your task is to create a detailed course outline. Course Topic: "${topic}", Desired Duration: "${duration} weeks", Target Skill Level: "${determinedSkillLevel}", Specific Learning Goals: "${learningGoals}". Please generate a structured course outline in strict JSON format. The JSON object should have a "title" and a "modules" array. Each module must have "name", "description", "duration", "learningOutcomes" (an array of strings), and "resources" (an array of objects with "title", "type", and "url"). Do not include any text, explanation, or markdown formatting like \`\`\`json outside the JSON object itself.`;

    try {
        const result = await model.generateContent(coursePrompt);
        const response = await result.response;
        const aiResponseContent = response.text().trim().replace(/^```json\n|```$/g, '');
        const generatedCourse = JSON.parse(aiResponseContent);
        
        res.json({
            status: 'success',
            message: `Course generated based on quiz result! Determined Skill Level: ${determinedSkillLevel}`,
            determinedSkillLevel: determinedSkillLevel,
            generatedCourse: generatedCourse,
            receivedData: { topic, duration, skillLevel: determinedSkillLevel, learningGoals }
        });
    } catch (error) {
        console.error('Error calling Gemini API for course generation:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate course after quiz.' });
    }
});

// User auth and course saving routes
app.post('/save-course', async (req, res) => {
  console.log('Received request to save course for user:', req.body.userId);
  const { generatedCourse, topic, duration, skillLevel, learningGoals, userId } = req.body;
  if (!generatedCourse || !topic || !duration || !skillLevel || !learningGoals || !userId) {
    return res.status(400).json({ status: 'error', message: 'Missing required course data or user ID to save.' });
  }
  const generatedContentJson = JSON.stringify(generatedCourse);
  try {
    const [rows] = await pool.execute(
      `INSERT INTO courses (topic, duration, skill_level, learning_goals, generated_content, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [topic, duration, skillLevel, learningGoals, generatedContentJson, userId]
    );
    res.json({ status: 'success', message: 'Course saved successfully!', courseId: rows.insertId });
  } catch (error) {
    console.error('Error saving course to database:', error);
    res.status(500).json({ status: 'error', message: `Failed to save course: ${error.message}` });
  }
});

app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ status: 'error', message: 'Username and password are required.' });
    try {
        const [existingUser] = await pool.execute(`SELECT id FROM users WHERE username = ?`, [username]);
        if (existingUser.length > 0) return res.status(409).json({ status: 'error', message: 'Username already taken.' });
        const password_hash = await bcrypt.hash(password, 10);
        await pool.execute(`INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)`, [username, password_hash, email || null]);
        res.status(201).json({ status: 'success', message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: `Sign-up failed: ${error.message}` });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ status: 'error', message: 'Username and password are required.' });
    try {
        const [users] = await pool.execute(`SELECT id, username, password_hash FROM users WHERE username = ?`, [username]);
        if (users.length === 0) return res.status(401).json({ status: 'error', message: 'Invalid username or password.' });
        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) return res.status(401).json({ status: 'error', message: 'Invalid username or password.' });
        res.status(200).json({ status: 'success', message: 'Logged in successfully!', userId: user.id, username: user.username });
    } catch (error) {
        res.status(500).json({ status: 'error', message: `Login failed: ${error.message}` });
    }
});

app.get('/my-courses', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ status: 'error', message: 'User ID is required.' });
    try {
        const [courses] = await pool.execute(`SELECT id, topic, duration, skill_level, learning_goals, generated_content, created_at FROM courses WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
        const parsedCourses = courses.map(course => ({...course, generated_content: JSON.parse(course.generated_content)}));
        res.json({ status: 'success', courses: parsedCourses });
    } catch (error) {
        res.status(500).json({ status: 'error', message: `Failed to fetch courses: ${error.message}` });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});