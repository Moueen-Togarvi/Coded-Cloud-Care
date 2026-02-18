const http = require('http');

// Configuration
const PORT = 5000; // Assuming 5000 based on standard, will adjust if server log says different
const BASE_URL = `http://localhost:${PORT}/api`;

// Test Data
const TEST_USER = {
    email: 'admin@pharmacy.com', // Need a valid user. I'll try to register one first to be safe or use this if seeded.
    password: 'password123'
};

const TEST_ITEM = {
    name: 'Test Medicine ' + Date.now(),
    category: 'Test Category',
    sku: 'SKU-' + Date.now(),
    costPrice: 10,
    sellingPrice: 15,
    quantity: 100,
    expiryDate: new Date(Date.now() + 86400000 * 365).toISOString()
};

// Helper for HTTP requests
function request(method, path, data = null, token = null) {
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

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

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

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('Starting Pharmacy Backend Tests...');

    // 1. Register (to ensure user exists) or Login
    console.log('\n--- Auth ---');
    let token = null;

    // Try Login First
    console.log('Attempting Login...');
    let loginRes = await request('POST', '/auth/login', TEST_USER);

    if (loginRes.status !== 200) {
        console.log('Login failed, trying Register...');
        // Try registering
        const registerRes = await request('POST', '/auth/register', {
            name: 'Test Admin',
            ...TEST_USER,
            role: 'admin',
            companyName: 'Test Pharmacy Inc',
            planType: 'subscription', // Valid type from seeder
            productId: 'pharmacy_module_v1' // Taking a guess or generic string, assuming validation is just presence
        });

        if (registerRes.status === 201 || registerRes.status === 200) {
            console.log('Registered successfully.');
            // Login again
            loginRes = await request('POST', '/auth/login', TEST_USER);
        } else {
            console.error('Registration failed:', registerRes.data);
            // Verify if it failed because user exists but password wrong? 
            // For now let's hope login works or reg works.
        }
    }

    if (loginRes.status === 200 && loginRes.data.success) {
        token = loginRes.data.data.token;
        console.log('Login Successful. Token obtained.');
    } else {
        console.error('CRITICAL: Authentication failed. Aborting tests.', loginRes.data);
        return;
    }

    // 2. Inventory Management
    console.log('\n--- Inventory ---');

    // Create Item
    console.log(`Creating Item: ${TEST_ITEM.name}...`);
    const createRes = await request('POST', '/pharmacy/inventory', TEST_ITEM, token);
    console.log(`Status: ${createRes.status}`, createRes.data.success ? 'Success' : 'Failed');

    let itemId = null;
    if (createRes.data.success && createRes.data.data) {
        itemId = createRes.data.data._id;
        console.log('Item Created ID:', itemId);
    }

    // Get All Items
    console.log('Fetching Inventory List...');
    const listRes = await request('GET', '/pharmacy/inventory', null, token);
    console.log(`Status: ${listRes.status}, Items Found: ${listRes.data.data ? listRes.data.data.length : 0}`);

    // Search (if implemented, or verify list contains created item)
    if (listRes.data.data) {
        const found = listRes.data.data.find(i => i._id === itemId);
        console.log('Verify Created Item in List:', found ? 'FOUND' : 'NOT FOUND');
    }

    // 3. Billing / Sales
    console.log('\n--- Sales ---');
    if (itemId) {
        const saleData = {
            medicineId: itemId,
            quantity: 2,
            customerName: 'Test Customer',
            paymentMethod: 'cash'
        };

        console.log('Recording Sale...');
        const saleRes = await request('POST', '/pharmacy/sales', saleData, token);
        console.log(`Status: ${saleRes.status}`, saleRes.data.success ? 'Success' : 'Failed');
        if (saleRes.data.success) {
            console.log('Sale ID:', saleRes.data.data.sale._id);
        }
    }

    // Get Sales History
    console.log('Fetching Sales History...');
    const salesHistoryRes = await request('GET', '/pharmacy/sales', null, token);
    console.log(`Status: ${salesHistoryRes.status}, Sales Found: ${salesHistoryRes.data.data ? salesHistoryRes.data.data.length : 0}`);

    // 4. Analytics
    console.log('\n--- Analytics ---');

    // Total Stock Value
    console.log('Fetching Inventory Value...');
    const stockValRes = await request('GET', '/pharmacy/analytics/inventory-value', null, token);
    console.log('Inventory Value Response:', stockValRes.data);

    // Low Stock
    console.log('Fetching Low Stock...');
    const lowStockRes = await request('GET', '/pharmacy/stock/low', null, token);
    console.log('Low Stock Response:', lowStockRes.data);

    // Daily Sales
    const today = new Date().toISOString().split('T')[0];
    console.log(`Fetching Sales for ${today}...`);
    const dailySalesRes = await request('GET', `/pharmacy/sales/daily/${today}`, null, token);
    console.log('Daily Sales Response:', dailySalesRes.data);

    console.log('\n--- Tests Completed ---');
}

runTests();
