const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const TEST_USER = {
    email: 'test_' + Date.now() + '@access.com',
    password: 'password123',
    companyName: 'Access Test Inc',
    planType: 'subscription',
    productId: 'pharmacy-pos' // This user is registered for pharmacy
};

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function runTests() {
    console.log('--- Verifying Product-Specific Access Control ---');

    // 1. Register a user for Pharmacy
    console.log(`\n1. Registering user for PRODUCT: ${TEST_USER.productId}...`);
    const regRes = await request('POST', '/auth/register', TEST_USER);
    if (regRes.status === 201 || regRes.status === 200) {
        console.log('✓ Registration successful.');
    } else {
        console.error('✗ Registration failed:', regRes.data);
        return;
    }

    // 2. Attempt login for WRONG product (Hospital PMS)
    console.log('\n2. Attempting login for WRONG product (hospital-pms)...');
    const wrongLoginRes = await request('POST', '/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password,
        productId: 'hospital-pms'
    });

    if (wrongLoginRes.status === 403) {
        console.log('✓ Success: Access denied as expected (403 Forbidden).');
        console.log('  Message:', wrongLoginRes.data.message);
    } else {
        console.error(`✗ Failure: Expected 403 Forbidden but got ${wrongLoginRes.status}.`);
        console.log('  Data:', wrongLoginRes.data);
    }

    // 3. Attempt login for RIGHT product (Pharmacy POS)
    console.log('\n3. Attempting login for RIGHT product (pharmacy-pos)...');
    const rightLoginRes = await request('POST', '/auth/login', {
        email: TEST_USER.email,
        password: TEST_USER.password,
        productId: 'pharmacy-pos'
    });

    if (rightLoginRes.status === 200) {
        console.log('✓ Success: Login successful (200 OK).');
    } else {
        console.error(`✗ Failure: Expected 200 OK but got ${rightLoginRes.status}.`);
        console.log('  Data:', rightLoginRes.data);
    }

    console.log('\n--- Verification Completed ---');
}

runTests();
