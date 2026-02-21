const http = require('http');

async function testApi() {
    const loginData = JSON.stringify({ email: 'admin@admin55.com', password: 'password123' });

    const loginReq = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData)
        }
    }, (res) => {
        let rawCookies = res.headers['set-cookie'];
        if (!rawCookies) {
            console.log('No cookies received');
            return;
        }
        const token = rawCookies.find(c => c.includes('token=')).split(';')[0].split('=')[1];

        // Now make the request to psych-sessions with Authorization header
        const req2 = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/psych-sessions',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, (res2) => {
            let data = '';
            res2.on('data', chunk => data += chunk);
            res2.on('end', () => {
                console.log('Response status:', res2.statusCode);
                console.log('Response body:', data);
            });
        });

        req2.end();
    });

    loginReq.write(loginData);
    loginReq.end();
}

testApi();
