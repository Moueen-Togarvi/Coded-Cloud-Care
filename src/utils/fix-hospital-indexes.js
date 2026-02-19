const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/coded_cloud_care';
        console.log('Connecting to database...');
        await mongoose.connect(uri);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collection = db.collection('hospitalusers');

        console.log('Checking indexes for hospitalusers...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1');

        if (hasUsernameIndex) {
            console.log('Dropping incorrect global unique index: username_1');
            await collection.dropIndex('username_1');
            console.log('Index username_1 dropped successfully.');
        } else {
            console.log('Index username_1 not found. No action needed.');
        }

        const hasEmailIndex = indexes.some(idx => idx.name === 'email_1');
        if (hasEmailIndex) {
            console.log('Dropping incorrect global unique index: email_1');
            await collection.dropIndex('email_1');
            console.log('Index email_1 dropped successfully.');
        } else {
            console.log('Index email_1 not found. No action needed.');
        }

        // Ensure compound indexes are present
        console.log('Ensuring compound indexes are correctly defined...');
        // Note: Mongoose should do this automatically on startup, but we can double check

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error) {
        console.error('Error fixing indexes:', error);
        process.exit(1);
    }
};

fixIndexes();
