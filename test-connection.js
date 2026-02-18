// test-connection.js
require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
  try {
    // Test Master DB
    await mongoose.connect(process.env.MONGO_MASTER_URI);
    console.log('✅ Master DB Connected!');
    
    // Test Tenant DB creation
    const tenantConn = mongoose.createConnection(
      `${process.env.MONGO_TENANT_BASE_URI}/pms_test_tenant`
    );
    console.log('✅ Tenant DB Connection Created!');
    
    await tenantConn.close();
    await mongoose.disconnect();
    console.log('✅ All connections closed successfully!');
    
  } catch (error) {
    console.error('❌ Connection Error:', error.message);
    process.exit(1);
  }
};

testConnection();