function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    cookies: {},
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    cookie(name, value, options = {}) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name) {
      this.clearedCookies.push(name);
      return this;
    },
  };
}

function createMockReq(overrides = {}) {
  return {
    user: {
      userId: '64f1a2b3c4d5e6f708091011',
      email: 'admin@example.com',
      companyName: 'Acme Health',
    },
    tenantModels: {},
    query: {},
    params: {},
    body: {},
    session: {},
    ...overrides,
  };
}

module.exports = {
  createMockReq,
  createMockRes,
};
