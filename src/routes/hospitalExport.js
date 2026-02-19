const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const HospitalPatient = require('../models/HospitalPatient');
const HospitalExpense = require('../models/HospitalExpense');
const CanteenSale = require('../models/CanteenSale');
const { requireHospitalRole } = require('../middleware/hospitalAuth');
const { calculateProratedFee, parseAmount } = require('../utils/hospitalHelpers');

/**
 * @route   POST /api/hospital/export
 * @desc    Export patients to Excel
 */
router.post('/', requireHospitalRole(['Admin', 'Doctor', 'Psychologist']), async (req, res) => {
    try {
        const { fields } = req.body || {};
        const role = req.hospitalUser.role;
        const tenantId = req.hospitalUser.tenantId;
        const isAdmin = role === 'Admin';

        const patients = await HospitalPatient.find({ tenantId }).lean();
        if (!patients.length) return res.status(404).json({ success: false, error: 'No patients found' });

        const allFields = [
            'name', 'fatherName', 'admissionDate', 'idNo', 'age', 'cnic',
            'contactNo', 'address', 'complaint', 'guardianName', 'relation',
            'drugProblem', 'maritalStatus', 'prevAdmissions', 'monthlyFee', 'createdAt',
        ];
        const sensitiveFields = ['idNo', 'cnic', 'contactNo', 'address', 'guardianName', 'relation', 'monthlyFee'];

        let exportFields = Array.isArray(fields) && fields.length > 0
            ? fields.filter((f) => allFields.includes(f))
            : allFields;

        if (!isAdmin) {
            exportFields = exportFields.filter((f) => !sensitiveFields.includes(f));
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Patients');

        // Header row
        worksheet.columns = exportFields.map((f) => ({ header: f, key: f, width: 20 }));

        // Style header
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Data rows
        patients.forEach((p) => {
            const row = {};
            exportFields.forEach((f) => {
                row[f] = p[f] !== undefined ? String(p[f] || '') : '';
            });
            worksheet.addRow(row);
        });

        // Page setup
        worksheet.pageSetup = {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="patients_export.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export patients error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/payment-records
 * @desc    Get payment records (incoming Patient Fee expenses)
 */
router.get('/payment-records', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const tenantId = req.hospitalUser.tenantId;
        const records = await HospitalExpense.find({
            tenantId,
            type: 'incoming',
            category: 'Patient Fee',
        }).sort({ date: 1 });

        const data = records.map((r) => ({
            _id: r._id.toString(),
            amount: r.amount,
            date: r.date ? r.date.toISOString().split('T')[0] : '',
            note: r.note || r.description || '',
            payment_method: r.paymentMethod || 'Cash',
            recorded_by: r.recorded_by || 'Admin',
        }));

        return res.json({ success: true, records: data });
    } catch (error) {
        console.error('Get payment records error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   GET /api/hospital/payment-records/export
 * @desc    Export payment records to Excel
 */
router.get('/payment-records/export', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const { range } = req.query;
        const today = new Date();

        let startDate;
        if (range === 'six_months') {
            startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        } else {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const tenantId = req.hospitalUser.tenantId;
        const payments = await HospitalExpense.find({
            tenantId,
            type: 'incoming',
            category: 'Patient Fee',
            date: { $gte: startDate, $lt: endDate },
        }).sort({ date: 1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payment Records');

        worksheet.columns = [
            { header: 'Patient Name', key: 'patient_name', width: 25 },
            { header: 'Amount (PKR)', key: 'amount', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Payment Mode', key: 'payment_mode', width: 15 },
            { header: 'Recorded By', key: 'recorded_by', width: 15 },
            { header: 'Note', key: 'note', width: 40 },
        ];

        // Style header
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center' };
        });

        payments.forEach((p) => {
            const note = p.note || p.description || '';
            let patientName = 'Unknown';
            if (note.includes('Partial payment from ')) {
                patientName = note.split('Partial payment from ')[1]?.split(' via ')[0] || 'Unknown';
            }
            worksheet.addRow({
                patient_name: patientName,
                amount: p.amount,
                date: p.date ? p.date.toISOString().split('T')[0] : '',
                payment_mode: p.paymentMethod || 'Cash',
                recorded_by: p.recorded_by || 'Admin',
                note,
            });
        });

        worksheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 };

        const filename = range === 'six_months' ? 'payment_records_six_months.xlsx' : 'payment_records_current_month.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export payment records error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
