require('dotenv').config();
const mongoose = require('mongoose');
const PsychSession = require('./src/models/PsychSession');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const sessions = await PsychSession.find({}).lean();
    console.log("ALL SESSIONS:", JSON.stringify(sessions, null, 2));
    mongoose.disconnect();
}
test();
