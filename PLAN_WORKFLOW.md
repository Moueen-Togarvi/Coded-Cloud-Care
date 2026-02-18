# 🎯 Plan Selection & Signup Workflow

## Updated Authentication Flow

The signup process now properly integrates with your pricing page!

### ✅ How It Works

1. **User visits Pricing Page** ([pricing.html](Frontend/comp/pricing.html))

   - Views available plans (Lifetime License or Pro Subscription)
   - Clicks "Buy Lifetime" or "Start Free Trial"

2. **Plan Selection**

   - Button click redirects to signup with plan info in URL
   - Example: `Signup.html?plan=subscription&planName=Pro%20Subscription`

3. **Signup Page** ([Signup.html](Frontend/comp/Signup.html))

   - Displays selected plan at the top
   - User fills in registration form
   - Plan type is automatically included in registration

4. **Backend Registration**

   - Validates plan type against database
   - Creates user account with selected plan
   - Starts 3-day free trial
   - Returns JWT token

5. **Success**
   - User is logged in automatically
   - Redirected to dashboard

### 📋 Plan Types

The system now correctly uses these plan types:

| Frontend Display | Plan Type Code | Backend Plan         |
| ---------------- | -------------- | -------------------- |
| Lifetime License | `one-time`     | Lifetime License     |
| Pro Subscription | `subscription` | Monthly Subscription |

### 🔧 Technical Details

**Pricing Page Buttons:**

```javascript
// Lifetime License
onclick = "selectPlan('one-time', 'Lifetime License')";

// Pro Subscription
onclick = "selectPlan('subscription', 'Pro Subscription')";
```

**Signup.js reads plan from URL:**

```javascript
const urlParams = new URLSearchParams(window.location.search);
const selectedPlan = urlParams.get('plan') || 'basic';
const planName = urlParams.get('planName') || 'Basic Plan';
```

**Registration includes plan:**

```javascript
body: JSON.stringify({
  email,
  password,
  companyName,
  planType: selectedPlan,
});
```

### 🧪 Testing the Flow

1. **Start Backend:**

   ```bash
   npm run dev
   ```

2. **Seed Plans (if not done already):**

   ```bash
   npm run seed
   ```

3. **Test the Flow:**
   - Open [Frontend/comp/pricing.html](Frontend/comp/pricing.html)
   - Click "Start Free Trial"
   - You should see "Selected Plan: Pro Subscription" on signup page
   - Fill in the form and register
   - Should create account with `subscription` plan type

### 📊 Plan Display

When a user clicks a pricing button, they see this on the signup page:

```
┌─────────────────────────────────────────┐
│  ✓  Selected Plan: Pro Subscription    │
└─────────────────────────────────────────┘
```

### 🎨 Customization

**Change plan display styling:**
Edit the `displaySelectedPlan()` function in [signup.js](Frontend/js/signup.js)

**Add more plans:**

1. Add plan to database using [planSeeder.js](src/seeds/planSeeder.js)
2. Add pricing card to [pricing.html](Frontend/comp/pricing.html)
3. Add button with `selectPlan('plan-type', 'Plan Name')`

### ⚠️ Important Notes

- **Plan type must exist in database** - Run `npm run seed` to create plans
- **Direct signup still works** - Defaults to 'basic' plan if no plan selected
- **Plan info shown only when coming from pricing** - Won't show for direct access

### 🔍 Troubleshooting

**Issue: "Invalid plan type" error**

- Ensure plans are seeded in database
- Check plan type matches exactly (`one-time` or `subscription`)
- Verify `npm run seed` was run successfully

**Issue: Plan not showing on signup page**

- Check URL has parameters: `?plan=subscription&planName=...`
- Verify signup.js is loaded correctly
- Check browser console for errors

**Issue: Registration fails**

- Verify backend is running
- Check MongoDB connection
- Ensure plans exist in database

### ✨ What Changed

**Files Modified:**

1. [Frontend/js/signup.js](Frontend/js/signup.js)

   - Reads plan from URL parameters
   - Displays selected plan
   - Uses selected plan in registration

2. [Frontend/comp/Signup.html](Frontend/comp/Signup.html)

   - Added `<div id="selectedPlanInfo">` for plan display

3. [Frontend/comp/pricing.html](Frontend/comp/pricing.html)
   - Updated button plan types to match backend
   - `'lifetime'` → `'one-time'`
   - `'pro'` → `'subscription'`
   - Added `selectPlan()` function

### 🚀 Next Steps

Consider adding:

- [ ] Plan comparison table
- [ ] Plan upgrade/downgrade functionality
- [ ] Payment gateway integration
- [ ] Invoice generation
- [ ] Subscription management page
- [ ] Trial expiration reminders
- [ ] Plan usage analytics

---

**The workflow is now complete and ready to use!** 🎉
