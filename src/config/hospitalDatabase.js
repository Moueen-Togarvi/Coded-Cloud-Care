const mongoose = require('mongoose');

/**
 * Hospital PMS Database Configuration
 * Separate database connection for Hospital PMS
 */

let hospitalConnection = null;

const connectHospitalDB = async () => {
    try {
        if (hospitalConnection) {
            console.log('✓ Hospital PMS DB already connected');
            return hospitalConnection;
        }

        const HOSPITAL_MONGO_URI = process.env.HOSPITAL_MONGO_URI || process.env.MONGO_URI;

        if (!HOSPITAL_MONGO_URI) {
            throw new Error('HOSPITAL_MONGO_URI or MONGO_URI environment variable is required');
        }

        // Create separate connection for Hospital PMS
        hospitalConnection = await mongoose.createConnection(HOSPITAL_MONGO_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log('✓ Hospital PMS Database connected successfully');
        console.log(`✓ Database: ${hospitalConnection.name}`);

        // Handle connection events
        hospitalConnection.on('error', (err) => {
            console.error('Hospital PMS DB connection error:', err);
        });

        hospitalConnection.on('disconnected', () => {
            console.warn('Hospital PMS DB disconnected');
        });

        return hospitalConnection;
    } catch (error) {
        console.error('Failed to connect to Hospital PMS database:', error.message);
        throw error;
    }
};

const getHospitalDB = () => {
    if (!hospitalConnection) {
        throw new Error('Hospital PMS database not connected. Call connectHospitalDB() first.');
    }
    return hospitalConnection;
};

module.exports = {
    connectHospitalDB,
    getHospitalDB,
};
