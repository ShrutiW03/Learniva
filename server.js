require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// In-memory cache for quiz answers
const quizAnswersCache = {};

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// =================================================================
// --- CORE API ROUTES ---
// =================================================================

// ROUTE 1: Generate a course
app.post('/api/course/generate', async (req, res) => {
    const { topic, duration, learningGoals, skillLevel } = req.body;
    const sanitizedGoals = learningGoals.replace(/"/g, '\\"').replace(/\n/g, ' ');

    const coursePrompt = `
      You are an expert curriculum designer. Create a detailed course outline for a user with a skill level of "${skillLevel}".
      The topic is "${topic}" for a duration of "${duration} weeks" with these goals: "${sanitizedGoals}".
      Generate a strict JSON object with a "title" (string) and a "modules" (array).
      Each object in the "modules" array must have: "name", "description", "learningOutcomes" (array of strings), and "resources" (array of 3 to 5 objects).
      Each object in the "resources" array must have: "title", "url", and "type" (one of: "YouTube Video", "Official Documentation", "Article", "Interactive Tutorial").
      For resources, find relevant, highly-regarded content. For YouTube videos, prioritize high view counts.
    `;

    try {
        const result = await geminiModel.generateContent(coursePrompt);
        const response = await result.response;
        const rawText = response.text();
        
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
            console.error("Raw AI Response:", rawText);
            throw new Error("Could not find a valid JSON object in the AI's response.");
        }
        
        const jsonString = jsonMatch[0];
        const generatedCourse = JSON.parse(jsonString);
        
        res.json({
            status: 'success',
            message: 'Course and resources generated successfully!',
            generatedCourse: generatedCourse,
            receivedData: { topic, duration, skillLevel, learningGoals }
        });
    } catch (error) {
        console.error('Error in course generation workflow:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate course. The AI may have returned an invalid format.' });
    }
});

// ROUTE 2: Generate a quiz for a specific saved course
app.post('/api/course/:courseId/quiz', async (req, res) => {
    const { courseId } = req.params;
    const { topic, userId, difficulty, quizType } = req.body;
    const questionCount = quizType === 'test' ? 10 : 5;
    console.log(`Generating a ${difficulty} ${quizType} with ${questionCount} questions for topic: "${topic}"`);

    const prompt = `You are a quiz generator. Create a ${difficulty}-level ${quizType} with exactly ${questionCount} multiple-choice questions for the topic: "${topic}". Format as a strict JSON object with a "questions" key. Each question must have "question_id" (unique number), "question_text", "options" (array of 4 objects with "option" like "A" and "text"), and "correct_option".`;
    
    try {
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const aiResponseContent = response.text().trim().replace(/^```json\n|```$/g, '');
        const quizData = JSON.parse(aiResponseContent);

        if (!quizData.questions || !Array.isArray(quizData.questions)) {
            throw new Error('API response did not contain a valid "questions" array.');
        }

        const answers = {};
        const questionsForClient = quizData.questions.map(q => {
            answers[q.question_id] = q.correct_option;
            const { correct_option, ...questionForClient } = q;
            return questionForClient;
        });

        quizAnswersCache[`${userId}_${courseId}`] = answers;
        setTimeout(() => { delete quizAnswersCache[`${userId}_${courseId}`]; }, 600000);

        res.json({ status: 'success', questions: questionsForClient });
    } catch (error) {
        console.error('Error generating post-course quiz:', error);
        res.status(500).json({ status: 'error', message: 'Failed to generate quiz. The AI may have returned an invalid format.' });
    }
});

// ROUTE 3: Submit the post-course quiz (MODIFIED)
app.post('/api/course/:courseId/submit-quiz', async (req, res) => {
    const { courseId } = req.params;
    // --- FIX: Use 'courseTopic' to match the frontend and provide a default value ---
    const { userId, answers, courseTopic, difficulty, quizType } = req.body;
    const topic = courseTopic || 'General Quiz'; // Ensure 'topic' is never undefined

    const cacheKey = `${userId}_${courseId}`;
    const correctAnswers = quizAnswersCache[cacheKey];

    if (!correctAnswers) return res.status(400).json({ status: 'error', message: 'Quiz session expired.' });

    let score = 0;
    const questionIds = Object.keys(answers);
    questionIds.forEach(id => { if (answers[id] === correctAnswers[id]) score++; });
    delete quizAnswersCache[cacheKey];

    try {
        await pool.execute(
            `INSERT INTO userquizresults (user_id, course_id, topic, score, total_questions, difficulty, quiz_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, courseId, topic, score, questionIds.length, difficulty, quizType]
        );
        res.json({ status: 'success', message: `Quiz submitted! You scored ${score} out of ${questionIds.length}.` });
    } catch (error) {
        console.error("Error saving quiz result:", error);
        res.status(500).json({ status: 'error', message: 'Failed to save your quiz score.' });
    }
});

// ROUTE 4: Save a generated course
app.post('/save-course', async (req, res) => {
  const { receivedData, generatedCourse, userId } = req.body;
  const { topic, duration, skillLevel, learningGoals } = receivedData;
  
  if (!generatedCourse || !topic || !duration || !skillLevel || !learningGoals || !userId) {
    return res.status(400).json({ status: 'error', message: 'Missing required course data.' });
  }

  const generatedContentJson = JSON.stringify(generatedCourse);

  try {
    const [result] = await pool.execute(
      `INSERT INTO courses (topic, duration, skill_level, learning_goals, generated_content, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [topic, duration, skillLevel, learningGoals, generatedContentJson, userId]
    );
    res.json({ status: 'success', message: 'Course saved successfully!', courseId: result.insertId });
  } catch (error) {
    console.error("Error saving course:", error);
    res.status(500).json({ status: 'error', message: `Failed to save course: ${error.message}` });
  }
});

// ROUTE 5: Get all courses for a user
app.get('/my-courses', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ status: 'error', message: 'User ID is required.' });
    }
    try {
        const [courses] = await pool.execute(
            `SELECT id, topic, duration, skill_level, learning_goals, generated_content, created_at FROM courses WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        
        const parsedCourses = courses.map(course => {
            try {
                return {...course, generated_content: JSON.parse(course.generated_content)};
            } catch (parseError) {
                return {...course, generated_content: { title: "Error: Could not load content" }}; 
            }
        });

        res.json({ status: 'success', courses: parsedCourses });
    } catch (error) {
        console.error("Error fetching my-courses:", error);
        res.status(500).json({ status: 'error', message: `Failed to fetch courses: ${error.message}` });
    }
});

// ROUTE 6: User Signup
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
        console.error("Signup error:", error);
        res.status(500).json({ status: 'error', message: `Sign-up failed: ${error.message}` });
    }
});

// ROUTE 7: User Login
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
        console.error("Login error:", error);
        res.status(500).json({ status: 'error', message: `Login failed: ${error.message}` });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});