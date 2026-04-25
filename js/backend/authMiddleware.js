"use strict";

const jwt = require("jsonwebtoken");

const AUTH_COOKIE_NAME = "erp_auth_token";

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = decodeURIComponent(value || "");
      }
      return acc;
    }, {});
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return secret;
}

function signAuthToken(user) {
  return jwt.sign(
    {
      userId: Number(user.id),
      role: String(user.role || "").trim(),
      companyId:
        user.company_id === null || user.company_id === undefined || user.company_id === ""
          ? null
          : Number(user.company_id)
    },
    getJwtSecret(),
    {
      expiresIn: "12h"
    }
  );
}

function extractBearerToken(headerValue = "") {
  const clean = String(headerValue || "").trim();
  if (!clean.toLowerCase().startsWith("bearer ")) return "";
  return clean.slice(7).trim();
}

function getRequestToken(req) {
  const bearerToken = extractBearerToken(req.headers.authorization || "");
  if (bearerToken) return bearerToken;

  const cookies = parseCookies(req.headers.cookie || "");
  return String(cookies[AUTH_COOKIE_NAME] || "").trim();
}

function verifyToken(token) {
  return jwt.verify(String(token || "").trim(), getJwtSecret());
}

function attachUserIfPresent(req, _res, next) {
  try {
    const token = getRequestToken(req);
    if (token) {
      req.user = verifyToken(token);
    } else {
      req.user = null;
    }
  } catch (_) {
    req.user = null;
  }

  next();
}

function authMiddleware(req, res, next) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    req.user = verifyToken(token);
    return next();
  } catch (_) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }
}

function normalizeRoleValue(role = "") {
  const clean = String(role || "").trim().toUpperCase();
  if (!clean) return "";

  if (clean === "ADMIN") return "OWNER";
  if (["BILLING", "INVOICE", "STICKER", "STOCK", "PROCESS"].includes(clean)) return "STAFF";
  if (["TRANSACTION", "EXPENSE"].includes(clean)) return "ACCOUNTS";

  return clean;
}

function checkRole(allowedRoles = []) {
  const allowed = new Set(
    (Array.isArray(allowedRoles) ? allowedRoles : [])
      .map((role) => normalizeRoleValue(role))
      .filter(Boolean)
  );

  return function roleCheckMiddleware(req, res, next) {
    const role = normalizeRoleValue(req.user?.role || "");
    const email = String(req.user?.email || "").trim().toLowerCase();
    const isSuperAdmin = role === "SUPERADMIN" || email === "grudrapratap0@gmail.com";

    if (isSuperAdmin) {
      return next();
    }

    if (!allowed.size || allowed.has(role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  };
}

function requirePageAuth(req, res, next) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      return res.redirect("/login.html");
    }

    req.user = verifyToken(token);
    return next();
  } catch (_) {
    return res.redirect("/login.html");
  }
}

module.exports = {
  AUTH_COOKIE_NAME,
  attachUserIfPresent,
  authMiddleware,
  checkRole,
  normalizeRoleValue,
  requirePageAuth,
  signAuthToken
};
