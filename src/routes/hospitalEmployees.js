const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { requireHospitalAuth, requireHospitalRole } = require('../middleware/hospitalAuth');

/**
 * @route   GET /api/hospital/employees
 * @desc    Get all employees
 */
router.get('/', requireHospitalAuth, async (req, res) => {
    try {
        const employees = await Employee.find().sort({ createdAt: -1 });
        const data = employees.map((e) => ({ ...e.toObject(), _id: e._id.toString() }));
        return res.json({ success: true, employees: data });
    } catch (error) {
        console.error('Get employees error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /api/hospital/employees
 * @desc    Add an employee
 */
router.post('/', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const employee = new Employee({ ...req.body });
        await employee.save();
        return res.status(201).json({ success: true, message: 'Employee added', id: employee._id.toString() });
    } catch (error) {
        console.error('Add employee error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   PUT /api/hospital/employees/:id
 * @desc    Update an employee
 */
router.put('/:id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        const data = { ...req.body };
        delete data._id;
        await Employee.findByIdAndUpdate(req.params.id, { $set: data });
        return res.json({ success: true, message: 'Employee updated' });
    } catch (error) {
        console.error('Update employee error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   DELETE /api/hospital/employees/:id
 * @desc    Delete an employee
 */
router.delete('/:id', requireHospitalRole(['Admin']), async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Employee deleted' });
    } catch (error) {
        console.error('Delete employee error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
