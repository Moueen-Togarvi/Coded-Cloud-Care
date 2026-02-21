require('dotenv').config();
const mongoose = require('mongoose');
const PsychSession = require('./src/models/PsychSession');

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    const sessions = await PsychSession.find();
    let updated = 0;
    for (let s of sessions) {
        if (s.date.getUTCHours() === 19) {
            s.date.setUTCHours(24);
            await s.save();
            updated++;
        }
    }
    console.log(`Migrated ${updated} psych sessions.`);
    mongoose.disconnect();
}
migrate();
