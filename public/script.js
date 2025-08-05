document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const courseForm = document.getElementById('courseForm');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const courseOutput = document.getElementById('courseOutput');
    const generatedContent = document.getElementById('generatedContent');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const saveCourseBtn = document.getElementById('saveCourseBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');

    // Auth Sections & Forms
    const mainAppSection = document.getElementById('appContentSection');
    const authNav = document.getElementById('authNav');
    const signupFormSection = document.getElementById('signupFormSection');
    const loginFormSection = document.getElementById('loginFormSection');
    const myCoursesSection = document.getElementById('myCoursesSection');
    const myCoursesList = document.getElementById('myCoursesList');
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');

    // Navigation Buttons
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showLoginFromSignup = document.getElementById('showLoginFromSignup');
    const showSignupFromLogin = document.getElementById('showSignupFromLogin');

    // Logout & My Courses
    const loggedInStatus = document.getElementById('loggedInStatus');
    const loggedInUsername = document.getElementById('loggedInUsername');
    const logoutBtn = document.getElementById('logoutBtn');
    const myCoursesBtn = document.getElementById('myCoursesBtn');
    const backToMainFromMyCourses = document.getElementById('backToMainFromMyCourses');

    // --- Quiz Modal Elements ---
    const quizModalElement = document.getElementById('quizModal');
    const quizModal = new bootstrap.Modal(quizModalElement);
    const quizForm = document.getElementById('quizForm');
    const submitQuizBtn = document.getElementById('submitQuizBtn');
    const quizTopicDisplay = document.getElementById('quizTopicDisplay');

    // --- State Variables ---
    let lastGeneratedCourseData = null;
    let isLoggedIn = false;
    let currentUsername = '';
    let currentUserId = null;
    let tempCourseData = {}; // To hold form data while quiz is active

    // --- Helper Functions for Section Visibility ---
    const showSection = (sectionToShow) => {
        // Hide all major sections first
        mainAppSection.style.display = 'none';
        signupFormSection.style.display = 'none';
        loginFormSection.style.display = 'none';
        myCoursesSection.style.display = 'none';
        
        // Hide auth-related elements
        authNav.style.display = 'none';
        loggedInStatus.style.display = 'none';
        
        // Show the requested section
        sectionToShow.style.display = 'block';
    };

    const showMainApp = (username = '') => {
        showSection(mainAppSection);
        if (isLoggedIn) {
            loggedInStatus.style.display = 'flex'; // Use flex for proper alignment of items
            loggedInUsername.textContent = username;
        } else {
            // This case should ideally not happen if logic is correct, but as a fallback
            authNav.style.display = 'block';
        }
    };

    const showSignup = () => { showSection(signupFormSection); authNav.style.display = 'block'; };
    const showLogin = () => { showSection(loginFormSection); authNav.style.display = 'block'; };

    const showLoading = () => {
        courseForm.style.display = 'none';
        courseOutput.style.display = 'none';
        loadingSpinner.style.display = 'block';
    };

    const hideLoading = () => {
        courseForm.style.display = 'block';
        loadingSpinner.style.display = 'none';
    };

    // --- Quiz Workflow ---
    const startQuiz = async () => {
        const topic = document.getElementById('courseTopic').value;
        quizTopicDisplay.textContent = topic;

        showLoading();

        try {
            const response = await fetch(`/api/generate-quiz/${topic}/${currentUserId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to load quiz from API.');
            }
            const result = await response.json();

            if (result.status === 'error' || !result.questions || result.questions.length === 0) {
                 throw new Error(result.message || 'Could not load quiz questions.');
            }

            quizForm.innerHTML = '';
            result.questions.forEach((q, index) => {
                const optionsHtml = q.options.map(opt => `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="question_${q.question_id}" id="option_${q.question_id}_${opt.option}" value="${opt.option}" required>
                        <label class="form-check-label" for="option_${q.question_id}_${opt.option}">${opt.text}</label>
                    </div>
                `).join('');

                quizForm.innerHTML += `
                    <div class="mb-4 quiz-question-container">
                        <p><strong>${index + 1}. ${q.question_text}</strong></p>
                        ${optionsHtml}
                    </div>`;
            });

            hideLoading();
            quizModal.show();

        } catch (error) {
            console.error('Error starting quiz:', error);
            alert(`Failed to start quiz: ${error.message}`);
            hideLoading();
        }
    };

    submitQuizBtn.addEventListener('click', async () => {
        if (!quizForm.checkValidity()) {
            quizForm.reportValidity();
            return;
        }

        const formData = new FormData(quizForm);
        const answers = {};
        for (let [key, value] of formData.entries()) {
            const questionId = key.split('_')[1];
            answers[questionId] = value;
        }

        quizModal.hide();
        showLoading();

        try {
            const response = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...tempCourseData, answers })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            alert(data.message);
            lastGeneratedCourseData = data;
            displayGeneratedCourse(data.generatedCourse, data.receivedData);

        } catch (error) {
            console.error('Error submitting quiz and generating course:', error);
            generatedContent.innerHTML = `<p class="text-danger">Error: ${error.message}. Please check the server logs.</p>`;
            courseOutput.style.display = 'block';
        } finally {
            hideLoading();
        }
    });

    // --- Course Generation & Display ---
    courseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isLoggedIn || !currentUserId) {
            alert('Please log in to generate a course.');
            showLogin();
            return;
        }
        // Store form data to be used after the quiz
        tempCourseData = {
            topic: document.getElementById('courseTopic').value,
            duration: document.getElementById('courseDuration').value,
            learningGoals: document.getElementById('learningGoals').value,
            userId: currentUserId
        };
        await startQuiz();
    });

    const displayGeneratedCourse = (generatedCourse, receivedData) => {
        let htmlContent = `<h3 class="text-center mb-4">${generatedCourse.title || `Course on ${receivedData.topic}`}</h3>`;
        if (generatedCourse && Array.isArray(generatedCourse.modules)) {
            generatedCourse.modules.forEach((module, index) => {
                htmlContent += `
                    <div class="list-group-item list-group-item-action flex-column align-items-start mb-3">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1 text-primary">Module ${index + 1}: ${module.name || 'Untitled Module'}</h5>
                            <small class="text-muted">${module.duration || 'N/A'}</small>
                        </div>
                        <p class="mb-1">${module.description || 'No description provided.'}</p>
                        <div class="mt-2">
                            <strong>Learning Outcomes:</strong>
                            <ul class="list-unstyled mb-2 ms-3">
                                ${(module.learningOutcomes || []).map(o => `<li><i class="bi bi-check-circle-fill text-success me-2"></i>${o}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="mt-2">
                            <strong>Recommended Resources:</strong>
                            <ul class="list-unstyled mb-0 ms-3">
                                 ${(module.resources || []).map(r => {
                                    let iconClass = 'bi bi-link-45deg text-secondary';
                                    if (r.type?.toLowerCase().includes('video')) iconClass = 'bi bi-play-circle-fill text-danger';
                                    else if (r.type?.toLowerCase().includes('article')) iconClass = 'bi bi-file-earmark-text-fill text-info';
                                    else if (r.type?.toLowerCase().includes('exercise')) iconClass = 'bi bi-code-square text-warning';
                                    return `<li><i class="${iconClass} me-2"></i><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title} (${r.type || 'Link'})</a></li>`;
                                }).join('')}
                            </ul>
                        </div>
                    </div>`;
            });
        } else {
            htmlContent = `<p class="text-warning">Could not display course modules. The generated structure might be invalid.</p>`;
        }
        generatedContent.innerHTML = htmlContent;
        courseOutput.style.display = 'block';
    };

    // --- Save, Export, Reset Button Handlers ---
    saveCourseBtn.addEventListener('click', async () => {
        if (!isLoggedIn || !currentUserId) {
            alert('Please log in to save a course.');
            showLogin();
            return;
        }
        if (!lastGeneratedCourseData) {
            alert('No course has been generated yet to save!');
            return;
        }
        const { receivedData, generatedCourse } = lastGeneratedCourseData;
        try {
            const response = await fetch('/save-course', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...receivedData, generatedCourse, userId: currentUserId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert(result.message);
        } catch (error) {
            alert(`Failed to save course: ${error.message}`);
        }
    });

    exportPdfBtn.addEventListener('click', () => {
        if (courseOutput.style.display === 'none' || generatedContent.innerHTML.trim() === '') {
            alert('Please generate a course first before exporting.');
            return;
        }
        const elementToExport = generatedContent;
        const originalOverflow = elementToExport.style.overflowX;
        elementToExport.style.overflowX = 'visible';

        const options = {
            margin: 10,
            filename: 'Learniva_Curriculum.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(options).from(elementToExport).save().then(() => {
            elementToExport.style.overflowX = originalOverflow;
        });
    });

    resetFormBtn.addEventListener('click', () => {
        courseForm.reset();
        courseOutput.style.display = 'none';
        generatedContent.innerHTML = '';
        lastGeneratedCourseData = null;
    });

    // --- Auth & My Courses Logic ---
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
            document.getElementById('mainHeader').style.display = 'block';
            showLogin();
        });

        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = signupForm.querySelector('#signupUsername').value.trim();
            const email = signupForm.querySelector('#signupEmail').value.trim();
            const password = signupForm.querySelector('#signupPassword').value.trim();
            if (!username || !password) {
                alert('Username and password are required.');
                return;
            }
            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password }),
                });
                const result = await response.json();
                alert(result.message);
                if (response.ok) {
                    signupForm.reset();
                    showLogin();
                }
            } catch (error) {
                alert(`Signup failed: ${error.message}.`);
            }
        });

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = loginForm.querySelector('#loginUsername').value.trim();
            const password = loginForm.querySelector('#loginPassword').value.trim();
            if (!username || !password) {
                alert('Username and password are required.');
                return;
            }
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                alert(result.message);
                loginForm.reset();
                isLoggedIn = true;
                currentUsername = result.username;
                currentUserId = result.userId;
                document.getElementById('mainHeader').style.display = 'none';
                showMainApp(currentUsername);
            } catch (error) {
                alert(`Login failed: ${error.message}.`);
            }
        });

        myCoursesBtn.addEventListener('click', async () => {
            if (!isLoggedIn || !currentUserId) {
                alert('Please log in to view your saved courses.');
                showLogin();
                return;
            }

            showSection(myCoursesSection);
            loggedInStatus.style.display = 'flex';
            myCoursesList.innerHTML = '<p class="text-center text-muted">Loading your courses...</p>';

            try {
                const response = await fetch(`/my-courses?userId=${currentUserId}`);
                if (!response.ok) throw new Error(await response.text());
                const result = await response.json();

                if (result.courses && result.courses.length > 0) {
                    myCoursesList.innerHTML = '';
                    result.courses.forEach(course => {
                        const courseCard = document.createElement('div');
                        courseCard.className = 'list-group-item list-group-item-action flex-column align-items-start mb-3 custom-form';
                        courseCard.innerHTML = `
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1 text-primary">${course.topic}</h5>
                                <small class="text-muted">${new Date(course.created_at).toLocaleDateString()}</small>
                            </div>
                            <p class="mb-1">${course.generated_content.title || 'No title provided'}</p>
                            <small class="text-muted">Duration: ${course.duration} weeks | Skill Level: ${course.skill_level}</small>
                            <button class="btn btn-sm btn-outline-info mt-2 view-course-details">View Details</button>`;
                        
                        courseCard.querySelector('.view-course-details').addEventListener('click', () => {
                            displayGeneratedCourse(course.generated_content, course);
                            showMainApp(currentUsername);
                            courseOutput.scrollIntoView({ behavior: 'smooth' });
                        });
                        myCoursesList.appendChild(courseCard);
                    });
                } else {
                    myCoursesList.innerHTML = '<p class="text-center text-muted">You have no saved courses yet.</p>';
                }
            } catch (error) {
                myCoursesList.innerHTML = `<p class="text-danger">Failed to load courses: ${error.message}</p>`;
            }
        });

        backToMainFromMyCourses.addEventListener('click', () => showMainApp(currentUsername));
    };

    // --- Initial Application Load ---
    setupAuthListeners();
    showLogin();
});