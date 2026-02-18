const express = require('express');
const router = express.Router();
const HospitalPatient = require('../models/HospitalPatient');
const CanteenSale = require('../models/CanteenSale');
const PatientRecord = require('../models/PatientRecord');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');
const { cleanInputData } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/patients
 * @desc    Get all patients with canteen totals
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const patients = await HospitalPatient.find().sort({ createdAt: -1 });

        // Aggregate canteen totals for all patients
        const canteenTotals = await CanteenSale.aggregate([
            { $group: { _id: '$patient_id', total: { $sum: '$amount' } } },
        ]);

        const canteenMap = {};
        canteenTotals.forEach((item) => {
            canteenMap[item._id.toString()] = item.total;
        });

        // Add canteen spending to each patient
        const patientsData = patients.map((patient) => {
            const patientObj = patient.toObject();
            patientObj._id = patient._id.toString();
            patientObj.canteenSpent = canteenMap[patient._id.toString()] || 0;
            return patientObj;
        });

        return res.json({
            success: true,
            patients: patientsData,
        });
    } catch (error) {
        console.error('Get patients error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/patients
 * @desc    Add new patient (Admin/Doctor only)
 * @access  Private (Admin/Doctor)
 */
router.post('/', requireHospitalRole(['Admin', 'Doctor']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);

        // Set defaults
        const patientData = {
            ...data,
            notes: [],
            monthlyFee: data.monthlyFee || '0',
            receivedAmount: data.receivedAmount || '0',
            drug: data.drug || '',
            photo1: data.photo1 || '',
            photo2: data.photo2 || '',
            photo3: data.photo3 || '',
            isDischarged: data.isDischarged || false,
            dischargeDate: data.dischargeDate || null,
            laundryStatus: data.laundryStatus || false,
            laundryAmount: data.laundryStatus ? parseInt(data.laundryAmount || 3500) : 0,
        };

        const newPatient = new HospitalPatient(patientData);
        await newPatient.save();

        return res.status(201).json({
            success: true,
            message: 'Success',
            id: newPatient._id.toString(),
        });
    } catch (error) {
        console.error('Add patient error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   PUT /api/hospital/patients/:id
 * @desc    Update patient (Admin/Doctor only)
 * @access  Private (Admin/Doctor)
 */
router.put('/:id', requireHospitalRole(['Admin', 'Doctor']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        delete data._id; // Remove _id if present

        // Only Admin can modify sensitive/financial fields
        const currentRole = req.hospitalUser.role;
        if (currentRole !== 'Admin') {
            const sensitiveFields = [
                'monthlyFee',
                'laundryStatus',
                'laundryAmount',
                'cnic',
                'contactNo',
                'guardianName',
                'relation',
                'address',
            ];
            sensitiveFields.forEach((field) => delete data[field]);
        }

        await HospitalPatient.findByIdAndUpdate(req.params.id, { $set: data });

        return res.json({
            success: true,
            message: 'Updated',
        });
    } catch (error) {
        console.error('Update patient error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   DELETE /api/hospital/patients/:id
 * @desc    Delete patient (Admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const result = await HospitalPatient.findByIdAndDelete(req.params.id);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found',
            });
        }

        // Delete associated records
        await PatientRecord.deleteMany({ patient_id: req.params.id });

        return res.json({
            success: true,
            message: 'Patient deleted successfully',
        });
    } catch (error) {
        console.error('Delete patient error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/patients/:patient_id/session_note
 * @desc    Add session note (Admin/Psychologist)
 * @access  Private (Admin/Psychologist)
 */
router.post('/:patient_id/session_note', requireHospitalRole(['Admin', 'Psychologist']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);

        const note = new PatientRecord({
            patient_id: req.params.patient_id,
            record_type: 'session_note',
            content: data.text,
            created_by: req.hospitalUser.username,
        });

        await note.save();

        return res.status(201).json({
            success: true,
            message: 'Session note added',
            id: note._id.toString(),
        });
    } catch (error) {
        console.error('Add session note error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   POST /api/hospital/patients/:patient_id/medical_record
 * @desc    Add medical record (Admin/Doctor)
 * @access  Private (Admin/Doctor)
 */
router.post('/:patient_id/medical_record', requireHospitalRole(['Admin', 'Doctor']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);

        const record = new PatientRecord({
            patient_id: req.params.patient_id,
            record_type: 'medical_record',
            content: JSON.stringify({ title: data.title, details: data.details }),
            created_by: req.hospitalUser.username,
        });

        await record.save();

        return res.status(201).json({
            success: true,
            message: 'Medical record added',
            id: record._id.toString(),
        });
    } catch (error) {
        console.error('Add medical record error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * @route   GET /api/hospital/patients/:patient_id/records
 * @desc    Get all records for a patient
 * @access  Private
 */
router.get('/:patient_id/records', requireHospitalAuth, async (req, res) => {
    try {
        const records = await PatientRecord.find({ patient_id: req.params.patient_id }).sort({ createdAt: -1 });

        const recordsData = records.map((record) => ({
            _id: record._id.toString(),
            patient_id: record.patient_id,
            record_type: record.record_type,
            content: record.content,
            created_by: record.created_by,
            date: record.createdAt.toISOString(),
        }));

        return res.json({
            success: true,
            records: recordsData,
        });
    } catch (error) {
        console.error('Get patient records error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
        });
    }
});

module.exports = router;
