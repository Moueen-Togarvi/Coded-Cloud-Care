const test = require('node:test');
const assert = require('node:assert/strict');

const staffController = require('../../src/controllers/staffController');
const settingsController = require('../../src/controllers/settingsController');
const User = require('../../src/models/User');

const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createFullTenantModels } = require('../helpers/inMemoryModels');

const { createStaff, getAllStaff, updateStaff, deleteStaff } = staffController;
const { getSettings, updateSettings } = settingsController;

function stubMethod(target, key, fn) {
  const original = target[key];
  target[key] = fn;
  return () => {
    target[key] = original;
  };
}

test('Staff workflow: create, update, delete with master user sync stub', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091711',
    email: 'owner@clinic.com',
    companyName: 'Clinic Two',
    tenantDbName: 'tenant_clinic_two',
  };

  const restoreFindOne = stubMethod(User, 'findOne', async () => null);
  const restoreFindOneAndUpdate = stubMethod(User, 'findOneAndUpdate', async () => ({ isActive: false }));

  try {
    let staffId = null;

    {
      const req = createMockReq({
        user,
        tenantModels,
        body: {
          firstName: 'Sana',
          lastName: 'Iqbal',
          email: 'sana@clinic.com',
          role: 'nurse',
          phone: '+92-300-2222222',
        },
      });
      const res = createMockRes();
      await createStaff(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.loginProvisioned, false);
      staffId = res.body.data.id;
    }

    {
      const req = createMockReq({ user, tenantModels });
      const res = createMockRes();
      await getAllStaff(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 1);
    }

    {
      const req = createMockReq({
        user,
        tenantModels,
        params: { id: staffId },
        body: { role: 'lab-technician' },
      });
      const res = createMockRes();
      await updateStaff(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.role, 'lab-technician');
    }

    {
      const req = createMockReq({
        user,
        tenantModels,
        params: { id: staffId },
      });
      const res = createMockRes();
      await deleteStaff(req, res);
      assert.equal(res.statusCode, 200);
      assert.match(res.body.message, /deleted successfully/i);
    }

    {
      const req = createMockReq({ user, tenantModels });
      const res = createMockRes();
      await getAllStaff(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 0);
    }
  } finally {
    restoreFindOne();
    restoreFindOneAndUpdate();
  }
});

test('Settings workflow: default bootstrap then update persists tenant values', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091721',
    email: 'admin@carehub.com',
    companyName: 'Care Hub',
  };

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getSettings(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.clinicName, 'Care Hub');
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        clinicName: 'Care Hub Diagnostics',
        clinicPhone: '+92-300-5550000',
        labName: 'Care Hub Lab',
        isOnboardingComplete: true,
      },
    });
    const res = createMockRes();
    await updateSettings(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.clinicName, 'Care Hub Diagnostics');
    assert.equal(res.body.data.isOnboardingComplete, true);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getSettings(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.clinicName, 'Care Hub Diagnostics');
    assert.equal(res.body.data.labName, 'Care Hub Lab');
  }
});
