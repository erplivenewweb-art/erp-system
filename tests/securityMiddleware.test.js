"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const helmet = require("helmet");
const jwt = require("jsonwebtoken");

const {
  AUTH_COOKIE_NAME,
  authMiddleware,
  signAuthToken
} = require("../js/backend/authMiddleware");
const {
  CSRF_COOKIE_NAME,
  createCsrfProtection,
  createCsrfToken,
  getCsrfCookieOptions,
  getHelmetOptions,
  verifyCsrfToken
} = require("../js/backend/securityMiddleware");

const TEST_SECRET = "phase-5b1-test-secret-with-at-least-32-characters";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function runMiddleware(middleware, req) {
  const res = createResponseRecorder();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("signed CSRF token is bound to the authenticated token and secret", () => {
  const token = createCsrfToken("auth-token-a", TEST_SECRET);
  assert.equal(verifyCsrfToken(token, "auth-token-a", TEST_SECRET), true);
  assert.equal(verifyCsrfToken(token, "auth-token-b", TEST_SECRET), false);
  assert.equal(verifyCsrfToken(token, "auth-token-a", `${TEST_SECRET}-wrong`), false);
  assert.equal(verifyCsrfToken(`${token}x`, "auth-token-a", TEST_SECRET), false);
});

test("public login is not blocked when a stale authenticated cookie exists", () => {
  const middleware = createCsrfProtection({
    authCookieName: AUTH_COOKIE_NAME,
    getSecret: () => TEST_SECRET,
    ignoredPaths: ["/login"]
  });
  const result = runMiddleware(middleware, {
    method: "POST",
    path: "/login",
    headers: { cookie: `${AUTH_COOKIE_NAME}=stale-valid-session` },
    user: { userId: 1 }
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.res.statusCode, 200);
});

test("cookie-authenticated mutation rejects a missing or invalid CSRF token", () => {
  const middleware = createCsrfProtection({
    authCookieName: AUTH_COOKIE_NAME,
    getSecret: () => TEST_SECRET
  });
  const missing = runMiddleware(middleware, {
    method: "POST",
    path: "/stock/update",
    headers: { cookie: `${AUTH_COOKIE_NAME}=cookie-auth-token` },
    user: { userId: 1 }
  });
  assert.equal(missing.nextCalled, false);
  assert.equal(missing.res.statusCode, 403);
  assert.equal(missing.res.body.code, "CSRF_TOKEN_INVALID");

  const token = createCsrfToken("cookie-auth-token", TEST_SECRET);
  const invalid = runMiddleware(middleware, {
    method: "POST",
    path: "/stock/update",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=cookie-auth-token; ${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "x-csrf-token": `${token}tampered`
    },
    user: { userId: 1 }
  });
  assert.equal(invalid.nextCalled, false);
  assert.equal(invalid.res.statusCode, 403);
});

test("cookie-authenticated mutation accepts the exact signed double-submit token", () => {
  const authToken = "cookie-auth-token";
  const csrfToken = createCsrfToken(authToken, TEST_SECRET);
  const middleware = createCsrfProtection({
    authCookieName: AUTH_COOKIE_NAME,
    getSecret: () => TEST_SECRET
  });
  const result = runMiddleware(middleware, {
    method: "PATCH",
    path: "/settings",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${authToken}; ${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
      "x-csrf-token": csrfToken
    },
    user: { userId: 1 }
  });
  assert.equal(result.nextCalled, true);
});

test("cookie-authenticated logout keeps CSRF enforcement and accepts a valid token", () => {
  const authToken = "logout-cookie-auth-token";
  const csrfToken = createCsrfToken(authToken, TEST_SECRET);
  const middleware = createCsrfProtection({
    authCookieName: AUTH_COOKIE_NAME,
    getSecret: () => TEST_SECRET,
    ignoredPaths: ["/login"]
  });
  const result = runMiddleware(middleware, {
    method: "POST",
    path: "/auth/logout",
    headers: {
      cookie: `${AUTH_COOKIE_NAME}=${authToken}; ${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
      "x-csrf-token": csrfToken
    },
    user: { userId: 1 }
  });
  assert.equal(result.nextCalled, true);
});

test("explicit bearer authentication remains compatible without ambient-cookie CSRF authority", () => {
  const middleware = createCsrfProtection({
    authCookieName: AUTH_COOKIE_NAME,
    getSecret: () => TEST_SECRET
  });
  const result = runMiddleware(middleware, {
    method: "DELETE",
    path: "/resource/1",
    headers: { authorization: "Bearer explicit-api-token" },
    user: { userId: 1 }
  });
  assert.equal(result.nextCalled, true);
});

test("CSRF cookie policy is readable by the client and secure in production", () => {
  assert.deepEqual(getCsrfCookieOptions({ production: true }), {
    httpOnly: false,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000
  });
});

test("authentication accepts HS256 tokens and rejects an alternate JWT algorithm", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
  try {
    const goodToken = signAuthToken({ id: 7, role: "OWNER", company_id: 3 });
    const goodReq = { headers: { authorization: `Bearer ${goodToken}` } };
    const goodRes = createResponseRecorder();
    let goodNext = false;
    await authMiddleware(goodReq, goodRes, () => {
      goodNext = true;
    });
    assert.equal(goodNext, true);
    assert.equal(goodReq.user.userId, 7);

    const alternateToken = jwt.sign(
      { userId: 7, role: "OWNER", companyId: 3 },
      TEST_SECRET,
      { algorithm: "HS384", expiresIn: "1h" }
    );
    const badReq = { headers: { authorization: `Bearer ${alternateToken}` } };
    const badRes = createResponseRecorder();
    let badNext = false;
    await authMiddleware(badReq, badRes, () => {
      badNext = true;
    });
    assert.equal(badNext, false);
    assert.equal(badRes.statusCode, 401);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("Helmet sends safe baseline headers without enabling the legacy-breaking CSP", () => {
  const headers = new Map();
  const req = { headers: {}, socket: {} };
  const res = {
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    removeHeader(name) {
      headers.delete(String(name).toLowerCase());
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    }
  };
  let nextCalled = false;
  helmet(getHelmetOptions({ production: true }))(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.match(headers.get("strict-transport-security") || "", /max-age=31536000/);
  assert.equal(headers.has("content-security-policy"), false);
});

test("server and browser CSRF contracts use the same route, cookie, and header", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const serverSource = fs.readFileSync(path.join(root, "js", "backend", "server.js"), "utf8");
  const clientSource = fs.readFileSync(path.join(root, "js", "auth.js"), "utf8");
  assert.match(serverSource, /app\.get\("\/auth\/csrf", authMiddleware/);
  assert.match(serverSource, /"X-CSRF-Token"/);
  assert.match(serverSource, /setCsrfCookieForToken\(res, token\)/);
  assert.match(serverSource, /res\.clearCookie\([\s\S]*CSRF_COOKIE_NAME/);
  assert.match(clientSource, /buildErpApiUrl\("\/auth\/csrf"\)/);
  assert.match(clientSource, /headers\.set\("X-CSRF-Token", csrfToken\)/);
  assert.match(clientSource, /getCookieValue\("XSRF-TOKEN"\)/);
});
