const { MongoClient } = require('mongodb');
require('dotenv').config();

async function listData() {
    const uri = process.env.MONGO_MASTER_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✓ Connected to MongoDB Atlas');

        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        console.log('\n--- Databases ---');
        for (const dbInfo of dbs.databases) {
            console.log(`Database: ${dbInfo.name}`);
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            for (const col of collections) {
                console.log(`  - Collection: ${col.name}`);
                const count = await db.collection(col.name).countDocuments();
                console.log(`    (Count: ${count})`);
                if (count > 0) {
                    const sample = await db.collection(col.name).find().limit(2).toArray();
                    console.log(`    Sample: ${JSON.stringify(sample, null, 2)}`);
                }
            }
        }

    } catch (err) {
        console.error('✗ Error:', err.message);
    } finally {
        await client.close();
    }
}

listData();
