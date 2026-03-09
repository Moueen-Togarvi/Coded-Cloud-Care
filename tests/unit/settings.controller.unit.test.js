const test = require('node:test');
const assert = require('node:assert/strict');

const settingsController = require('../../src/controllers/settingsController');
const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createInMemoryModel } = require('../helpers/inMemoryModels');

const { getSettings, updateSettings } = settingsController;

test('getSettings creates default settings for new tenant', async () => {
  const Settings = createInMemoryModel([]);

  const req = createMockReq({
    user: {
      userId: '64f1a2b3c4d5e6f708091011',
      companyName: 'Care Diagnostics',
      email: 'owner@care.com',
    },
    tenantModels: { Settings },
  });
  const res = createMockRes();

  await getSettings(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.clinicName, 'Care Diagnostics');
  assert.equal(res.body.data.pharmacyName, 'Care Diagnostics Pharmacy');
  assert.equal(res.body.data.isOnboardingComplete, false);
  assert.equal(Settings.__data.length, 1);
});

test('updateSettings upserts and returns updated payload', async () => {
  const Settings = createInMemoryModel([]);

  const req = createMockReq({
    user: {
      userId: '64f1a2b3c4d5e6f708091012',
      companyName: 'Cloud Care',
      email: 'admin@cloudcare.com',
    },
    body: {
      clinicName: 'Cloud Care Lab',
      clinicPhone: '+92-300-0000000',
      isOnboardingComplete: true,
    },
    tenantModels: { Settings },
  });
  const res = createMockRes();

  await updateSettings(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.clinicName, 'Cloud Care Lab');
  assert.equal(res.body.data.isOnboardingComplete, true);
  assert.equal(Settings.__data.length, 1);
});
