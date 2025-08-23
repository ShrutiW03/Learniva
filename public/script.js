document.addEventListener('DOMContentLoaded', () => {
    // --- Element References (with new back buttons) ---
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
    const backToGeneratorBtn = document.getElementById('backToGeneratorBtn');
    const backBtn = document.getElementById('backBtn');
    
    // --- Quiz Modals ---
    const quizOptionsModal = new bootstrap.Modal(document.getElementById('quizOptionsModal'));
    const startQuizWithOptionsBtn = document.getElementById('startQuizWithOptionsBtn');
    const postCourseQuizModal = new bootstrap.Modal(document.getElementById('postCourseQuizModal'));
    const postCourseQuizForm = document.getElementById('postCourseQuizForm');
    const submitPostCourseQuizBtn = document.getElementById('submitPostCourseQuizBtn');
    const postCourseQuizTopic = document.getElementById('postCourseQuizTopic');
    const quizLoadingSpinner = document.getElementById('quizLoadingSpinner');

    // --- State Variables (with new navigation state) ---
    let lastGeneratedCourseData = null;
    let isLoggedIn = false;
    let currentUsername = '';
    let currentUserId = null;
    let activeQuizData = {};
    let activeCourseId = null;
    let previousSection = null; // NEW: To remember where the user came from

    // --- Helper Functions ---
    const showSection = (section, fromSection = null) => {
        // NEW: Set the previous section for smart navigation
        if (fromSection) {
            previousSection = fromSection;
        }
        [mainAppSection, signupFormSection, loginFormSection, myCoursesSection, courseOutput].forEach(s => s.style.display = 'none');
        [authNav, loggedInStatus].forEach(el => el.style.display = 'none');
        if (section) section.style.display = 'block';
    };

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
        // NEW: Remember we came from the generator form
        previousSection = courseForm;
        const formData = { topic: document.getElementById('courseTopic').value, duration: document.getElementById('courseDuration').value, skillLevel: document.getElementById('skillLevel').value, learningGoals: document.getElementById('learningGoals').value };
        try {
            const response = await fetch('/api/course/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to generate course.');
            lastGeneratedCourseData = data;
            activeCourseId = null; 
            saveCourseBtn.style.display = 'block';
            displayGeneratedCourse(data.generatedCourse);
            courseForm.style.display = 'none';
            loadingSpinner.style.display = 'none';
            courseOutput.style.display = 'block';
        } catch (error) {
            hideLoading();
            alert(`Error: ${error.message}`);
        }
    });

    const displayGeneratedCourse = (generatedCourse, courseId = null) => {
        activeCourseId = courseId;
        let htmlContent = `<h3 class="text-center mb-4">${generatedCourse.title || 'Generated Course'}</h3>`;
        if (courseId) {
            htmlContent += `<div class="progress mb-4" style="height: 25px; font-size: 1rem;"><div id="courseProgressBar" class="progress-bar bg-success" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div></div>`;
        }
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
            const resourcesHtml = (module.resources || []).map(r => {
                const checkboxHtml = courseId ? `<input class="form-check-input me-2 resource-checkbox" type="checkbox" data-resource-url="${r.url}">` : '';
                return `<li>${checkboxHtml}${getIconForType(r.type)}<a href="${r.url}" target="_blank">${r.title}</a> <small class="text-muted">(${r.type})</small></li>`;
            }).join('');
            return `<div class="list-group-item mb-3"><h5>Module ${index + 1}: ${module.name || 'Untitled'}</h5><p>${module.description || ''}</p><div class="mt-2"><strong>Learning Outcomes:</strong><ul class="list-unstyled ms-3">${outcomesHtml}</ul></div><div class="mt-2"><strong>Recommended Resources:</strong><ul class="list-unstyled ms-3">${resourcesHtml}</ul></div></div>`;
        }).join('');
        generatedContent.innerHTML = htmlContent;
        if (courseId) {
            fetchAndApplyProgress(courseId);
        }
    };
    
    const fetchAndApplyProgress = async (courseId) => {
        if (!courseId || !isLoggedIn) return;
        try {
            const response = await fetch(`/api/course/${courseId}/progress?userId=${currentUserId}`);
            const data = await response.json();
            if (response.ok) {
                updateProgressDisplay(data.completed_resources || []);
            }
        } catch (error) {
            console.error("Failed to fetch progress:", error);
        }
    };

    const updateProgressDisplay = (completedResources) => {
        const allCheckboxes = document.querySelectorAll('.resource-checkbox');
        if (allCheckboxes.length === 0) return;
        allCheckboxes.forEach(checkbox => {
            checkbox.checked = completedResources.includes(checkbox.dataset.resourceUrl);
        });
        const completedCount = completedResources.length;
        const totalCount = allCheckboxes.length;
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const progressBar = document.getElementById('courseProgressBar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
            progressBar.setAttribute('aria-valuenow', percentage);
        }
    };

    const saveProgress = async () => {
        if (!activeCourseId || !isLoggedIn) return;
        const allCheckboxes = document.querySelectorAll('.resource-checkbox');
        const completed_resources = [];
        allCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                completed_resources.push(checkbox.dataset.resourceUrl);
            }
        });
        try {
            await fetch(`/api/course/${activeCourseId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, completed_resources })
            });
            updateProgressDisplay(completed_resources);
        } catch (error) {
            console.error("Failed to save progress:", error);
        }
    };

    generatedContent.addEventListener('change', (event) => {
        if (event.target.classList.contains('resource-checkbox')) {
            saveProgress();
        }
    });

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
            const response = await fetch(`/api/course/${activeQuizData.courseId}/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: activeQuizData.courseTopic, userId: currentUserId, difficulty, quizType }) });
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
            const response = await fetch(`/api/course/${activeQuizData.courseId}/submit-quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...activeQuizData, userId: currentUserId, answers }) });
            const result = await response.json();
            alert(result.message);
            if (response.ok) postCourseQuizModal.hide();
        } catch (error) {
            alert(`Error submitting quiz: ${error.message}`);
        }
    });

    saveCourseBtn.addEventListener('click', async () => {
        if (!lastGeneratedCourseData) { alert('No course generated yet!'); return; }
        try {
            const payload = { receivedData: lastGeneratedCourseData.receivedData, generatedCourse: lastGeneratedCourseData.generatedCourse, userId: currentUserId };
            const response = await fetch('/save-course', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert(result.message);
            activeCourseId = result.courseId;
            displayGeneratedCourse(lastGeneratedCourseData.generatedCourse, activeCourseId);
            saveCourseBtn.style.display = 'none';
        } catch (error) { alert(`Failed to save course: ${error.message}`); }
    });
    
    myCoursesBtn.addEventListener('click', async () => {
        if (!isLoggedIn) { alert('Please log in first.'); return; }
        showSection(myCoursesSection, mainAppSection);
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
                    const courseTitle = (course.generated_content && course.generated_content.title) ? course.generated_content.title : course.topic;
                    const allResources = course.generated_content.modules?.flatMap(m => m.resources) || [];
                    const totalCount = allResources.length;
                    const completedCount = course.completed_resources.length;
                    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    courseCard.innerHTML = `<div class="d-flex w-100 justify-content-between"><h5 class="mb-1">${course.topic || 'No Topic'}</h5><small>${new Date(course.created_at).toLocaleDateString()}</small></div><p class="mb-1">${courseTitle}</p><div class="progress mt-2" style="height: 15px;"><div class="progress-bar bg-success" role="progressbar" style="width: ${percentage}%;" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">${percentage}%</div></div><div class="mt-2"><button class="btn btn-sm btn-primary mt-2 view-course-btn">View Course</button><button class="btn btn-sm btn-outline-primary mt-2 take-quiz-btn">Take Quiz</button></div>`;
                    
                    courseCard.querySelector('.view-course-btn').addEventListener('click', () => {
                        showSection(mainAppSection, myCoursesSection);
                        courseForm.style.display = 'none';
                        courseOutput.style.display = 'block';
                        saveCourseBtn.style.display = 'none';
                        displayGeneratedCourse(course.generated_content, course.id);
                    });

                    courseCard.querySelector('.take-quiz-btn').addEventListener('click', () => showQuizOptions(course.id, course.topic));
                    myCoursesList.appendChild(courseCard);
                });
            } else {
                myCoursesList.innerHTML = '<p class="text-center text-muted">You have no saved courses yet.</p>';
            }
        } catch (error) { myCoursesList.innerHTML = `<p class="text-danger">Failed to load courses: ${error.message}</p>`; }
    });

    // --- NEW: Smart Back Button Logic ---
    backBtn.addEventListener('click', () => {
        courseOutput.style.display = 'none';
        // If the previous section was the course form (i.e., a new course was generated)
        if (previousSection === courseForm) {
            courseForm.style.display = 'block';
        } else {
            // Otherwise, go back to the "My Courses" list
            myCoursesBtn.click();
        }
    });

    backToGeneratorBtn.addEventListener('click', () => showMainApp(currentUsername));
    
    resetFormBtn.addEventListener('click', () => { courseForm.reset(); courseOutput.style.display = 'none'; generatedContent.innerHTML = ''; lastGeneratedCourseData = null; });
    exportPdfBtn.addEventListener('click', () => { if (!lastGeneratedCourseData && !activeCourseId) { alert('Please generate or view a course first.'); return; } const elementToExport = generatedContent; const originalStyle = elementToExport.style.overflowX; elementToExport.style.overflowX = 'visible'; html2pdf().set({ margin: 10, filename: 'Learniva_Curriculum.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elementToExport).save().then(() => { elementToExport.style.overflowX = originalStyle; }); });
    
    const setupAuthListeners = () => {
        showSignupBtn.addEventListener('click', showSignup);
        showLoginBtn.addEventListener('click', showLogin);
        showLoginFromSignup.addEventListener('click', showLogin);
        showSignupFromLogin.addEventListener('click', showSignup);
        logoutBtn.addEventListener('click', () => { isLoggedIn = false; currentUserId = null; currentUsername = ''; lastGeneratedCourseData = null; courseForm.reset(); courseOutput.style.display = 'none'; showLogin(); });
        signupForm.addEventListener('submit', async (event) => { event.preventDefault(); const username = signupForm.querySelector('#signupUsername').value.trim(); const email = signupForm.querySelector('#signupEmail').value.trim(); const password = signupForm.querySelector('#signupPassword').value.trim(); if (!username || !password) { alert('Username and password required.'); return; } try { const response = await fetch('/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password }) }); const result = await response.json(); alert(result.message); if (response.ok) { signupForm.reset(); showLogin(); } } catch (error) { alert(`Signup failed: ${error.message}.`); } });
        loginForm.addEventListener('submit', async (event) => { event.preventDefault(); const username = loginForm.querySelector('#loginUsername').value.trim(); const password = loginForm.querySelector('#loginPassword').value.trim(); if (!username || !password) { alert('Username and password required.'); return; } try { const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); alert(result.message); loginForm.reset(); isLoggedIn = true; currentUsername = result.username; currentUserId = result.userId; showMainApp(currentUsername); } catch (error) { alert(`Login failed: ${error.message}.`); } });
        backToGeneratorBtn.addEventListener('click', () => showMainApp(currentUsername)); // Corrected this line
    };
    
    setupAuthListeners();
    showLogin();
});