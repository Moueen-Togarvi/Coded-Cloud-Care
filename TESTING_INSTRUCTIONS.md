# 🧪 Testing Instructions - Quick Start Guide

## ✅ Backend Status

Your backend server is **RUNNING** on port 5000 ✓

---

## 🚀 How to Test the Application

### Step 1: Open Frontend with Live Server

**Option A: Using VS Code Live Server (Recommended)**

1. Right-click on `Frontend/comp/Signup.html`
2. Select "Open with Live Server"
3. Your browser will open at `http://127.0.0.1:5500/Frontend/comp/Signup.html`

**Option B: Direct Browser Access**

1. Open your browser
2. Navigate to: `file:///d:/Projects/PMS/Frontend/comp/Signup.html`

---

## 📝 Test Scenarios

### Test 1: User Registration

1. **Open Signup Page**
   - URL: `http://127.0.0.1:5500/Frontend/comp/Signup.html`
2. **Fill in the form:**
   - Company Name: `Test Clinic`
   - Email: `testuser@example.com` (use a unique email)
   - Password: `TestPass123!` (min 8 characters)
   - ✓ Check "I agree to Terms of Service"

3. **Click "Create Account"**

4. **Expected Result:**
   - ✅ Green toast notification: "Account created successfully!"
   - ✅ Automatic redirect to dashboard/login
   - ✅ Check browser console (F12) - no errors

---

### Test 2: User Login

1. **Open Login Page**
   - URL: `http://127.0.0.1:5500/Frontend/comp/Login.html`
   - Or click the link from signup: "Already have an account?"

2. **Fill in the form:**
   - Email: `testuser@example.com` (the email you registered with)
   - Password: `TestPass123!`

3. **Click "Sign In"**

4. **Expected Result:**
   - ✅ Green toast notification: "Login successful! Redirecting..."
   - ✅ Automatic redirect to `../index.html`
   - ✅ Token saved in localStorage

---

### Test 3: Token & Protected Routes

1. **Open Browser Console (F12)**

2. **Check localStorage:**

   ```javascript
   localStorage.getItem('authToken');
   ```

   - Should show your JWT token

3. **Test API Call:**
   ```javascript
   fetch('http://localhost:5000/api/auth/profile', {
     headers: {
       Authorization: 'Bearer ' + localStorage.getItem('authToken'),
     },
   })
     .then((r) => r.json())
     .then((d) => console.log(d));
   ```

   - Should return your user profile

---

### Test 4: Logout

1. **Open Browser Console:**

   ```javascript
   localStorage.removeItem('authToken');
   location.reload();
   ```

2. **Try to access protected routes** - should redirect to login

---

## 🔍 What to Check

### ✅ Registration Flow

- [ ] Form validation works (empty fields, email format, password length)
- [ ] Terms checkbox required
- [ ] Loading state shows "Creating Account..."
- [ ] Success toast appears
- [ ] Token saved to localStorage
- [ ] Redirect works

### ✅ Login Flow

- [ ] Form validation works
- [ ] Loading state shows "Signing In..."
- [ ] Success toast appears
- [ ] Token saved to localStorage
- [ ] Redirect works
- [ ] Invalid credentials show error

### ✅ Error Handling

- [ ] Duplicate email shows error
- [ ] Invalid credentials show error
- [ ] Network errors handled gracefully
- [ ] Error toasts appear

### ✅ UI/UX

- [ ] Toast notifications appear and auto-dismiss
- [ ] Buttons show loading state
- [ ] Forms don't submit when invalid
- [ ] Redirects happen smoothly

---

## 🐛 Troubleshooting

### Issue: "CORS Error"

**Solution:** Backend is configured for port 5500. Use Live Server or check CORS settings.

### Issue: "Failed to fetch"

**Solution:**

```bash
# Check if backend is running
Get-NetTCPConnection -LocalPort 5000
```

If not running:

```bash
npm start
```

### Issue: "Invalid plan type"

**Solution:** Plans need to be seeded. Run:

```bash
node src/seeds/planSeeder.js
```

### Issue: Toast notifications not appearing

**Solution:** Check that `notifications.css` is loaded in HTML:

```html
<link rel="stylesheet" href="../css/notifications.css" />
```

---

## 📊 Backend API Endpoints

| Method | Endpoint             | Description       | Auth Required |
| ------ | -------------------- | ----------------- | ------------- |
| GET    | `/health`            | Health check      | No            |
| POST   | `/api/auth/register` | Register new user | No            |
| POST   | `/api/auth/login`    | Login user        | No            |
| GET    | `/api/auth/profile`  | Get user profile  | Yes           |

---

## 🔐 Test Credentials

After registration, you can use:

- **Email:** Whatever you registered with
- **Password:** Whatever you used
- **Trial:** 3 days free trial automatically activated

---

## 📱 Alternative: Use the Test Page

**Open:** `Frontend/test-auth.html`

This page has built-in test buttons for:

- ✓ Backend connection test
- ✓ Registration test
- ✓ Login test
- ✓ Profile fetch test
- ✓ Logout test

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ Backend health check returns: `{"success":true,"message":"PMS Backend is running"}`
2. ✅ Registration creates user and returns token
3. ✅ Login authenticates and returns token
4. ✅ Profile endpoint returns user data with token
5. ✅ Toast notifications appear
6. ✅ Redirects work correctly
7. ✅ No console errors

---

## 🎉 Next Steps

Once testing is complete:

1. Test all pricing plan selections
2. Test dashboard functionality
3. Test session persistence (refresh page)
4. Test logout functionality
5. Test trial expiration (optional)

---

**Need Help?**

- Backend logs: Check the terminal where `npm start` is running
- Frontend errors: Open browser console (F12)
- API testing: Use the integration test: `node integration-test.js`

**Happy Testing! 🚀**
