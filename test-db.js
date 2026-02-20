const mongoose = require('mongoose');
const { connectMasterDB } = require('./src/config/database');
const User = require('./src/models/User');
const { getTenantConnection } = require('./src/services/tenantService');
const { settingsSchema } = require('./src/models/tenantSchemas');

async function test() {
    await connectMasterDB();
    const latestUser = await User.findOne().sort({ createdAt: -1 });
    console.log("Latest User:", latestUser.email);
    
    // settings collection is connected via tenantId
    const connection = await getTenantConnection(latestUser.tenantDbName);
    const Settings = connection.model('Settings', settingsSchema);
    
    const settings = await Settings.findOne({ tenantId: latestUser._id });
    console.log("Settings for latest user:", settings);
    process.exit(0);
}
test();
