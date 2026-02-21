const http = require('http');

const data = JSON.stringify({ email: 'admin@admin55.com', password: 'password123' });

const options = {
    hostname: 'localhost',
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

    // also grab the JWT token to bridge
    let token = null;
    res.on('data', d => {
        try {
            const auth = JSON.parse(d);
            token = auth.data.token;
        } catch (e) { }
    });

    res.on('end', () => {
        const getOptions = {
            hostname: 'localhost',
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
                console.log('HTTP Status:', res2.statusCode);
                console.log('Body:', body);
            });
        });
        req2.end();
    });
});

req.write(data);
req.end();
