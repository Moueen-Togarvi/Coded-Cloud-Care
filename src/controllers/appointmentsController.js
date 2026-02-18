/**
 * Appointments Controller
 * Handles CRUD operations for appointment scheduling in tenant databases
 */

/**
 * Get all appointments for the authenticated tenant
 */
const getAllAppointments = async (req, res) => {
    try {
        const Appointment = req.tenantModels.Appointment;

        const appointments = await Appointment.find()
            .populate('patientId', 'firstName lastName email phone')
            .sort({ appointmentDate: -1 })
            .select('-__v');

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments,
        });
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments',
            error: error.message,
        });
    }
};

/**
 * Get a single appointment by ID
 */
const getAppointmentById = async (req, res) => {
    try {
        const Appointment = req.tenantModels.Appointment;
        const { id } = req.params;

        const appointment = await Appointment.findById(id)
            .populate('patientId', 'firstName lastName email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found',
            });
        }

        res.status(200).json({
            success: true,
            data: appointment,
        });
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment',
            error: error.message,
        });
    }
};

/**
 * Create a new appointment
 */
const createAppointment = async (req, res) => {
    try {
        const Appointment = req.tenantModels.Appointment;
        const { patientId, appointmentDate, appointmentType, duration, notes } = req.body;

        // Validate required fields
        if (!patientId || !appointmentDate) {
            return res.status(400).json({
                success: false,
                message: 'Patient ID and appointment date are required',
            });
        }

        const appointment = new Appointment({
            patientId,
            appointmentDate,
            appointmentType,
            duration,
            notes,
            status: 'scheduled',
        });

        await appointment.save();

        // Populate patient info before sending response
        await appointment.populate('patientId', 'firstName lastName email phone');

        res.status(201).json({
            success: true,
            message: 'Appointment created successfully',
            data: appointment,
        });
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create appointment',
            error: error.message,
        });
    }
};

/**
 * Update an appointment
 */
const updateAppointment = async (req, res) => {
    try {
        const Appointment = req.tenantModels.Appointment;
        const { id } = req.params;
        const updateData = req.body;

        // Update the updatedAt timestamp
        updateData.updatedAt = new Date();

        const appointment = await Appointment.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('patientId', 'firstName lastName email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Appointment updated successfully',
            data: appointment,
        });
    } catch (error) {
        console.error('Update appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update appointment',
            error: error.message,
        });
    }
};

/**
 * Cancel an appointment
 */
const cancelAppointment = async (req, res) => {
    try {
        const Appointment = req.tenantModels.Appointment;
        const { id } = req.params;

        const appointment = await Appointment.findByIdAndUpdate(
            id,
            { status: 'cancelled', updatedAt: new Date() },
            { new: true }
        ).populate('patientId', 'firstName lastName email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully',
            data: appointment,
        });
    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel appointment',
            error: error.message,
        });
    }
};

module.exports = {
    getAllAppointments,
    getAppointmentById,
    createAppointment,
    updateAppointment,
    cancelAppointment,
};
