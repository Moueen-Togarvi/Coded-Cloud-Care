const express = require('express');
const router = express.Router();
const PsychSession = require('../models/PsychSession');
const HospitalPatient = require('../models/HospitalPatient');
const HospitalUser = require('../models/HospitalUser');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/psych-sessions
 * @desc    List psych sessions (filtered by role)
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const { start, end, psychologistId } = req.query;
        const role = req.session?.hospitalRole;
        const userId = req.session?.hospitalUserId;

        const query = {};

        if (start || end) {
            query.date = {};
            if (start) query.date.$gte = new Date(start);
            if (end) {
                const endDate = new Date(end);
                endDate.setDate(endDate.getDate() + 1);
                query.date.$lt = endDate;
            }
        }

        if (role === 'Psychologist') {
            query.psychologist_id = userId;
        } else if (psychologistId) {
            query.psychologist_id = psychologistId;
        }

        const sessions = await PsychSession.find(query).sort({ date: 1 });

        // Enrich with patient names and psychologist names
        const patientIds = new Set();
        const psychIds = new Set();
        sessions.forEach((s) => {
            s.patient_ids.forEach((pid) => patientIds.add(pid));
            if (s.psychologist_id) psychIds.add(s.psychologist_id);
        });

        const patientMap = {};
        if (patientIds.size > 0) {
            const patients = await HospitalPatient.find({
                _id: { $in: [...patientIds].filter((id) => id.match(/^[a-f\d]{24}$/i)) },
            });
            patients.forEach((p) => {
                patientMap[p._id.toString()] = p.name;
            });
        }

        const psychMap = {};
        if (psychIds.size > 0) {
            const users = await HospitalUser.find({
                _id: { $in: [...psychIds].filter((id) => id.match(/^[a-f\d]{24}$/i)) },
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
            patient_names: s.patient_ids.map((pid) => patientMap[pid] || 'Unknown'),
            title: s.title,
            note: s.note,
            note_detail: s.note_detail,
            note_author: s.note_author,
            note_at: s.note_at ? s.note_at.toISOString() : null,
        }));

        return res.json(result);
    } catch (error) {
        console.error('List psych sessions error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/psych-sessions
 * @desc    Create a psych session
 */
router.post('/', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const { date, time_slot, psychologist_id, patient_ids, title } = req.body;

        if (!date || !psychologist_id || !patient_ids?.length) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        const dateVal = new Date(date);
        dateVal.setHours(0, 0, 0, 0);

        const session = new PsychSession({
            psychologist_id,
            date: dateVal,
            time_slot: time_slot || '',
            patient_ids,
            title: title || '',
            created_by: req.session?.hospitalUsername,
        });

        await session.save();
        return res.json({ success: true, message: 'Session created', id: session._id.toString() });
    } catch (error) {
        console.error('Create psych session error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/psych-sessions/:session_id/note
 * @desc    Add note to a psych session
 */
router.post('/:session_id/note', requireHospitalRole(['Admin', 'Psychologist']), async (req, res) => {
    try {
        const { note, issue, intervention, response } = req.body;

        let noteText = note?.trim() || '';
        let noteDetail = null;

        if (issue && intervention && response) {
            noteText = `Issue: ${issue}\nIntervention: ${intervention}\nResponse: ${response}`;
            noteDetail = { issue, intervention, response };
        } else if (!noteText) {
            return res.status(400).json({ success: false, error: 'Issue, intervention, and response are required' });
        }

        const sessionDoc = await PsychSession.findById(req.params.session_id);
        if (!sessionDoc) return res.status(404).json({ success: false, error: 'Session not found' });
        if (sessionDoc.note) return res.status(409).json({ success: false, error: 'Note already saved' });

        await PsychSession.findByIdAndUpdate(req.params.session_id, {
            $set: {
                note: noteText,
                note_detail: noteDetail,
                note_author: req.session?.hospitalUsername,
                note_at: new Date(),
            },
        });

        return res.json({ success: true, message: 'Note saved' });
    } catch (error) {
        console.error('Add psych session note error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
