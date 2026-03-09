const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const authController = require('../../src/controllers/authController');
const User = require('../../src/models/User');
const Subscription = require('../../src/models/Subscription');

const { createMockReq, createMockRes } = require('../helpers/mockHttp');

const { login, getProfile, getSession, resetPasswordWithToken } = authController;

function stubMethod(target, key, fn) {
  const original = target[key];
  target[key] = fn;
  return () => {
    target[key] = original;
  };
}

test('auth.login returns 401 when user does not exist', async () => {
  const restoreFindOne = stubMethod(User, 'findOne', async () => null);
  const req = createMockReq({ body: { email: 'missing@example.com', password: 'secret123' } });
  const res = createMockRes();

  try {
    await login(req, res);
  } finally {
    restoreFindOne();
  }

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /invalid email or password/i);
});

test('auth.login returns subscriptions and sets auth cookie on success', async () => {
  const expiredSub = {
    productSlug: 'lab-reporting',
    planType: 'trial',
    status: 'active',
    endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    save: async function save() {
      return this;
    },
  };
  const activeSub = {
    productSlug: 'quick-invoice',
    planType: 'monthly',
    status: 'active',
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    save: async function save() {
      return this;
    },
  };

  const userDoc = {
    _id: '64f1a2b3c4d5e6f708091301',
    email: 'owner@cloudcare.com',
    companyName: 'Cloud Care',
    role: 'admin',
    isActive: true,
    comparePassword: async (password) => password === 'secret123',
  };

  const restoreFindOne = stubMethod(User, 'findOne', async () => userDoc);
  const restoreSubsFind = stubMethod(Subscription, 'find', () => ({
    sort: async () => [expiredSub, activeSub],
  }));

  const req = createMockReq({ body: { email: userDoc.email, password: 'secret123' } });
  const res = createMockRes();

  try {
    await login(req, res);
  } finally {
    restoreFindOne();
    restoreSubsFind();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.cookies.authToken);
  assert.equal(res.body.data.user.email, userDoc.email);
  assert.equal(res.body.data.subscriptions.length, 2);

  const expired = res.body.data.subscriptions.find((sub) => sub.productSlug === 'lab-reporting');
  assert.equal(expired.status, 'expired');
  assert.equal(expired.isExpired, true);
});

test('auth.getProfile returns user and subscription summary', async () => {
  const userDoc = {
    _id: '64f1a2b3c4d5e6f708091401',
    email: 'admin@clinic.com',
    companyName: 'Clinic Co',
    contactInfo: { phone: '+92-300-1234567' },
    isActive: true,
    createdAt: new Date(),
  };

  const restoreFindById = stubMethod(User, 'findById', () => ({
    select: async () => userDoc,
  }));
  const restoreSubsFind = stubMethod(Subscription, 'find', () => ({
    sort: async () => [
      {
        productSlug: 'hospital-pms',
        planType: 'monthly',
        status: 'active',
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    ],
  }));

  const req = createMockReq({
    user: { userId: userDoc._id },
  });
  const res = createMockRes();

  try {
    await getProfile(req, res);
  } finally {
    restoreFindById();
    restoreSubsFind();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, userDoc.email);
  assert.equal(res.body.data.subscriptions.length, 1);
  assert.equal(res.body.data.subscriptions[0].isAccessible, true);
});

test('auth.getSession returns hospital session context when available', async () => {
  const req = createMockReq({
    session: {
      hospitalUserId: 'h-user-1',
      hospitalUsername: 'frontdesk',
      hospitalRole: 'staff',
      isMasterUser: false,
    },
  });
  const res = createMockRes();

  await getSession(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.is_logged_in, true);
  assert.equal(res.body.username, 'frontdesk');
});

test('auth.resetPasswordWithToken resets SaaS user password with valid token', async () => {
  const userDoc = {
    _id: '64f1a2b3c4d5e6f708091501',
    passwordHash: 'old-pass',
    save: async function save() {
      return this;
    },
  };
  const restoreFindById = stubMethod(User, 'findById', async () => userDoc);

  const token = jwt.sign(
    {
      userId: userDoc._id,
      purpose: 'password-reset',
      target: 'saas-user',
    },
    process.env.JWT_SECRET
  );

  const req = createMockReq({
    body: {
      token,
      new_password: 'new-pass-123',
    },
  });
  const res = createMockRes();

  try {
    await resetPasswordWithToken(req, res);
  } finally {
    restoreFindById();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(userDoc.passwordHash, 'new-pass-123');
});

test('auth.resetPasswordWithToken returns 400 for invalid token purpose', async () => {
  const token = jwt.sign(
    {
      userId: '64f1a2b3c4d5e6f708091511',
      purpose: 'login',
      target: 'saas-user',
    },
    process.env.JWT_SECRET
  );

  const req = createMockReq({
    body: {
      token,
      new_password: 'new-pass-123',
    },
  });
  const res = createMockRes();

  await resetPasswordWithToken(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /invalid reset token purpose/i);
});
