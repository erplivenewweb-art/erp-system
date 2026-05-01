"use strict";

(function protectPage() {
  const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
  const AUTH_TOKEN_STORAGE_KEY = "erpAuthToken";
  const LOGGED_IN_USER_STORAGE_KEY = "erpLoggedInUser";
  const REMEMBERED_EMAIL_STORAGE_KEY = "erpRememberedEmail";

  function trimTrailingSlash(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function getConfiguredBaseOverride() {
    const metaBase = document.querySelector('meta[name="erp-api-base"]')?.content;
    const windowBase = window.ERP_API_BASE_OVERRIDE;
    const overrideBase = trimTrailingSlash(metaBase || windowBase || "");

    if (!overrideBase) return "";

    try {
      const overrideUrl = new URL(overrideBase);
      const pageHost = String(window.location.hostname || "").toLowerCase();
      const overrideHost = overrideUrl.hostname.toLowerCase();
      const isProductionPage = window.location.protocol === "https:" && pageHost !== "localhost" && pageHost !== "127.0.0.1";
      const isLocalOverride = overrideHost === "localhost" || overrideHost === "127.0.0.1";

      if (isProductionPage && isLocalOverride) {
        return "";
      }
    } catch (_) {
      return "";
    }

    return overrideBase;
  }

  function getApiBase() {
    if (!ALLOWED_PROTOCOLS.has(window.location.protocol)) {
      return "";
    }

    const overrideBase = getConfiguredBaseOverride();
    if (overrideBase) {
      return overrideBase;
    }

    return trimTrailingSlash(window.location.origin);
  }

  function getApiAvailabilityError() {
    if (!ALLOWED_PROTOCOLS.has(window.location.protocol)) {
      return "Open the ERP through the Express server URL, such as http://localhost:8080/login.html. Direct file access is not supported.";
    }

    return "";
  }

  function assertApiAvailable() {
    const errorMessage = getApiAvailabilityError();
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  }

  function buildApiUrl(pathname = "") {
    assertApiAvailable();

    const normalizedBase = getApiBase();
    const cleanPath = String(pathname || "").trim();

    if (!cleanPath) {
      return normalizedBase;
    }

    return new URL(cleanPath.replace(/^\//, ""), `${normalizedBase}/`).toString();
  }

  function getStoredAuthToken() {
    try {
      return String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function setStoredAuthToken(token) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return;

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, cleanToken);
  }

  function clearStoredAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  function getStoredLoggedInUser() {
    try {
      return JSON.parse(localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  function setStoredLoggedInUser(user) {
    localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, JSON.stringify(user || null));
  }

  function clearStoredLoggedInUser() {
    localStorage.removeItem(LOGGED_IN_USER_STORAGE_KEY);
  }

  function setRememberedEmail(email) {
    localStorage.setItem(REMEMBERED_EMAIL_STORAGE_KEY, String(email || "").trim().toLowerCase());
  }

  function clearRememberedEmail() {
    localStorage.removeItem(REMEMBERED_EMAIL_STORAGE_KEY);
  }

  window.ERP_API_BASE = getApiBase();
  window.getErpApiAvailabilityError = getApiAvailabilityError;
  window.assertErpApiAvailable = assertApiAvailable;
  window.buildErpApiUrl = buildApiUrl;
  window.getErpAuthToken = getStoredAuthToken;
  window.setErpAuthToken = setStoredAuthToken;
  window.clearErpAuthToken = clearStoredAuthToken;
  window.getErpLoggedInUser = getStoredLoggedInUser;
  window.setErpLoggedInUser = setStoredLoggedInUser;
  window.clearErpLoggedInUser = clearStoredLoggedInUser;
  window.setErpRememberedEmail = setRememberedEmail;
  window.clearErpRememberedEmail = clearRememberedEmail;

  if (typeof window.getErpApiAvailabilityError === "function") {
    const apiAvailabilityError = window.getErpApiAvailabilityError();
    if (apiAvailabilityError) {
      document.addEventListener("DOMContentLoaded", () => {
        document.body.innerHTML = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:48px auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#fff7ed;color:#7c2d12;"><h2 style="margin:0 0 12px;">Server access required</h2><p style="margin:0;line-height:1.6;">${apiAvailabilityError}</p></div>`;
      });
      return;
    }
  }

  const currentPage = String(window.location.pathname || "")
    .split("/")
    .pop()
    .toLowerCase();

  if (!currentPage || currentPage === "login.html" || currentPage === "index.html") {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("erpLoggedInUser") || "null");
    const token =
      typeof window.getErpAuthToken === "function"
        ? window.getErpAuthToken()
        : String(localStorage.getItem("erpAuthToken") || "").trim();

    if (!user || !token) {
      window.location.replace("login.html");
    }
  } catch (_) {
    window.location.replace("login.html");
  }
})();
