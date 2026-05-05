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
const ERP_SELECTED_COMPANY_STORAGE_KEY = "selectedCompanyId";
const ERP_ADMIN_ALL_COMPANY_PAGES = new Set(["admin-approval"]);

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

function getSelectedCompanyId() {
  const raw = localStorage.getItem(ERP_SELECTED_COMPANY_STORAGE_KEY);
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function setSelectedCompanyId(companyId) {
  const parsed = Number(companyId);
  if (!parsed || Number.isNaN(parsed)) {
    localStorage.removeItem(ERP_SELECTED_COMPANY_STORAGE_KEY);
    return null;
  }
  localStorage.setItem(ERP_SELECTED_COMPANY_STORAGE_KEY, String(parsed));
  return parsed;
}

function getEffectiveCompanyId() {
  return isSuperAdmin() ? getSelectedCompanyId() : getCurrentCompanyId();
}

function hasSelectedCompanyForSuperAdmin() {
  return !isSuperAdmin() || getSelectedCompanyId() !== null;
}

function getSelectedCompanyName() {
  const selectedId = getSelectedCompanyId();
  if (!selectedId) return "";
  const select = document.getElementById("superAdminCompanySelect");
  const option = select?.querySelector(`option[value="${selectedId}"]`);
  return String(option?.textContent || "").trim();
}

function isCompanySelectionRequiredForPage(pageKey = getCurrentPageKey()) {
  if (!isSuperAdmin()) return false;
  if (!pageKey) return true;
  return !ERP_ADMIN_ALL_COMPANY_PAGES.has(pageKey);
}

function showCompanySelectionBlock() {
  if (!isCompanySelectionRequiredForPage() || hasSelectedCompanyForSuperAdmin()) return;
  document.body.classList.add("superadmin-company-missing");

  if (!document.getElementById("superAdminCompanyBlock")) {
    const block = document.createElement("div");
    block.id = "superAdminCompanyBlock";
    block.innerHTML = `
      <div class="superadmin-company-block-card">
        <strong>Please select a company</strong>
      </div>
    `;
    document.body.appendChild(block);
  }

  showAccessMessage("Please select a company");
}

function clearCompanySelectionBlock() {
  document.body.classList.remove("superadmin-company-missing");
  document.getElementById("superAdminCompanyBlock")?.remove();
}

async function loadSuperAdminCompanies() {
  const params = new URLSearchParams();
  const actingUserId = getCurrentUserId();
  if (actingUserId !== null && !Number.isNaN(actingUserId)) {
    params.set("actingUserId", String(actingUserId));
  }

  const res = await fetch(`${window.ERP_API_BASE}/approvedCompanies?${params.toString()}`, {
    cache: "no-store",
    credentials: "include"
  });
  const data = await res.json();
  return Array.isArray(data.companies) ? data.companies : [];
}

async function initSuperAdminCompanySelector() {
  if (!isSuperAdmin()) return;
  const topbar = document.querySelector(".top-right");
  if (!topbar || document.getElementById("superAdminCompanySelect")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "superadmin-company-select-wrap";
  wrapper.innerHTML = `
    <select id="superAdminCompanySelect" aria-label="Select company">
      <option value="">Please select a company</option>
    </select>
  `;
  topbar.insertBefore(wrapper, topbar.firstChild);

  const select = wrapper.querySelector("select");
  try {
    const companies = await loadSuperAdminCompanies();
    select.innerHTML = `<option value="">Please select a company</option>${companies
      .map((company) => {
        const id = Number(company.id ?? company.company_id ?? company.companyId ?? 0);
        const name = String(company.company_name || company.companyName || company.name || `Company ${id}`).trim();
        return id ? `<option value="${id}">${name}</option>` : "";
      })
      .join("")}`;
    const selectedId = getSelectedCompanyId();
    if (selectedId && select.querySelector(`option[value="${selectedId}"]`)) {
      select.value = String(selectedId);
    } else if (selectedId) {
      setSelectedCompanyId("");
    }
  } catch (_) {
    select.innerHTML = `<option value="">Please select a company</option>`;
  }

  select.addEventListener("change", () => {
    setSelectedCompanyId(select.value);
    if (getSelectedCompanyId()) {
      clearCompanySelectionBlock();
      window.location.reload();
    } else {
      showCompanySelectionBlock();
    }
  });

  showCompanySelectionBlock();
}

function injectSuperAdminCompanyStyles() {
  if (document.getElementById("superAdminCompanyStyles")) return;
  const style = document.createElement("style");
  style.id = "superAdminCompanyStyles";
  style.textContent = `
    .superadmin-company-select-wrap select {
      min-height: 44px;
      border-radius: 13px;
      border: 1px solid var(--erp-border, #e3d7c3);
      background: linear-gradient(180deg, #fffdf9 0%, #fff6e8 100%);
      color: #364457;
      padding: 10px 14px;
      font-weight: 800;
      max-width: 260px;
    }
    body.superadmin-company-missing main .content,
    body.superadmin-company-missing main section.content {
      pointer-events: none;
      opacity: 0.35;
      filter: grayscale(0.1);
    }
    #superAdminCompanyBlock {
      position: fixed;
      inset: 0;
      z-index: 5000;
      display: grid;
      place-items: center;
      background: rgba(255, 250, 242, 0.74);
      backdrop-filter: blur(4px);
      pointer-events: none;
    }
    .superadmin-company-block-card {
      border: 1px solid rgba(197, 139, 43, 0.35);
      border-radius: 16px;
      background: linear-gradient(180deg, #fffdf8 0%, #fff3de 100%);
      box-shadow: 0 20px 48px rgba(82, 58, 24, 0.18);
      color: #7c5a1d;
      padding: 22px 28px;
      font-size: 18px;
      text-align: center;
    }
  `;
  document.head.appendChild(style);
}

function bootstrapSuperAdminCompanyContext() {
  injectSuperAdminCompanyStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSuperAdminCompanySelector);
  } else {
    initSuperAdminCompanySelector();
  }
}

function buildProtectedQueryString({ includeCompany = false, companyId = null } = {}) {
  const params = new URLSearchParams();
  const resolvedCompanyId =
    companyId === null || companyId === undefined ? getEffectiveCompanyId() : Number(companyId);

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
    let resolvedUrl =
      typeof window.buildErpApiUrl === "function" && typeof inputUrl === "string" && inputUrl.startsWith("/")
        ? window.buildErpApiUrl(inputUrl)
        : input;
    const requestUrl = typeof resolvedUrl === "string" ? resolvedUrl : resolvedUrl?.url || inputUrl || "";
    const isApiRequest = Boolean(apiBase) && String(requestUrl || "").startsWith(apiBase);
    const method = String(init.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();

    if (isApiRequest && isCompanySelectionRequiredForPage()) {
      const selectedCompanyId = getSelectedCompanyId();
      let apiPath = "";
      try {
        apiPath = new URL(requestUrl, window.location.origin).pathname;
      } catch (_) {}

      const canBypassCompanySelection = [
        "/approvedCompanies",
        "/pendingCompanyRequests",
        "/auth/logout"
      ].some((path) => apiPath.endsWith(path));

      if (!selectedCompanyId && !canBypassCompanySelection) {
        showCompanySelectionBlock();
        return Promise.resolve(new Response(JSON.stringify({
          success: false,
          message: "Please select a company"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }));
      }

      if (selectedCompanyId && (method === "GET" || method === "HEAD")) {
        try {
          const url = new URL(requestUrl, window.location.origin);
          if (!url.searchParams.has("companyId") && !canBypassCompanySelection) {
            url.searchParams.set("companyId", String(selectedCompanyId));
            resolvedUrl = url.toString();
          }
        } catch (_) {}
      }
    }

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
bootstrapSuperAdminCompanyContext();
