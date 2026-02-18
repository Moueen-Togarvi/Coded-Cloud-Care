document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.querySelector('form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.querySelector('button[type="submit"]');

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert('Please enter both email and password.');
        return;
    }

    // Show loading state
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-icons animate-spin">refresh</span> Signing In...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Store token and user data
            // Note: The structure might be data.data.token based on previous tests
            const token = data.data.token;
            const user = data.data.user;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            showAlert('Login successful! Redirecting...', 'success');
            // Show success feedback
            submitBtn.innerHTML = '<span class="material-icons">check</span> Success!';
            submitBtn.classList.remove('bg-primary');
            submitBtn.classList.add('bg-green-600');

            // Redirect to Dashboard
            setTimeout(() => {
                window.location.href = '/Frontend/pharmacy/index.html';
            }, 1000);
        } else {
            showAlert(data.message || 'Login failed', 'error');
            throw new Error(data.message || 'Login failed'); // Re-throw to enter catch block for consistent reset
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert(error.message || 'An error occurred during login', 'error');

        // Reset button
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}
