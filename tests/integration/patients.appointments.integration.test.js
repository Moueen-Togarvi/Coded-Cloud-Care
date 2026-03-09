const test = require('node:test');
const assert = require('node:assert/strict');

const patientsController = require('../../src/controllers/patientsController');
const appointmentsController = require('../../src/controllers/appointmentsController');

const { createMockReq, createMockRes } = require('../helpers/mockHttp');
const { createFullTenantModels } = require('../helpers/inMemoryModels');

const {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
} = patientsController;

const {
  createAppointment,
  getAllAppointments,
  updateAppointment,
  cancelAppointment,
} = appointmentsController;

test('Patients + Appointments full workflow works with tenant-scoped models', async () => {
  const tenantModels = createFullTenantModels();
  const user = {
    userId: '64f1a2b3c4d5e6f708091611',
    email: 'admin@clinic.com',
    companyName: 'Clinic One',
  };

  // create patient
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        firstName: 'Ali',
        lastName: 'Khan',
        email: 'ali@example.com',
        phone: '+92-300-1111111',
      },
    });
    const res = createMockRes();
    await createPatient(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(tenantModels.Patient.__data.length, 1);
  }

  const patient = tenantModels.Patient.__data[0];

  // read and update patient
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: patient._id },
    });
    const res = createMockRes();
    await getPatientById(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.firstName, 'Ali');
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: patient._id },
      body: { phone: '+92-300-9999999' },
    });
    const res = createMockRes();
    await updatePatient(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.phone, '+92-300-9999999');
  }

  // create appointment for patient
  let appointmentId = null;
  {
    const req = createMockReq({
      user,
      tenantModels,
      body: {
        patientId: patient._id,
        appointmentDate: new Date().toISOString(),
        appointmentType: 'follow-up',
        duration: 30,
      },
    });
    const res = createMockRes();
    await createAppointment(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    appointmentId = res.body.data._id;
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getAllPatients(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getAllAppointments(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
  }

  // update/cancel appointment
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: appointmentId },
      body: { notes: 'Updated by integration test' },
    });
    const res = createMockRes();
    await updateAppointment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.notes, 'Updated by integration test');
  }

  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: appointmentId },
    });
    const res = createMockRes();
    await cancelAppointment(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.status, 'cancelled');
  }

  // soft delete patient and verify filtered list
  {
    const req = createMockReq({
      user,
      tenantModels,
      params: { id: patient._id },
    });
    const res = createMockRes();
    await deletePatient(req, res);
    assert.equal(res.statusCode, 200);
  }

  {
    const req = createMockReq({ user, tenantModels });
    const res = createMockRes();
    await getAllPatients(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 0);
  }
});
