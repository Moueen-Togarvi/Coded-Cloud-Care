const axios = require('axios');
require('dotenv').config();

const API_BASE = 'http://localhost:5000/api';

async function testPaymentId() {
    console.log('--- Testing Payment ID Persistence ---');

    // 1. We need a token. In a real test we'd login, but here we'll assume the server is running.
    // NOTE: This test requires a valid user and plan in the DB.
    // For the sake of this environment, I'll just check if the route exists and the logic is sound.

    const testBasketId = `BKT-TEST-${Date.now()}`;
    const payload = {
        productSlug: 'pharmacy-pos',
        planType: 'monthly',
        basketId: testBasketId
    };

    console.log(`Sending payload with basketId: ${testBasketId}`);

    // We can't easily run a full integration test without a valid JWT and DB state,
    // so I will perform a check of the code logic via status check if possible,
    // or just provide the verification script for the user.
}

// Since I can't easily run the server and hit it with axios here without more setup,
// I will instead use a different verification method or ask the user to run it.
