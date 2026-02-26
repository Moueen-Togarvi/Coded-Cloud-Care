const { MongoClient } = require('mongodb');
require('dotenv').config();

async function listDbs() {
    const uri = process.env.MONGO_TENANT_BASE_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log('Available databases:');
        dbs.databases.forEach(db => console.log(`- ${db.name}`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

listDbs();
