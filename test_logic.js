require('dotenv').config();
const mongoose = require('mongoose');
const PsychSession = require('./src/models/PsychSession');
const HospitalPatient = require('./src/models/HospitalPatient');
const HospitalUser = require('./src/models/HospitalUser');

async function testGet() {
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const tenantId = '699966f0410aba6cd977aa4a'; // from previous db dump
        const query = { tenantId };

        const sessions = await PsychSession.find(query).sort({ date: 1 });
        console.log("Found sessions:", sessions.length);

        const patientIds = new Set();
        const psychIds = new Set();
        sessions.forEach((s) => {
            if (s.patient_ids) s.patient_ids.forEach((pid) => patientIds.add(pid));
            if (s.psychologist_id) psychIds.add(s.psychologist_id);
        });

        const patientMap = {};
        if (patientIds.size > 0) {
            const patients = await HospitalPatient.find({
                tenantId,
                _id: { $in: [...patientIds].filter((id) => id && typeof id === 'string' && id.match(/^[a-f\d]{24}$/i)) },
            });
            patients.forEach((p) => {
                patientMap[p._id.toString()] = p.name;
            });
        }

        const psychMap = {};
        if (psychIds.size > 0) {
            const users = await HospitalUser.find({
                tenantId,
                _id: { $in: [...psychIds].filter((id) => id && typeof id === 'string' && id.match(/^[a-f\d]{24}$/i)) },
            });
            users.forEach((u) => {
                psychMap[u._id.toString()] = u.name || u.username;
            });
        }

        const result = sessions.map((s) => ({
            _id: s._id.toString(),
            psychologist_id: s.psychologist_id,
            psychologist_name: psychMap[s.psychologist_id] || s.psychologist_id,
            date: s.date ? s.date.toISOString().split('T')[0] : '',
            time_slot: s.time_slot,
            patient_ids: s.patient_ids,
            patient_names: (s.patient_ids || []).map((pid) => patientMap[pid] || 'Unknown'),
            title: s.title,
            note: s.note,
            note_detail: s.note_detail,
            note_author: s.note_author,
            note_at: s.note_at ? s.note_at.toISOString() : null,
        }));

        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error(e);
    }
    mongoose.disconnect();
}
testGet();
