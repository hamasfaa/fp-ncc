// Configuration
const API_URL = 'http://localhost:8000'; // Update this to match your backend URL

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const registerSuccess = document.getElementById('register-success');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Handle tabs
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons and tabs
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        // Add active class to current button and tab
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');

        // Clear error messages
        loginError.textContent = '';
        registerError.textContent = '';
        registerSuccess.textContent = '';
    });
});

// Check if user is already logged in
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (token && user) {
        // Redirect to chat page
        window.location.href = 'chat.html';
    }
}

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store auth data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect to chat page
        window.location.href = 'chat.html';
    } catch (error) {
        loginError.textContent = error.message || 'An error occurred during login';
    }
});

// Register form submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';
    registerSuccess.textContent = '';

    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Show success message
        registerSuccess.textContent = 'Registration successful! You can now log in.';
        registerForm.reset();

        // Switch to login tab after a short delay
        setTimeout(() => {
            document.querySelector('.tab-btn[data-tab="login"]').click();
        }, 2000);
    } catch (error) {
        registerError.textContent = error.message || 'An error occurred during registration';
    }
});

// Run on page load
checkAuthStatus();