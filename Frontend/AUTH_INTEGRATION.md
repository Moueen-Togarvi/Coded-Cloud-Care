# Frontend Authentication Integration

This document explains how the frontend authentication is connected to the backend API.

## Overview

The frontend authentication system consists of:

- Login page (`Frontend/comp/Login.html`)
- Signup page (`Frontend/comp/Signup.html`)
- Authentication utilities (`Frontend/js/auth.js`)
- Page-specific handlers (`Frontend/js/login.js`, `Frontend/js/signup.js`)
- Toast notification system (`Frontend/css/notifications.css`)

## Features

### ✅ User Login

- Email and password validation
- Loading states during API calls
- JWT token storage in localStorage
- Automatic redirect to dashboard on success
- Error handling with toast notifications

### ✅ User Registration

- Company name, email, and password fields
- Password strength validation (min 8 characters)
- Email format validation
- Terms of service agreement required
- Default plan type: 'basic'
- Automatic login after successful registration

### ✅ Token Management

- Tokens stored in localStorage
- Automatic token inclusion in authenticated requests
- Token expiration handling (401 redirects)
- Logout functionality

### ✅ User Experience

- Modern toast notifications (success/error/info)
- Loading states on buttons
- Form validation
- Auto-redirect if already logged in

## API Endpoints

The frontend connects to these backend endpoints:

### Login

```
POST /api/auth/login
Body: { email, password }
Response: { success, token, user }
```

### Register

```
POST /api/auth/register
Body: { email, password, companyName, planType }
Response: { success, token, user }
```

### Get Profile (Protected)

```
GET /api/auth/profile
Headers: { Authorization: "Bearer <token>" }
Response: { success, user }
```

## Configuration

### API Base URL

The API base URL is defined in `Frontend/js/auth.js`:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

Change this to your production API URL when deploying.

### Redirect URLs

After successful authentication, users are redirected to:

```javascript
window.location.href = '../index.html';
```

Update this path to point to your actual dashboard page.

## Usage Examples

### Check if User is Logged In

```javascript
if (isAuthenticated()) {
  // User is logged in
  console.log('Token:', getAuthToken());
} else {
  // User is not logged in
  window.location.href = './comp/Login.html';
}
```

### Make Authenticated API Calls

```javascript
try {
  const response = await authenticatedFetch('/api/auth/profile');
  const data = await response.json();
  console.log('User profile:', data.user);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Logout User

```javascript
logout(); // Removes token and redirects to login
```

### Show Notifications

```javascript
showSuccess('Operation completed successfully!');
showError('Something went wrong!');
showInfo('Please note this information.');
```

## File Structure

```
Frontend/
├── comp/
│   ├── Login.html          # Login page
│   └── Signup.html         # Registration page
├── css/
│   └── notifications.css   # Toast notification styles
└── js/
    ├── auth.js             # Core auth utilities & API config
    ├── login.js            # Login form handler
    └── signup.js           # Signup form handler
```

## Testing

### 1. Start the Backend Server

```bash
cd src
node server.js
```

The server should run on `http://localhost:5000`

### 2. Open the Frontend

Open `Frontend/comp/Login.html` or `Frontend/comp/Signup.html` in your browser.

### 3. Test Registration

- Fill in all fields
- Ensure password is at least 8 characters
- Check terms and conditions
- Submit and verify you get a success message

### 4. Test Login

- Use the registered email and password
- Verify you're redirected to the dashboard
- Check browser localStorage for the auth token

## Security Considerations

### ⚠️ Current Implementation

- Tokens stored in localStorage (vulnerable to XSS)
- No HTTPS enforcement
- No CSRF protection
- Basic password validation

### 🔒 Recommended Improvements

1. Use httpOnly cookies instead of localStorage
2. Implement HTTPS in production
3. Add CSRF tokens
4. Implement stronger password policies
5. Add rate limiting on login attempts
6. Implement token refresh mechanism
7. Add two-factor authentication

## CORS Configuration

Ensure your backend has CORS properly configured in `src/server.js`:

```javascript
app.use(
  cors({
    origin: 'http://127.0.0.1:5500', // Your frontend URL
    credentials: true,
  })
);
```

## Troubleshooting

### Issue: API calls failing

- Check that the backend server is running
- Verify the API_BASE_URL is correct
- Check browser console for CORS errors
- Verify the backend CORS configuration

### Issue: Token not being saved

- Check browser localStorage in DevTools
- Verify the API response includes a token
- Check for JavaScript errors in console

### Issue: Redirects not working

- Verify the redirect paths are correct
- Check that the target pages exist
- Ensure relative paths are correct

### Issue: Notifications not showing

- Verify notifications.css is loaded
- Check for CSS conflicts
- Inspect console for JavaScript errors

## Next Steps

1. Create a protected dashboard page
2. Add profile management
3. Implement password reset functionality
4. Add email verification
5. Create admin panel
6. Add role-based access control
