/**
 * Patients Controller
 * Handles CRUD operations for patient records in tenant databases
 */

/**
 * Get all patients for the authenticated tenant
 */
const getAllPatients = async (req, res) => {
    try {
        const Patient = req.tenantModels.Patient;

        const patients = await Patient.find({ isActive: true })
            .sort({ createdAt: -1 })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: patients.length,
            data: patients,
        });
    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patients',
            error: error.message,
        });
    }
};

/**
 * Get a single patient by ID
 */
const getPatientById = async (req, res) => {
    try {
        const Patient = req.tenantModels.Patient;
        const { id } = req.params;

        const patient = await Patient.findById(id);

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
            });
        }

        res.status(200).json({
            success: true,
            data: patient,
        });
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch patient',
            error: error.message,
        });
    }
};

/**
 * Create a new patient
 */
const createPatient = async (req, res) => {
    try {
        const Patient = req.tenantModels.Patient;
        const { firstName, lastName, email, phone, dateOfBirth, address, medicalHistory } = req.body;

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and last name are required',
            });
        }

        const patient = new Patient({
            firstName,
            lastName,
            email,
            phone,
            dateOfBirth,
            address,
            medicalHistory,
        });

        await patient.save();

        res.status(201).json({
            success: true,
            message: 'Patient created successfully',
            data: patient,
        });
    } catch (error) {
        console.error('Create patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create patient',
            error: error.message,
        });
    }
};

/**
 * Update a patient
 */
const updatePatient = async (req, res) => {
    try {
        const Patient = req.tenantModels.Patient;
        const { id } = req.params;
        const updateData = req.body;

        // Update the updatedAt timestamp
        updateData.updatedAt = new Date();

        const patient = await Patient.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Patient updated successfully',
            data: patient,
        });
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update patient',
            error: error.message,
        });
    }
};

/**
 * Delete a patient (soft delete)
 */
const deletePatient = async (req, res) => {
    try {
        const Patient = req.tenantModels.Patient;
        const { id } = req.params;

        const patient = await Patient.findByIdAndUpdate(
            id,
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Patient deleted successfully',
        });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete patient',
            error: error.message,
        });
    }
};

module.exports = {
    getAllPatients,
    getPatientById,
    createPatient,
    updatePatient,
    deletePatient,
};
