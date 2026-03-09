class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        // Check if we're on login or register page
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Check if user is already logged in
        this.checkAuthStatus();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        this.showLoading();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (response.ok) {
                // Store token and user info
                localStorage.setItem('access_token', result.access_token);
                localStorage.setItem('user', JSON.stringify(result.user));
                
                this.showSuccess('Login successful! Redirecting...');
                
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                if (response.status === 503) {
                    this.showError('Login is currently unavailable. Database connection required.');
                } else {
                    this.showError(result.detail || 'Login failed');
                }
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        // Validate password confirmation
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        // Validate password length (reasonable limit)
        if (password.length > 128) {
            this.showError('Password is too long. Please use a password with less than 128 characters.');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long.');
            return;
        }

        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            full_name: formData.get('full_name'),
            user_type: formData.get('user_type'),
            password: password
        };

        this.showLoading();

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (response.ok) {
                // Store token and user info
                localStorage.setItem('access_token', result.access_token);
                localStorage.setItem('user', JSON.stringify(result.user));
                
                this.showSuccess('Account created successfully! Redirecting...');
                
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                if (response.status === 503) {
                    this.showError('Registration is currently unavailable. Database connection required.');
                } else {
                    this.showError(result.detail || 'Registration failed');
                }
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('access_token');
        const currentPath = window.location.pathname;
        
        if (token && (currentPath === '/login' || currentPath === '/register')) {
            // User is logged in but on auth page, redirect to main app
            window.location.href = '/';
        } else if (!token && currentPath === '/') {
            // User is not logged in but on main app, redirect to login
            window.location.href = '/login';
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        this.removeMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const form = document.querySelector('.auth-form');
        form.parentNode.insertBefore(errorDiv, form);
    }

    showSuccess(message) {
        this.removeMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        
        const form = document.querySelector('.auth-form');
        form.parentNode.insertBefore(successDiv, form);
    }

    removeMessages() {
        const messages = document.querySelectorAll('.error-message, .success-message');
        messages.forEach(msg => msg.remove());
    }

    static getToken() {
        return localStorage.getItem('access_token');
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    static isAuthenticated() {
        return !!localStorage.getItem('access_token');
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});