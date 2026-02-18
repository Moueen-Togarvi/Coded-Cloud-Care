const mongoose = require('mongoose');

/**
 * Hospital PMS Database Configuration
 * Separate database connection for Hospital PMS
 */

let hospitalConnection = null;

const connectHospitalDB = async () => {
    try {
        if (hospitalConnection) {
            return hospitalConnection;
        }

        const HOSPITAL_MONGO_URI = process.env.HOSPITAL_MONGO_URI || process.env.MONGO_URI;

        if (!HOSPITAL_MONGO_URI) {
            throw new Error('HOSPITAL_MONGO_URI or MONGO_URI environment variable is required');
        }

        // Create separate connection for Hospital PMS
        hospitalConnection = mongoose.createConnection(HOSPITAL_MONGO_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log('✓ Hospital PMS Database connection initializing...');

        return hospitalConnection;
    } catch (error) {
        console.error('Failed to connect to Hospital PMS database:', error.message);
        throw error;
    }
};

const getHospitalDB = () => {
    if (!hospitalConnection) {
        // If called before connectHospitalDB (e.g. at startup for models),
        // we can still return a buffered connection if we initialize it here
        const HOSPITAL_MONGO_URI = process.env.HOSPITAL_MONGO_URI || process.env.MONGO_URI;
        if (HOSPITAL_MONGO_URI) {
            hospitalConnection = mongoose.createConnection(HOSPITAL_MONGO_URI);
            return hospitalConnection;
        }
        throw new Error('Hospital PMS database not connected and no URI available');
    }
    return hospitalConnection;
};

module.exports = {
    connectHospitalDB,
    getHospitalDB,
    hospitalConnection, // Added this export
};
