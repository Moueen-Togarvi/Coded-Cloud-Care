const mongoose = require('mongoose');
require('dotenv').config();
const RateLimit = require('../src/models/RateLimit');

async function testRateLimiting() {
    try {
        console.log('--- Connecting to Master ---');
        await mongoose.connect(process.env.MONGO_MASTER_URI);

        const testKey = 'test_rate_limit_user';
        const maxAttempts = 3;
        const windowMs = 5000; // 5 seconds for fast testing

        console.log(`\n--- Clearing existing limit for ${testKey} ---`);
        await RateLimit.deleteOne({ key: testKey });

        console.log('\n--- Phase 1: Rapid attempts (within limit) ---');
        for (let i = 1; i <= maxAttempts; i++) {
            const result = await RateLimit.checkLimit(testKey, maxAttempts, windowMs);
            console.log(`Attempt ${i}: Allowed? ${result.allowed}, Remaining: ${result.remaining}`);
        }

        console.log('\n--- Phase 2: Exceeding limit ---');
        const failResult = await RateLimit.checkLimit(testKey, maxAttempts, windowMs);
        console.log(`Attempt ${maxAttempts + 1}: Allowed? ${failResult.allowed}, Remaining: ${failResult.remaining}`);

        if (!failResult.allowed) {
            console.log('\n✅ SUCCESS: Rate limiting is working!');
        } else {
            console.log('\n❌ FAILURE: Rate limiting failed to block at attempt 4.');
        }

        console.log('\n--- Phase 3: Waiting for window to reset ---');
        await new Promise(resolve => setTimeout(resolve, windowMs + 100));

        const resetResult = await RateLimit.checkLimit(testKey, maxAttempts, windowMs);
        console.log(`Attempt after reset: Allowed? ${resetResult.allowed}, Remaining: ${resetResult.remaining}`);

        if (resetResult.allowed) {
            console.log('✅ SUCCESS: Rate limiting reset correctly.');
        } else {
            console.log('❌ FAILURE: Rate limiting failed to reset.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

testRateLimiting();
