const http = require('http');

const email = 'testpharmacy_new_07@example.com';
const password = 'password123';
const companyName = 'Test Pharmacy 7';

const signupReq = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const json = JSON.parse(data);
        const token = json.data.token;
        console.log('Signup Token:', !!token);

        if (token) {
            const settingsReq = http.request({
                hostname: 'localhost',
                port: 5000,
                path: '/api/settings',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + token }
            }, (res2) => {
                let data2 = '';
                res2.on('data', c => data2 += c);
                res2.on('end', () => console.log('Settings:', data2));
            });
            settingsReq.end();
        }
    });
});
signupReq.write(JSON.stringify({ email, password, companyName, productId: 'pharmacy-pos' }));
signupReq.end();
