// =============================
// ERP AUTH SYSTEM
// =============================

const ERP_PAGE_PERMISSION_MAP = {
  dashboard: ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "admin-approval": ["SUPERADMIN", "OWNER"],
  sticker: ["SUPERADMIN", "OWNER", "STAFF"],
  stock: ["SUPERADMIN", "OWNER", "STAFF"],
  "material-stock": ["SUPERADMIN", "OWNER", "STAFF"],
  "daily-report": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "sales-history": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  invoice: ["SUPERADMIN", "OWNER", "STAFF"],
  billing: ["SUPERADMIN", "OWNER", "STAFF"],
  return: ["SUPERADMIN", "OWNER", "STAFF"],
  process: ["SUPERADMIN", "OWNER", "STAFF"],
  "staff-management": ["SUPERADMIN", "OWNER"],
  "expense-manager": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  transaction: ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "transaction-reports": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  settings: ["SUPERADMIN", "OWNER"]
};

const ERP_MENU_PAGE_BY_HREF = {
  "dashboard.html": "dashboard",
  "admin-approval.html": "admin-approval",
  "sticker.html": "sticker",
  "stock.html": "stock",
  "material-stock.html": "material-stock",
  "daily-report.html": "daily-report",
  "sales-history.html": "sales-history",
  "invoice.html": "invoice",
  "billing.html": "billing",
  "return.html": "return",
  "process.html": "process",
  "staff-management.html": "staff-management",
  "expense-manager.html": "expense-manager",
  "transaction.html": "transaction",
  "transaction-reports.html": "transaction-reports",
  "settings.html": "settings"
};

const ERP_AUTH_TOKEN_STORAGE_KEY = "erpAuthToken";

function getLoggedInUser() {
  if (typeof window.getErpLoggedInUser === "function") {
    return window.getErpLoggedInUser();
  }

  try {
    return JSON.parse(localStorage.getItem("erpLoggedInUser")) || null;
  } catch (_) {
    return null;
  }
}

function getAuthToken() {
  if (typeof window.getErpAuthToken === "function") {
    return window.getErpAuthToken();
  }

  return String(localStorage.getItem(ERP_AUTH_TOKEN_STORAGE_KEY) || "").trim();
}

function setAuthToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) return;

  if (typeof window.setErpAuthToken === "function") {
    window.setErpAuthToken(cleanToken);
    return;
  }

  localStorage.setItem(ERP_AUTH_TOKEN_STORAGE_KEY, cleanToken);
}

function clearAuthToken() {
  if (typeof window.clearErpAuthToken === "function") {
    window.clearErpAuthToken();
    return;
  }

  localStorage.removeItem(ERP_AUTH_TOKEN_STORAGE_KEY);
}

function clearAuthSession() {
  const token = getAuthToken();

  if (typeof window.clearErpLoggedInUser === "function") {
    window.clearErpLoggedInUser();
  } else {
    localStorage.removeItem("erpLoggedInUser");
  }

  clearAuthToken();

  try {
    const logoutUrl =
      typeof window.buildErpApiUrl === "function" ? window.buildErpApiUrl("/auth/logout") : "/auth/logout";

    fetch(logoutUrl, {
      method: "POST",
      credentials: "include",
      headers: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : {}
    }).catch(() => {});
  } catch (_) {}
}

function getCurrentCompanyId() {
  const user = getLoggedInUser();
  const raw = user?.company_id ?? user?.companyId ?? null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getCurrentUserId() {
  const user = getLoggedInUser();
  const raw = user?.id ?? user?.user_id ?? user?.userId ?? null;

  if (raw === null || raw === undefined || raw === "") return null;

  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getNormalizedRole(user = null) {
  const targetUser = user || getLoggedInUser();
  const raw = String(targetUser?.role || "").trim().toLowerCase();

  if (raw === "admin") return "owner";
  if (["billing", "invoice", "sticker", "stock", "process"].includes(raw)) return "staff";
  if (["transaction", "expense"].includes(raw)) return "accounts";

  return raw;
}

function normalizeAllowedRoles(roles = []) {
  return roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean);
}

function isSuperAdmin(user = null) {
  const targetUser = user || getLoggedInUser();
  const role = getNormalizedRole(targetUser);
  const email = String(targetUser?.email || "").trim().toLowerCase();

  return role === "superadmin" || email === "grudrapratap0@gmail.com";
}

function isAdminUser(user = null) {
  const targetUser = user || getLoggedInUser();
  return getNormalizedRole(targetUser) === "owner";
}

function buildProtectedQueryString({ includeCompany = false, companyId = null } = {}) {
  const params = new URLSearchParams();
  const resolvedCompanyId =
    companyId === null || companyId === undefined ? getCurrentCompanyId() : Number(companyId);

  if (includeCompany && resolvedCompanyId !== null && !Number.isNaN(resolvedCompanyId)) {
    params.set("companyId", String(resolvedCompanyId));
  }

  return params.toString();
}

function showAccessMessage(message) {
  if (typeof window.showToast === "function") {
    window.showToast(message, "error");
  } else {
    alert(message);
  }
}

function requireLogin() {
  const user = getLoggedInUser();
  const token = getAuthToken();

  if (!user || !token) {
    clearAuthSession();
    showAccessMessage("Login required");
    window.location.href = "login.html";
    return false;
  }

  return true;
}

function requireRole(allowedRoles = []) {
  const user = getLoggedInUser();

  if (!user) {
    window.location.href = "login.html";
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  const normalizedAllowedRoles = normalizeAllowedRoles(allowedRoles);
  const userRole = getNormalizedRole(user);

  if (!normalizedAllowedRoles.includes(userRole)) {
    showAccessMessage("Access Denied");
    window.location.href = "dashboard.html";
    return false;
  }

  return true;
}

function getCurrentPageKey() {
  const pathname = String(window.location.pathname || "").split("/").pop().toLowerCase();
  return ERP_MENU_PAGE_BY_HREF[pathname] || null;
}

function canAccessPage(pageKey, user = null) {
  const targetUser = user || getLoggedInUser();
  if (!targetUser) return false;
  if (isSuperAdmin(targetUser)) return true;

  const allowedRoles = ERP_PAGE_PERMISSION_MAP[pageKey];
  if (!Array.isArray(allowedRoles) || !allowedRoles.length) return true;

  return normalizeAllowedRoles(allowedRoles).includes(getNormalizedRole(targetUser));
}

function requirePageAccess(pageKey) {
  if (!requireLogin()) return false;

  if (canAccessPage(pageKey)) {
    return true;
  }

  showAccessMessage("Access Denied");
  window.location.href = "dashboard.html";
  return false;
}

function filterSidebarMenuByRole() {
  const user = getLoggedInUser();
  const menuLinks = document.querySelectorAll(".menu a");
  const roleAwareElements = document.querySelectorAll("[data-page-key]");

  if (menuLinks.length) {
    menuLinks.forEach((link) => {
      const href = String(link.getAttribute("href") || "").trim().toLowerCase();
      const pageKey = ERP_MENU_PAGE_BY_HREF[href];
      const listItem = link.closest("li");

      if (!listItem || !pageKey) return;

      listItem.style.display = !user || canAccessPage(pageKey, user) ? "" : "none";
    });
  }

  roleAwareElements.forEach((element) => {
    if (element.closest(".menu")) return;

    const pageKey = String(element.dataset.pageKey || "").trim();
    if (!pageKey) return;

    element.style.display = !user || canAccessPage(pageKey, user) ? "" : "none";
  });
}

function patchFetchWithAuthHeader() {
  if (window.__erpFetchAuthPatched) return;
  const originalFetch = window.fetch?.bind(window);
  if (typeof originalFetch !== "function") return;

  window.fetch = function (input, init = {}) {
    const token = getAuthToken();
    const inputUrl = typeof input === "string" ? input : input?.url || "";
    const apiBase =
      typeof window.ERP_API_BASE === "string" ? String(window.ERP_API_BASE || "").trim() : "";
    const resolvedUrl =
      typeof window.buildErpApiUrl === "function" && typeof inputUrl === "string" && inputUrl.startsWith("/")
        ? window.buildErpApiUrl(inputUrl)
        : input;
    const requestUrl = typeof resolvedUrl === "string" ? resolvedUrl : resolvedUrl?.url || inputUrl || "";
    const isApiRequest = Boolean(apiBase) && String(requestUrl || "").startsWith(apiBase);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined) || {});

    if (token && isApiRequest && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return originalFetch(resolvedUrl, {
      ...init,
      credentials: init.credentials || (isApiRequest ? "include" : "same-origin"),
      headers
    });
  };

  window.__erpFetchAuthPatched = true;
}

patchFetchWithAuthHeader();
