# Multi-Tenant PMS - Comprehensive Testing Guide

Complete testing procedures for authentication, tenant CRUD operations, data isolation, and security verification.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication Testing](#authentication-testing)
3. [Tenant CRUD Operations](#tenant-crud-operations)
4. [Tenant Isolation Testing](#tenant-isolation-testing)
5. [Security Testing](#security-testing)
6. [Frontend Testing](#frontend-testing)
7. [Database Verification](#database-verification)

---

## Quick Start

### Prerequisites

- ✅ Node.js installed
- ✅ MongoDB running locally
- ✅ Dependencies installed (`npm install`)
- ✅ `.env` file configured
- ✅ Database seeded (`npm run seed`)

### Start the Server

```bash
npm run dev
```

### Verify Server Health

```bash
curl http://localhost:5000/health
```

**Expected Response**:
```json
{
  "success": true,
  "message": "PMS Backend is running",
  "timestamp": "2026-02-10T..."
}
```

---

## Authentication Testing

### 1. User Registration

**Endpoint**: `POST /api/auth/register`

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testclinic@example.com",
    "password": "SecurePass123!",
    "companyName": "Test Medical Clinic",
    "phone": "+1234567890",
    "address": "123 Medical St",
    "planType": "subscription",
    "productId": "hospital-pms"
  }'
```

**Verification Checklist**:
- ✅ Returns 201 status code
- ✅ Response includes JWT token
- ✅ User created in Master DB
- ✅ Tenant database created automatically
- ✅ Trial end date is 3 days from now
- ✅ `tenantDbName` follows format: `tenant_<sanitized>_<timestamp>`

### 2. User Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testclinic@example.com",
    "password": "SecurePass123!"
  }'
```

**Save the token for subsequent requests**:
```bash
TOKEN="<paste_token_here>"
```

### 3. Get User Profile

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Verification**:
- ✅ Returns user details
- ✅ Includes `productId`, `tenantDbName`, `subscriptionStatus`
- ✅ Plan information is populated

---

## Tenant CRUD Operations

### Patient Management

#### Create Patient

```bash
curl -X POST http://localhost:5000/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "dateOfBirth": "1985-05-15",
    "address": "456 Patient Ave",
    "medicalHistory": "No known allergies"
  }'
```

**Expected**: 201 Created with patient data

#### List All Patients

```bash
curl -X GET http://localhost:5000/api/patients \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: Array of patients for this tenant only

#### Get Patient by ID

```bash
PATIENT_ID="<patient_id_from_create_response>"

curl -X GET http://localhost:5000/api/patients/$PATIENT_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Patient

```bash
curl -X PUT http://localhost:5000/api/patients/$PATIENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+0987654321",
    "medicalHistory": "Updated: Seasonal allergies"
  }'
```

#### Delete Patient (Soft Delete)

```bash
curl -X DELETE http://localhost:5000/api/patients/$PATIENT_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Verification**: Patient's `isActive` set to `false`

### Appointment Management

#### Create Appointment

```bash
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "'$PATIENT_ID'",
    "appointmentDate": "2026-02-15T10:00:00Z",
    "appointmentType": "Consultation",
    "duration": 30,
    "notes": "Initial consultation"
  }'
```

#### List Appointments

```bash
curl -X GET http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN"
```

**Verification**: Appointments include populated patient info

#### Update Appointment Status

```bash
APPOINTMENT_ID="<appointment_id>"

curl -X PUT http://localhost:5000/api/appointments/$APPOINTMENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

#### Cancel Appointment

```bash
curl -X DELETE http://localhost:5000/api/appointments/$APPOINTMENT_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Staff Management

#### Add Staff Member

```bash
curl -X POST http://localhost:5000/api/staff \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Dr. Sarah",
    "lastName": "Johnson",
    "email": "sarah.johnson@clinic.com",
    "role": "doctor",
    "phone": "+1234567890"
  }'
```

#### List Staff

```bash
curl -X GET http://localhost:5000/api/staff \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tenant Isolation Testing

### Critical Test: Verify Data Isolation

**Step 1**: Create two separate tenant accounts

```bash
# Tenant 1
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic1@example.com",
    "password": "Pass123!",
    "companyName": "Clinic One",
    "planType": "subscription",
    "productId": "hospital-pms"
  }'

# Save TOKEN1 from response
TOKEN1="<tenant1_token>"

# Tenant 2
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "clinic2@example.com",
    "password": "Pass123!",
    "companyName": "Clinic Two",
    "planType": "subscription",
    "productId": "hospital-pms"
  }'

# Save TOKEN2 from response
TOKEN2="<tenant2_token>"
```

**Step 2**: Create patient for Tenant 1

```bash
curl -X POST http://localhost:5000/api/patients \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Smith",
    "email": "alice@example.com"
  }'
```

**Step 3**: Verify Tenant 2 cannot see Tenant 1's patient

```bash
curl -X GET http://localhost:5000/api/patients \
  -H "Authorization: Bearer $TOKEN2"
```

**Expected**: `{"success": true, "count": 0, "data": []}`

✅ **Verification**: Each tenant's data is completely isolated

---

## Security Testing

### 1. Test Unauthorized Access

```bash
curl -X GET http://localhost:5000/api/patients
```

**Expected**: `401 Unauthorized`

### 2. Test Invalid Token

```bash
curl -X GET http://localhost:5000/api/patients \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected**: `401 Invalid or expired token`

### 3. Test Password Hashing

Check MongoDB - passwords should be hashed with bcrypt:

```bash
# MongoDB shell
use pms_master
db.users.findOne({email: "testclinic@example.com"})
```

**Verification**: `passwordHash` should start with `$2a$10$` (bcrypt with 10 salt rounds)

### 4. Test Trial Expiry Enforcement

Manually update a user's `trialEndDate` to a past date:

```bash
# MongoDB shell
db.users.updateOne(
  {email: "testclinic@example.com"},
  {$set: {trialEndDate: new Date("2020-01-01")}}
)
```

Then attempt login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testclinic@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected**: `403 Your trial has expired`

### 5. Test Input Validation

```bash
# Missing required fields
curl -X POST http://localhost:5000/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "John"}'
```

**Expected**: `400 First name and last name are required`

---

## Frontend Testing

### Manual Browser Testing

1. **Signup Flow**
   - Navigate to: `http://localhost:5000/Frontend/comp/Signup.html?plan=subscription&planName=Hospital%20PMS&productId=hospital-pms`
   - Fill registration form
   - Verify redirection to dashboard

2. **Login Flow**
   - Navigate to: `http://localhost:5000/Frontend/comp/Login.html`
   - Login with: `success_test@example.com` / `Password123!`
   - Verify dashboard displays user info

3. **Dashboard Verification**
   - ✅ Company name displays correctly
   - ✅ Trial status badge shows "Free Trial"
   - ✅ Trial end date countdown visible
   - ✅ Tenant database name shown
   - ✅ Software name (productId) displayed

4. **Session Testing**
   - Login to dashboard
   - Close browser tab
   - Reopen dashboard URL
   - **Expected**: Redirected to login (session expired via `sessionStorage`)

---

## Database Verification

### Check Master Database

```bash
# MongoDB shell
use pms_master

# List all users
db.users.find().pretty()

# List all plans
db.plans.find().pretty()
```

### Check Tenant Database

```bash
# Use tenantDbName from user profile
use tenant_test_medical_clinic_1770743231725

# List collections
show collections
# Expected: patients, appointments, staff, settings

# List patients
db.patients.find().pretty()

# Verify isolation - check another tenant's DB
use tenant_clinic_one_1770744000000
db.patients.find().pretty()
# Should NOT show patients from other tenants
```

---

## Test Checklist

### Core Functionality
- [ ] User registration creates tenant database
- [ ] Login returns valid JWT token
- [ ] Profile endpoint requires authentication
- [ ] Patients CRUD operations work
- [ ] Appointments CRUD operations work
- [ ] Staff CRUD operations work

### Security
- [ ] Passwords hashed with bcrypt (10 salt rounds)
- [ ] Unauthorized requests return 401
- [ ] Invalid tokens rejected
- [ ] Trial expiry enforced
- [ ] Input validation prevents invalid data

### Multi-Tenancy
- [ ] Tenant data completely isolated
- [ ] Each tenant has separate database
- [ ] Database naming follows convention
- [ ] Tenant middleware switches context correctly

### Frontend
- [ ] Login redirects to dashboard
- [ ] Session expires when browser closes
- [ ] Dashboard displays correct user info
- [ ] Software-locked access enforced

---

## Troubleshooting

### "Route not found"
- Ensure server running on port 5000
- Check routes registered in `server.js`

### "Invalid token"
- Token may have expired (7 days default)
- Generate new token by logging in

### "Tenant database not found"
- Verify MongoDB is running
- Check tenant DB created during registration
- Verify `tenantDbName` in user profile

### "Cannot access patients"
- Ensure correct authentication token
- Verify middleware attached to routes

---

## Test Account

**Pre-created for quick testing**:
- Email: `success_test@example.com`
- Password: `Password123!`
- Product: `hospital-pms`
- Tenant DB: `tenant_test_hospital_1770743231725`

---

**Last Updated**: 2026-02-10
