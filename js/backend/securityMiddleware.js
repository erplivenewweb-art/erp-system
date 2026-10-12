"use strict";

const crypto = require("crypto");

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_VERSION = "v1";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      const name = part.slice(0, separator).trim();
      const rawValue = part.slice(separator + 1);
      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch (_) {
        cookies[name] = rawValue;
      }
      return cookies;
    }, {});
}

function getBearerToken(req) {
  const authorization = String(req?.headers?.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function getCookieAuthToken(req, authCookieName) {
  const cookies = parseCookies(req?.headers?.cookie || "");
  return String(cookies[authCookieName] || "").trim();
}

function getRequestAuthToken(req, authCookieName) {
  return getBearerToken(req) || getCookieAuthToken(req, authCookieName);
}

function getCsrfSignaturePayload(nonce, authToken) {
  const authDigest = crypto.createHash("sha256").update(String(authToken || "")).digest("base64url");
  return `${CSRF_TOKEN_VERSION}.${nonce}.${authDigest}`;
}

function createCsrfToken(authToken, secret) {
  const cleanAuthToken = String(authToken || "").trim();
  const cleanSecret = String(secret || "").trim();
  if (!cleanAuthToken || !cleanSecret) {
    throw new Error("Authenticated token and CSRF signing secret are required");
  }

  const nonce = crypto.randomBytes(32).toString("base64url");
  const signature = crypto
    .createHmac("sha256", cleanSecret)
    .update(getCsrfSignaturePayload(nonce, cleanAuthToken))
    .digest("base64url");
  return `${CSRF_TOKEN_VERSION}.${nonce}.${signature}`;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyCsrfToken(token, authToken, secret) {
  const cleanToken = String(token || "");
  const parts = cleanToken.split(".");
  if (parts.length !== 3 || parts[0] !== CSRF_TOKEN_VERSION || !parts[1] || !parts[2]) return false;

  const expectedSignature = crypto
    .createHmac("sha256", String(secret || "").trim())
    .update(getCsrfSignaturePayload(parts[1], String(authToken || "").trim()))
    .digest("base64url");
  return constantTimeEqual(parts[2], expectedSignature);
}

function sendCsrfError(res) {
  return res.status(403).json({
    success: false,
    code: "CSRF_TOKEN_INVALID",
    message: "Invalid or missing CSRF token"
  });
}

function createCsrfProtection({ authCookieName, getSecret, ignoredPaths = [] }) {
  if (!authCookieName || typeof getSecret !== "function") {
    throw new Error("CSRF protection requires an auth cookie name and secret provider");
  }

  const ignoredPathSet = new Set(
    (Array.isArray(ignoredPaths) ? ignoredPaths : [])
      .map((pathname) => String(pathname || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return function csrfProtection(req, res, next) {
    const method = String(req.method || "GET").toUpperCase();
    const requestPath = String(req.path || req.url || "").split("?")[0].trim().toLowerCase();
    // Public authentication/bootstrap routes cannot possess an authenticated
    // CSRF context yet. A stale login cookie must not make them protected.
    if (ignoredPathSet.has(requestPath)) return next();
    if (!UNSAFE_METHODS.has(method) || !req.user) return next();

    // Explicit bearer authentication is not ambient browser authority and is
    // not vulnerable to CSRF. Cookie-only mutations must pass this check.
    if (getBearerToken(req)) return next();

    const authToken = getCookieAuthToken(req, authCookieName);
    const cookies = parseCookies(req.headers?.cookie || "");
    const cookieToken = String(cookies[CSRF_COOKIE_NAME] || "");
    const headerToken = String(req.headers?.[CSRF_HEADER_NAME] || "");
    if (
      !authToken ||
      !cookieToken ||
      !headerToken ||
      !constantTimeEqual(cookieToken, headerToken) ||
      !verifyCsrfToken(headerToken, authToken, getSecret())
    ) {
      return sendCsrfError(res);
    }

    return next();
  };
}

function getCsrfCookieOptions({ production = false } = {}) {
  return {
    httpOnly: false,
    secure: Boolean(production),
    sameSite: production ? "None" : "Lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000
  };
}

function getClearCsrfCookieOptions(options = {}) {
  const clearOptions = { ...options };
  delete clearOptions.maxAge;
  return clearOptions;
}

function getHelmetOptions({ production = false } = {}) {
  return {
    // The legacy ERP uses inline scripts/styles. Default CSP would break them
    // until a separate nonce-based migration is completed.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    hsts: production
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: "no-referrer" }
  };
}

module.exports = {
  CSRF_COOKIE_NAME,
  createCsrfProtection,
  createCsrfToken,
  getBearerToken,
  getClearCsrfCookieOptions,
  getCookieAuthToken,
  getCsrfCookieOptions,
  getHelmetOptions,
  getRequestAuthToken,
  parseCookies,
  verifyCsrfToken
};
