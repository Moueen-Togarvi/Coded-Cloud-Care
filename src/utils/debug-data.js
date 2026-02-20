const mongoose = require('mongoose');
require('dotenv').config();
const { connectMasterDB } = require('../config/database');

const hospitalUserSchema = new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId,
    username: String,
    role: String,
    name: String,
    email: String
});
const HospitalUser = mongoose.model('HospitalUser', hospitalUserSchema);

const hospitalPatientSchema = new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String,
    isDischarged: Boolean
});
const HospitalPatient = mongoose.model('HospitalPatient', hospitalPatientSchema);

const hospitalEmployeeSchema = new mongoose.Schema({
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String
});
const HospitalEmployee = mongoose.model('HospitalEmployee', hospitalEmployeeSchema);

const run = async () => {
    await connectMasterDB();

    console.log('--- Hospital Users ---');
    const users = await HospitalUser.find({});
    console.log(`Found ${users.length} users.`);
    users.forEach(u => console.log(`- ${u.username} (${u.role}) Tenant: ${u.tenantId}`));

    console.log('\n--- Hospital Patients ---');
    const patients = await HospitalPatient.find({});
    console.log(`Found ${patients.length} patients.`);
    patients.forEach(p => console.log(`- ${p.name} (Discharged: ${p.isDischarged}) Tenant: ${p.tenantId}`));

    console.log('\n--- Hospital Employees ---');
    const employees = await HospitalEmployee.find({});
    console.log(`Found ${employees.length} employees.`);
    employees.forEach(e => console.log(`- ${e.name} (${e.role}) Tenant: ${e.tenantId}`));

    process.exit(0);
};

run();
