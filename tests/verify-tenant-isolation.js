const mongoose = require('mongoose');
require('dotenv').config();
const connectionManager = require('../src/utils/ConnectionManager');

async function testIsolation() {
    try {
        console.log('--- Phase 1: Connecting to Master ---');
        await mongoose.connect(process.env.MONGO_MASTER_URI);
        console.log('Master connected.');

        const tenantA = 'tenant_a_test';
        const tenantB = 'tenant_b_test';

        console.log(`\n--- Phase 2: Getting connection for ${tenantA} ---`);
        const connA = connectionManager.getConnection(tenantA);
        const PatientA = connectionManager.getModel(tenantA, 'Patient');

        console.log(`\n--- Phase 3: Getting connection for ${tenantB} ---`);
        const connB = connectionManager.getConnection(tenantB);
        const PatientB = connectionManager.getModel(tenantB, 'Patient');

        console.log('\n--- Phase 3.5: Waiting for connections to open ---');
        await Promise.all([
            new Promise((resolve, reject) => {
                if (connA.readyState === 1) return resolve();
                connA.once('open', resolve);
                connA.once('error', reject);
            }),
            new Promise((resolve, reject) => {
                if (connB.readyState === 1) return resolve();
                connB.once('open', resolve);
                connB.once('error', reject);
            })
        ]);

        console.log('\n--- Phase 4: Verifying cross-contamination ---');
        // In Mongoose createConnection, the db name is in connection.name
        const dbNameA = connA.name;
        const dbNameB = connB.name;

        console.log('PatientA collection name:', PatientA.collection.name);
        console.log('PatientB collection name:', PatientB.collection.name);

        console.log('Connection A DB Name (connA.name):', dbNameA);
        console.log('Connection B DB Name (connB.name):', dbNameB);

        // Verification logic
        if (dbNameA !== dbNameB && dbNameA === tenantA && dbNameB === tenantB) {
            console.log('\n✅ SUCCESS: Tenant databases are isolated!');
        } else {
            console.log('\n❌ FAILURE: Tenant databases are NOT isolated or names match.');
            console.log(`Expected A: ${tenantA}, Got: ${dbNameA}`);
            console.log(`Expected B: ${tenantB}, Got: ${dbNameB}`);
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await connectionManager.closeAll();
        await mongoose.disconnect();
        process.exit();
    }
}

testIsolation();
