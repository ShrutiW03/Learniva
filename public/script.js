document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const courseForm = document.getElementById('courseForm');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const courseOutput = document.getElementById('courseOutput');
    const generatedContent = document.getElementById('generatedContent');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const saveCourseBtn = document.getElementById('saveCourseBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const mainHeader = document.getElementById('mainHeader');
    const mainAppSection = document.getElementById('appContentSection');
    const authNav = document.getElementById('authNav');
    const signupFormSection = document.getElementById('signupFormSection');
    const loginFormSection = document.getElementById('loginFormSection');
    const myCoursesSection = document.getElementById('myCoursesSection');
    const myCoursesList = document.getElementById('myCoursesList');
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showLoginFromSignup = document.getElementById('showLoginFromSignup');
    const showSignupFromLogin = document.getElementById('showSignupFromLogin');
    const loggedInStatus = document.getElementById('loggedInStatus');
    const loggedInUsername = document.getElementById('loggedInUsername');
    const logoutBtn = document.getElementById('logoutBtn');
    const myCoursesBtn = document.getElementById('myCoursesBtn');
    const backToMainFromMyCourses = document.getElementById('backToMainFromMyCourses');
    const backToFormBtn = document.getElementById('backToFormBtn');
    
    // --- Quiz Modals ---
    const quizOptionsModal = new bootstrap.Modal(document.getElementById('quizOptionsModal'));
    const startQuizWithOptionsBtn = document.getElementById('startQuizWithOptionsBtn');
    const postCourseQuizModal = new bootstrap.Modal(document.getElementById('postCourseQuizModal'));
    const postCourseQuizForm = document.getElementById('postCourseQuizForm');
    const submitPostCourseQuizBtn = document.getElementById('submitPostCourseQuizBtn');
    const postCourseQuizTopic = document.getElementById('postCourseQuizTopic');
    const quizLoadingSpinner = document.getElementById('quizLoadingSpinner');

    // --- State Variables ---
    let lastGeneratedCourseData = null;
    let isLoggedIn = false;
    let currentUsername = '';
    let currentUserId = null;
    let activeQuizData = {};

    // --- Helper Functions ---
    const showSection = (section) => { [mainAppSection, signupFormSection, loginFormSection, myCoursesSection, courseOutput].forEach(s => s.style.display = 'none'); [authNav, loggedInStatus].forEach(el => el.style.display = 'none'); if (section) section.style.display = 'block'; };
    const showMainApp = (username) => { showSection(mainAppSection); courseForm.style.display = 'block'; loggedInStatus.style.display = 'flex'; loggedInUsername.textContent = username; mainHeader.style.display = 'none'; };
    const showLogin = () => { showSection(loginFormSection); authNav.style.display = 'block'; mainHeader.style.display = 'block'; };
    const showSignup = () => { showSection(signupFormSection); authNav.style.display = 'block'; };
    const showLoading = () => { courseForm.style.display = 'none'; courseOutput.style.display = 'none'; loadingSpinner.style.display = 'block'; };
    const hideLoading = () => { courseForm.style.display = 'block'; loadingSpinner.style.display = 'none'; };

    // --- Main Course Generation Workflow ---
    courseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isLoggedIn) { alert('Please log in first.'); return; }
        showLoading();
        const formData = { topic: document.getElementById('courseTopic').value, duration: document.getElementById('courseDuration').value, skillLevel: document.getElementById('skillLevel').value, learningGoals: document.getElementById('learningGoals').value };
        try {
            const response = await fetch('/api/course/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to generate course.');
            lastGeneratedCourseData = data;
            displayGeneratedCourse(data.generatedCourse);
            courseForm.style.display = 'none';
            loadingSpinner.style.display = 'none';
            courseOutput.style.display = 'block';
        } catch (error) {
            hideLoading();
            alert(`Error: ${error.message}`);
        }
    });

    // --- MODIFIED FUNCTION TO DISPLAY VARIOUS RESOURCE TYPES ---
    const displayGeneratedCourse = (generatedCourse) => {
        let htmlContent = `<h3 class="text-center mb-4">${generatedCourse.title || 'Generated Course'}</h3>`;
        
        const getIconForType = (type) => {
            switch (type) {
                case 'YouTube Video': return '<i class="bi bi-play-circle-fill me-2" style="color: #c4302b;"></i>';
                case 'Official Documentation': return '<i class="bi bi-file-code-fill me-2" style="color: #6e5494;"></i>';
                case 'Article': return '<i class="bi bi-newspaper me-2" style="color: #007bff;"></i>';
                case 'Interactive Tutorial': return '<i class="bi bi-joystick me-2" style="color: #28a745;"></i>';
                default: return '<i class="bi bi-link-45deg me-2"></i>';
            }
        };

        htmlContent += (generatedCourse.modules || []).map((module, index) => {
            const outcomesHtml = (module.learningOutcomes || []).map(o => `<li><i class="bi bi-check-circle-fill text-success me-2"></i>${o}</li>`).join('');
            
            const resourcesHtml = (module.resources || []).map(r => 
                `<li>${getIconForType(r.type)}<a href="${r.url}" target="_blank">${r.title}</a> <small class="text-muted">(${r.type})</small></li>`
            ).join('');

            return `
                <div class="list-group-item mb-3">
                    <h5>Module ${index + 1}: ${module.name || 'Untitled'}</h5>
                    <p>${module.description || ''}</p>
                    <div class="mt-2">
                        <strong>Learning Outcomes:</strong>
                        <ul class="list-unstyled ms-3">${outcomesHtml}</ul>
                    </div>
                    <div class="mt-2">
                        <strong>Recommended Resources:</strong>
                        <ul class="list-unstyled ms-3">${resourcesHtml}</ul>
                    </div>
                </div>`;
        }).join('');

        generatedContent.innerHTML = htmlContent;
    };
    
    // --- Post-Course Quiz Workflow ---
    const showQuizOptions = (courseId, courseTopic) => {
        activeQuizData = { courseId, courseTopic };
        quizOptionsModal.show();
    };

    startQuizWithOptionsBtn.addEventListener('click', async () => {
        const difficulty = document.getElementById('quizDifficulty').value;
        const quizType = document.getElementById('quizType').value;
        activeQuizData.difficulty = difficulty;
        activeQuizData.quizType = quizType;
        
        quizOptionsModal.hide();
        postCourseQuizTopic.textContent = activeQuizData.courseTopic;
        postCourseQuizForm.innerHTML = '';
        quizLoadingSpinner.style.display = 'block';
        postCourseQuizModal.show();

        try {
            const response = await fetch(`/api/course/${activeQuizData.courseId}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: activeQuizData.courseTopic,
                    userId: currentUserId,
                    difficulty,
                    quizType
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            if (!result.questions || result.questions.length === 0) throw new Error('No questions were returned.');

            postCourseQuizForm.innerHTML = result.questions.map((q, index) => {
                const optionsHtml = (q.options || []).map(opt => `<div class="form-check"><input class="form-check-input" type="radio" name="question_${q.question_id}" value="${opt.option}" required><label class="form-check-label"> ${opt.text || ''}</label></div>`).join('');
                return `<div class="mb-4"><strong>${index + 1}. ${q.question_text || ''}</strong>${optionsHtml}</div>`;
            }).join('');
        } catch (error) {
            postCourseQuizForm.innerHTML = `<p class="text-danger">Failed to load quiz: ${error.message}</p>`;
        } finally {
            quizLoadingSpinner.style.display = 'none';
        }
    });

    submitPostCourseQuizBtn.addEventListener('click', async () => {
        if (!postCourseQuizForm.checkValidity()) { postCourseQuizForm.reportValidity(); return; }
        const formData = new FormData(postCourseQuizForm);
        const answers = {};
        for (let [key, value] of formData.entries()) { answers[key.split('_')[1]] = value; }
        try {
            const response = await fetch(`/api/course/${activeQuizData.courseId}/submit-quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...activeQuizData, userId: currentUserId, answers })
            });
            const result = await response.json();
            alert(result.message);
            if (response.ok) postCourseQuizModal.hide();
        } catch (error) {
            alert(`Error submitting quiz: ${error.message}`);
        }
    });

    // --- Button Handlers & Auth ---
    saveCourseBtn.addEventListener('click', async () => {
        if (!lastGeneratedCourseData) { alert('No course generated yet!'); return; }
        try {
            // Note the structure change here to match the updated server.js
            const payload = {
                receivedData: lastGeneratedCourseData.receivedData,
                generatedCourse: lastGeneratedCourseData.generatedCourse,
                userId: currentUserId
            };
            const response = await fetch('/save-course', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert(result.message);
        } catch (error) { alert(`Failed to save course: ${error.message}`); }
    });

    myCoursesBtn.addEventListener('click', async () => {
        if (!isLoggedIn) { alert('Please log in first.'); return; }
        showSection(myCoursesSection);
        loggedInStatus.style.display = 'flex';
        myCoursesList.innerHTML = '<p class="text-center text-muted">Loading...</p>';
        try {
            const response = await fetch(`/my-courses?userId=${currentUserId}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            if (result.courses && result.courses.length > 0) {
                myCoursesList.innerHTML = '';
                result.courses.forEach(course => {
                    const courseCard = document.createElement('div');
                    courseCard.className = 'list-group-item list-group-item-action flex-column align-items-start mb-3 custom-form';
                    const courseTitle = (course.generated_content && course.generated_content.title) ? course.generated_content.title : 'Course Title Not Available';
                    courseCard.innerHTML = `<div class="d-flex w-100 justify-content-between"><h5 class="mb-1 text-primary">${course.topic || 'No Topic'}</h5><small>${new Date(course.created_at).toLocaleDateString()}</small></div><p class="mb-1">${courseTitle}</p><button class="btn btn-sm btn-outline-primary mt-2 take-quiz-btn">Take Quiz</button>`;
                    courseCard.querySelector('.take-quiz-btn').addEventListener('click', () => showQuizOptions(course.id, course.topic));
                    myCoursesList.appendChild(courseCard);
                });
            } else {
                myCoursesList.innerHTML = '<p class="text-center text-muted">You have no saved courses yet.</p>';
            }
        } catch (error) { myCoursesList.innerHTML = `<p class="text-danger">Failed to load courses: ${error.message}</p>`; }
    });

    backToFormBtn.addEventListener('click', () => { courseOutput.style.display = 'none'; courseForm.style.display = 'block'; });
    resetFormBtn.addEventListener('click', () => { courseForm.reset(); courseOutput.style.display = 'none'; generatedContent.innerHTML = ''; lastGeneratedCourseData = null; });
    exportPdfBtn.addEventListener('click', () => { if (!lastGeneratedCourseData) { alert('Please generate a course first.'); return; } const elementToExport = generatedContent; const originalStyle = elementToExport.style.overflowX; elementToExport.style.overflowX = 'visible'; html2pdf().set({ margin: 10, filename: 'Learniva_Curriculum.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elementToExport).save().then(() => { elementToExport.style.overflowX = originalStyle; }); });
    
    const setupAuthListeners = () => {
        showSignupBtn.addEventListener('click', showSignup);
        showLoginBtn.addEventListener('click', showLogin);
        showLoginFromSignup.addEventListener('click', showLogin);
        showSignupFromLogin.addEventListener('click', showSignup);
        logoutBtn.addEventListener('click', () => { 
            isLoggedIn = false; 
            currentUserId = null; 
            currentUsername = ''; 
            lastGeneratedCourseData = null; 
            courseForm.reset(); 
            courseOutput.style.display = 'none'; 
            showLogin(); 
        });
        signupForm.addEventListener('submit', async (event) => { 
            event.preventDefault(); 
            const username = signupForm.querySelector('#signupUsername').value.trim();
            const email = signupForm.querySelector('#signupEmail').value.trim();
            const password = signupForm.querySelector('#signupPassword').value.trim();
            if (!username || !password) { alert('Username and password required.'); return; } 
            try { 
                const response = await fetch('/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) }); 
                const result = await response.json(); 
                alert(result.message); 
                if (response.ok) { signupForm.reset(); showLogin(); } 
            } catch (error) { alert(`Signup failed: ${error.message}.`); } 
        });
        loginForm.addEventListener('submit', async (event) => { 
            event.preventDefault(); 
            const username = loginForm.querySelector('#loginUsername').value.trim();
            const password = loginForm.querySelector('#loginPassword').value.trim();
            if (!username || !password) { alert('Username and password required.'); return; } 
            try { 
                const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); 
                const result = await response.json(); 
                if (!response.ok) throw new Error(result.message); 
                alert(result.message); 
                loginForm.reset(); 
                isLoggedIn = true; 
                currentUsername = result.username; 
                currentUserId = result.userId; 
                showMainApp(currentUsername); 
            } catch (error) { alert(`Login failed: ${error.message}.`); } 
        });
        backToMainFromMyCourses.addEventListener('click', () => showMainApp(currentUsername));
    };
    
    setupAuthListeners();
    showLogin();
});