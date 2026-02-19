const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const HospitalPatient = require('../models/HospitalPatient');
const HospitalExpense = require('../models/HospitalExpense');
const CanteenSale = require('../models/CanteenSale');
const PatientRecord = require('../models/PatientRecord');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');
const { cleanInputData, calculateProratedFee, parseAmount } = require('../utils/hospitalHelpers');

/**
 * @route   GET /api/hospital/patients
 * @desc    Get all patients with canteen totals
 * @access  Private
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const patients = await HospitalPatient.find({ tenantId }).sort({ createdAt: -1 });

        // Aggregate canteen totals for all patients of this tenant
        const canteenTotals = await CanteenSale.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
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
        const tenantId = req.hospitalUser.tenantId;

        // Set defaults
        const patientData = {
            tenantId,
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

        const tenantId = req.hospitalUser.tenantId;
        const result = await HospitalPatient.findOneAndUpdate(
            { _id: req.params.id, tenantId },
            { $set: data },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Patient not found or unauthorized',
            });
        }

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
        const tenantId = req.hospitalUser.tenantId;
        const result = await HospitalPatient.findOneAndDelete({ _id: req.params.id, tenantId });

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

        const tenantId = req.hospitalUser.tenantId;
        const note = new PatientRecord({
            tenantId,
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

        const tenantId = req.hospitalUser.tenantId;
        const record = new PatientRecord({
            tenantId,
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
        const tenantId = req.hospitalUser.tenantId;
        const records = await PatientRecord.find({
            patient_id: req.params.patient_id,
            tenantId
        }).sort({ createdAt: -1 });

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

/**
 * @route   POST /api/hospital/patients/:id/payment
 * @desc    Record a patient payment and auto-log as expense
 * @access  Admin
 */
router.post('/:id/payment', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const data = cleanInputData(req.body);
        const amountPaid = parseInt(data.amount || 0);
        const paymentMethod = data.payment_method || 'Cash';
        const screenshot = data.screenshot || '';
        const tenantId = req.hospitalUser.tenantId;

        const patient = await HospitalPatient.findOne({ _id: req.params.id, tenantId });
        if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

        const currentReceived = parseAmount(patient.receivedAmount);
        const newTotal = currentReceived + amountPaid;

        await HospitalPatient.updateOne(
            { _id: req.params.id, tenantId },
            { $set: { receivedAmount: String(newTotal) } }
        );

        // Auto-log as incoming expense
        const expenseNote = `Partial payment from ${patient.name} via ${paymentMethod}`;
        const expense = new HospitalExpense({
            tenantId,
            type: 'incoming',
            amount: amountPaid,
            category: 'Patient Fee',
            description: expenseNote,
            note: expenseNote,
            paymentMethod,
            patient_id: req.params.id,
            screenshot,
            date: new Date(),
            recorded_by: req.session?.hospitalUsername || 'Admin',
            auto: true,
        });
        await expense.save();

        return res.json({ success: true, message: 'Payment recorded successfully', new_total: newTotal });
    } catch (error) {
        console.error('Patient payment error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/patients/:id/payment_history
 * @desc    Get payment history for a patient
 * @access  Admin
 */
router.get('/:id/payment_history', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const targetIdStr = req.params.id;
        const tenantId = req.hospitalUser.tenantId;

        // Ensure patient exists and belongs to tenant
        const patient = await HospitalPatient.findOne({ _id: targetIdStr, tenantId });
        if (!patient) return res.json([]);

        const targetName = (patient.name || '').trim().toLowerCase();

        const cursor = await HospitalExpense.find({
            tenantId,
            type: 'incoming',
            category: 'Patient Fee'
        }).sort({ date: 1 });

        const history = cursor.filter((doc) => {
            const docPatientId = String(doc.patient_id || '');
            if (docPatientId === targetIdStr) return true;
            const note = (doc.note || doc.description || '').toLowerCase();
            return targetName && note.includes(`from ${targetName}`);
        }).map((doc) => ({
            _id: doc._id.toString(),
            amount: doc.amount,
            date: doc.date ? doc.date.toISOString().split('T')[0] : '-',
            payment_method: doc.paymentMethod || 'Cash',
            note: doc.note || doc.description || '',
            recorded_by: doc.recorded_by || 'Admin',
        }));

        return res.json(history);
    } catch (error) {
        console.error('Payment history error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/patients/:id/discharge-bill
 * @desc    Generate discharge bill Excel
 * @access  Admin, Doctor
 */
router.get('/:id/discharge-bill', requireHospitalRole(['Admin', 'Doctor']), async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const patient = await HospitalPatient.findOne({ _id: req.params.id, tenantId }).lean();
        if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

        // Days elapsed
        let daysElapsed = 0;
        if (patient.admissionDate) {
            try {
                const admDt = new Date(patient.admissionDate);
                daysElapsed = Math.max(0, Math.floor((new Date() - admDt) / (1000 * 60 * 60 * 24)));
            } catch (_) { }
        }

        // Canteen total for this patient (isolated by tenant)
        const canteenAgg = await CanteenSale.aggregate([
            {
                $match: {
                    tenantId: new mongoose.Types.ObjectId(tenantId),
                    patient_id: new mongoose.Types.ObjectId(patient._id)
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const canteenTotal = canteenAgg[0]?.total || 0;

        const monthlyFee = calculateProratedFee(patient.monthlyFee, daysElapsed);
        const laundryAmount = patient.laundryStatus ? (patient.laundryAmount || 0) : 0;
        const receivedAmount = parseAmount(patient.receivedAmount);
        const totalCharges = monthlyFee + canteenTotal + laundryAmount;
        const balanceDue = totalCharges - receivedAmount;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Discharge Bill');

        worksheet.columns = [
            { header: 'Patient Name', key: 'patient_name', width: 20 },
            { header: 'Father Name', key: 'father_name', width: 20 },
            { header: 'CNIC', key: 'cnic', width: 18 },
            { header: 'Admission Date', key: 'admission_date', width: 18 },
            { header: 'Discharge Date', key: 'discharge_date', width: 18 },
            { header: 'Days Stayed', key: 'days_stayed', width: 12 },
            { header: 'Monthly Fee', key: 'monthly_fee', width: 14 },
            { header: 'Canteen Charges', key: 'canteen', width: 16 },
            { header: 'Laundry Charges', key: 'laundry', width: 16 },
            { header: 'Total Charges', key: 'total_charges', width: 15 },
            { header: 'Amount Paid', key: 'amount_paid', width: 14 },
            { header: 'Balance Due', key: 'balance_due', width: 14 },
        ];

        // Style header
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center', wrapText: true };
        });

        worksheet.addRow({
            patient_name: patient.name || '',
            father_name: patient.fatherName || '',
            cnic: patient.cnic || '',
            admission_date: patient.admissionDate || '',
            discharge_date: patient.dischargeDate || new Date().toISOString().split('T')[0],
            days_stayed: daysElapsed,
            monthly_fee: monthlyFee,
            canteen: canteenTotal,
            laundry: laundryAmount,
            total_charges: totalCharges,
            amount_paid: receivedAmount,
            balance_due: balanceDue,
        });

        worksheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

        const filename = `discharge_bill_${(patient.name || 'patient').replace(/\s+/g, '_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Discharge bill error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
