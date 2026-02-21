const http = require('http');

const data = JSON.stringify({ email: 'admin@admin55.com', password: 'password123' });

const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    let cookies = res.headers['set-cookie'];
    let sessionCookie = cookies ? cookies.find(c => c.startsWith('connect.sid=')) : null;
    if (sessionCookie) {
        sessionCookie = sessionCookie.split(';')[0];
    }

    // also grab the JWT token
    let token = null;
    let loginBody = '';
    res.on('data', d => loginBody += d);

    res.on('end', () => {
        try {
            const auth = JSON.parse(loginBody);
            token = auth.data.token;
            console.log("Logged in successfully, token:", !!token);
        } catch (e) { }

        const getOptions = {
            hostname: '127.0.0.1',
            port: 5000,
            path: '/api/psych-sessions',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        if (sessionCookie) {
            getOptions.headers['Cookie'] = sessionCookie;
        }
        const req2 = http.request(getOptions, res2 => {
            let body = '';
            res2.on('data', d => body += d);
            res2.on('end', () => {
                console.log('GET /api/psych-sessions Status:', res2.statusCode);
                console.log('GET /api/psych-sessions Body:', body.substring(0, 500));
            });
        });
        req2.on('error', (e) => console.log('req2 error', e.message));
        req2.end();
    });
});
req.on('error', (e) => console.log('req error', e.message));
req.write(data);
req.end();
