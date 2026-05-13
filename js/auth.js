// =============================
// ERP AUTH SYSTEM
// =============================

const ERP_PAGE_PERMISSION_MAP = {
  dashboard: ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "production-dashboard": ["SUPERADMIN", "OWNER", "STAFF"],
  "sales-dashboard": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
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
  "profit-report": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "branch-transfer": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-receive": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-transfer-history": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-shortage-report": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-analytics": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "transfer-ageing-report": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "shortage-analytics": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "stock-movement-ledger": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-reconciliation": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-audit-dashboard": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-snapshots": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-reconciliation-runs": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-exception-queue": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  settings: ["SUPERADMIN", "OWNER"]
};

const ERP_MENU_PAGE_BY_HREF = {
  "dashboard.html": "dashboard",
  "production-dashboard.html": "production-dashboard",
  "sales-dashboard.html": "sales-dashboard",
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
  "profit-report.html": "profit-report",
  "branch-transfer.html": "branch-transfer",
  "branch-receive.html": "branch-receive",
  "branch-transfer-history.html": "branch-transfer-history",
  "branch-shortage-report.html": "branch-shortage-report",
  "branch-analytics.html": "branch-analytics",
  "transfer-ageing-report.html": "transfer-ageing-report",
  "shortage-analytics.html": "shortage-analytics",
  "stock-movement-ledger.html": "stock-movement-ledger",
  "branch-reconciliation.html": "branch-reconciliation",
  "branch-audit-dashboard.html": "branch-audit-dashboard",
  "branch-snapshots.html": "branch-snapshots",
  "branch-reconciliation-runs.html": "branch-reconciliation-runs",
  "branch-exception-queue.html": "branch-exception-queue",
  "settings.html": "settings"
};

const ERP_AUTH_TOKEN_STORAGE_KEY = "erpAuthToken";
const ERP_SELECTED_COMPANY_STORAGE_KEY = "selectedCompanyId";
const ERP_NAVIGATION_MODE_STORAGE_KEY = "erpNavigationMode";
const ERP_ALL_COMPANIES_VALUE = "__ALL__";
const ERP_ADMIN_ALL_COMPANY_PAGES = new Set(["admin-approval"]);
const ERP_COMPANY_REQUIRED_PAGES = new Set(["process", "billing", "stock", "sticker", "transaction"]);
const ERP_NAVIGATION_MODES = {
  production: {
    label: "Production",
    defaultHref: "production-dashboard.html"
  },
  sales: {
    label: "Store",
    defaultHref: "sales-dashboard.html"
  }
};
const ERP_NAVIGATION_ITEMS = [
  { mode: "production", pageKey: "production-dashboard", href: "production-dashboard.html", label: "Production Dashboard", icon: "fas fa-chart-pie" },
  { mode: "production", pageKey: "process", href: "process.html", label: "Process", icon: "fas fa-screwdriver-wrench" },
  { mode: "production", pageKey: "sticker", href: "sticker.html", label: "Sticker", icon: "fas fa-barcode" },
  { mode: "production", pageKey: "material-stock", href: "material-stock.html", label: "Material Stock", icon: "fas fa-box-open" },
  { mode: "production", pageKey: "staff-management", href: "staff-management.html", label: "Staff Management", icon: "fas fa-users" },
  { mode: "production", pageKey: "expense-manager", href: "expense-manager.html", label: "Expense Manager", icon: "fas fa-wallet" },
  { mode: "production", pageKey: "settings", href: "settings.html", label: "Settings", icon: "fas fa-gear" },
  { mode: "production", pageKey: "admin-approval", href: "admin-approval.html", label: "Admin Approval", icon: "fas fa-user-check" },
  { mode: "sales", pageKey: "sales-dashboard", href: "sales-dashboard.html", label: "Store Dashboard", icon: "fas fa-store" },
  { mode: "sales", pageKey: "stock", href: "stock.html", label: "Stock", icon: "fas fa-boxes-stacked" },
  { mode: "sales", pageKey: "billing", href: "billing.html", label: "Billing", icon: "fas fa-money-bill-wave" },
  { mode: "sales", pageKey: "invoice", href: "invoice.html", label: "Invoice", icon: "fas fa-file-invoice" },
  { mode: "sales", pageKey: "return", href: "return.html", label: "Return", icon: "fas fa-rotate-left" },
  { mode: "sales", pageKey: "sales-history", href: "sales-history.html", label: "Sales History", icon: "fas fa-clock-rotate-left" },
  { mode: "sales", pageKey: "daily-report", href: "daily-report.html", label: "Daily Report", icon: "fas fa-chart-line" },
  { mode: "sales", pageKey: "transaction", href: "transaction.html", label: "Transaction", icon: "fas fa-arrow-right-arrow-left" },
  { mode: "sales", pageKey: "transaction-reports", href: "transaction-reports.html", label: "Transaction Reports", icon: "fas fa-file-lines" },
  { mode: "sales", pageKey: "profit-report", href: "profit-report.html", label: "Profit Loss", icon: "fas fa-coins" },
  { mode: "sales", pageKey: "branch-transfer", href: "branch-transfer.html", label: "Branch Transfer", icon: "fas fa-truck-ramp-box" },
  { mode: "sales", pageKey: "branch-receive", href: "branch-receive.html", label: "Branch Receive", icon: "fas fa-barcode" },
  { mode: "sales", pageKey: "branch-transfer-history", href: "branch-transfer-history.html", label: "Transfer History", icon: "fas fa-route" },
  { mode: "sales", pageKey: "branch-shortage-report", href: "branch-shortage-report.html", label: "Shortage Report", icon: "fas fa-triangle-exclamation" },
  { mode: "sales", pageKey: "branch-analytics", href: "branch-analytics.html", label: "Branch Analytics", icon: "fas fa-chart-simple" },
  { mode: "sales", pageKey: "transfer-ageing-report", href: "transfer-ageing-report.html", label: "Transfer Ageing", icon: "fas fa-hourglass-half" },
  { mode: "sales", pageKey: "shortage-analytics", href: "shortage-analytics.html", label: "Shortage Analytics", icon: "fas fa-circle-exclamation" },
  { mode: "sales", pageKey: "stock-movement-ledger", href: "stock-movement-ledger.html", label: "Movement Ledger", icon: "fas fa-timeline" },
  { mode: "sales", pageKey: "branch-reconciliation", href: "branch-reconciliation.html", label: "Reconciliation", icon: "fas fa-scale-balanced" },
  { mode: "sales", pageKey: "branch-audit-dashboard", href: "branch-audit-dashboard.html", label: "Audit Dashboard", icon: "fas fa-shield-halved" },
  { mode: "sales", pageKey: "branch-snapshots", href: "branch-snapshots.html", label: "Stock Snapshots", icon: "fas fa-camera-retro" },
  { mode: "sales", pageKey: "branch-reconciliation-runs", href: "branch-reconciliation-runs.html", label: "Audit Runs", icon: "fas fa-clipboard-check" },
  { mode: "sales", pageKey: "branch-exception-queue", href: "branch-exception-queue.html", label: "Exception Queue", icon: "fas fa-list-check" },
  { mode: "sales", pageKey: "settings", href: "settings.html", label: "Settings", icon: "fas fa-gear" }
];

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

function getAllowedNavigationModes(user = getLoggedInUser()) {
  if (!user) return ["production", "sales"];
  if (isSuperAdmin(user) || isAdminUser(user)) return ["production", "sales"];

  const normalizedRole = getNormalizedRole(user);
  const rawRole = String(user?.role || "").trim().toLowerCase();

  if (normalizedRole === "accounts") {
    return ["production", "sales"];
  }

  if (["billing", "invoice"].includes(rawRole)) {
    return ["sales"];
  }

  if (["process", "sticker"].includes(rawRole)) {
    return ["production"];
  }

  if (rawRole === "stock") {
    return ["sales"];
  }

  return ["production", "sales"];
}

function getPageNavigationMode(pageKey = getCurrentPageKey()) {
  const item = ERP_NAVIGATION_ITEMS.find((entry) => entry.pageKey === pageKey);
  return item?.mode || "";
}

function getStoredNavigationMode() {
  const mode = String(localStorage.getItem(ERP_NAVIGATION_MODE_STORAGE_KEY) || "").trim();
  return ERP_NAVIGATION_MODES[mode] ? mode : "";
}

function setNavigationMode(mode) {
  if (!ERP_NAVIGATION_MODES[mode]) return "";
  localStorage.setItem(ERP_NAVIGATION_MODE_STORAGE_KEY, mode);
  return mode;
}

function getCurrentNavigationMode(user = getLoggedInUser()) {
  const allowedModes = getAllowedNavigationModes(user);
  const pageMode = getPageNavigationMode();
  if (pageMode && allowedModes.includes(pageMode)) {
    setNavigationMode(pageMode);
    return pageMode;
  }

  const storedMode = getStoredNavigationMode();
  if (storedMode && allowedModes.includes(storedMode)) return storedMode;

  const fallback = allowedModes[0] || "production";
  setNavigationMode(fallback);
  return fallback;
}

function switchErpNavigationMode(mode) {
  if (!ERP_NAVIGATION_MODES[mode]) return;
  setNavigationMode(mode);

  const currentPageMode = getPageNavigationMode();
  if (currentPageMode !== mode) {
    window.location.href = ERP_NAVIGATION_MODES[mode].defaultHref;
    return;
  }

  filterSidebarMenuByRole();
}

function getSelectedCompanyId() {
  const raw = localStorage.getItem(ERP_SELECTED_COMPANY_STORAGE_KEY);
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw === ERP_ALL_COMPANIES_VALUE) return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSelectedCompanyValue() {
  return String(localStorage.getItem(ERP_SELECTED_COMPANY_STORAGE_KEY) || "").trim();
}

function isAllCompaniesSelected() {
  return isSuperAdmin() && getSelectedCompanyValue() === ERP_ALL_COMPANIES_VALUE;
}

function setSelectedCompanyId(companyId) {
  if (String(companyId || "").trim() === ERP_ALL_COMPANIES_VALUE) {
    localStorage.setItem(ERP_SELECTED_COMPANY_STORAGE_KEY, ERP_ALL_COMPANIES_VALUE);
    return ERP_ALL_COMPANIES_VALUE;
  }

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
  return !isSuperAdmin() || getSelectedCompanyValue() !== "";
}

function getSelectedCompanyName() {
  if (isAllCompaniesSelected()) return "Super Admin (All Companies)";
  const selectedId = getSelectedCompanyId();
  if (!selectedId) return "";
  const select = document.getElementById("superAdminCompanySelect");
  const option = select?.querySelector(`option[value="${selectedId}"]`);
  return String(option?.textContent || "").trim();
}

function isCompanySelectionRequiredForPage(pageKey = getCurrentPageKey()) {
  if (!isSuperAdmin()) return false;
  if (!pageKey) return true;
  return ERP_COMPANY_REQUIRED_PAGES.has(pageKey);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderCompanyOptions(companies = []) {
  return `<option value="${ERP_ALL_COMPANIES_VALUE}">Super Admin (All Companies)</option><option value="">Please select a company</option>${companies
    .map((company) => {
      const id = Number(company.id ?? company.company_id ?? company.companyId ?? 0);
      const name = String(company.company_name || company.companyName || company.name || `Company ${id}`).trim();
      return id ? `<option value="${id}">${escapeHtml(name)}</option>` : "";
    })
    .join("")}`;
}

function applySelectedCompanyToSelect(select) {
  if (!select) return;
  if (isAllCompaniesSelected() && select.querySelector(`option[value="${ERP_ALL_COMPANIES_VALUE}"]`)) {
    select.value = ERP_ALL_COMPANIES_VALUE;
    return;
  }

  const selectedValue = getSelectedCompanyValue();
  if (!selectedValue && isSuperAdmin() && select.querySelector(`option[value="${ERP_ALL_COMPANIES_VALUE}"]`)) {
    setSelectedCompanyId(ERP_ALL_COMPANIES_VALUE);
    select.value = ERP_ALL_COMPANIES_VALUE;
    return;
  }

  const selectedId = getSelectedCompanyId();
  if (selectedId && select.querySelector(`option[value="${selectedId}"]`)) {
    select.value = String(selectedId);
  } else {
    select.value = select.querySelector(`option[value="${ERP_ALL_COMPANIES_VALUE}"]`) ? ERP_ALL_COMPANIES_VALUE : "";
    if (selectedId) setSelectedCompanyId("");
  }
}

function handleSuperAdminCompanyChange(value) {
  setSelectedCompanyId(value);
  clearCompanySelectionBlock();
  clearCompanySelectionWarning();

  if (isCompanySelectionRequiredForPage() && !getSelectedCompanyId()) {
    showCompanySelectionBlock();
    return;
  }

  if (!isCompanySelectionRequiredForPage() && !getSelectedCompanyId()) {
    showCompanySelectionWarning();
  }

  window.location.reload();
}

async function populateSuperAdminCompanySelect(select) {
  if (!select) return [];
  const companies = await loadSuperAdminCompanies();
  select.innerHTML = renderCompanyOptions(companies);
  applySelectedCompanyToSelect(select);
  return companies;
}

function showCompanySelectionBlock() {
  if (!isCompanySelectionRequiredForPage() || getSelectedCompanyId()) return;
  document.body.classList.add("superadmin-company-missing");

  if (!document.getElementById("superAdminCompanyBlock")) {
    const block = document.createElement("div");
    block.id = "superAdminCompanyBlock";
    block.innerHTML = `
      <div class="superadmin-company-block-card">
        <strong>Please select a company to continue</strong>
      </div>
    `;
    document.body.appendChild(block);
  }

  showAccessMessage("Please select a company to continue");
}

function clearCompanySelectionBlock() {
  document.body.classList.remove("superadmin-company-missing");
  document.getElementById("superAdminCompanyBlock")?.remove();
}

function showCompanySelectionWarning() {
  if (!isSuperAdmin() || isCompanySelectionRequiredForPage() || ERP_ADMIN_ALL_COMPANY_PAGES.has(getCurrentPageKey())) return;
  if (getSelectedCompanyId()) return;

  const topbar = document.querySelector(".topbar");
  if (!topbar || document.getElementById("superAdminCompanyWarning")) return;

  const warning = document.createElement("div");
  warning.id = "superAdminCompanyWarning";
  warning.textContent = "Select a company to use ERP modules";
  topbar.insertAdjacentElement("afterend", warning);
}

function clearCompanySelectionWarning() {
  document.getElementById("superAdminCompanyWarning")?.remove();
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
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Company list could not be loaded. Please refresh.");
  }
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
    await populateSuperAdminCompanySelect(select);
  } catch (_) {
    select.innerHTML = `<option value="${ERP_ALL_COMPANIES_VALUE}">Super Admin (All Companies)</option><option value="">Please select a company</option>`;
    applySelectedCompanyToSelect(select);
    showAccessMessage("Company list could not be loaded. Please refresh.");
  }

  select.addEventListener("change", () => {
    handleSuperAdminCompanyChange(select.value);
  });

  showCompanySelectionBlock();
  showCompanySelectionWarning();
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
    body.superadmin-company-missing .topbar {
      position: relative;
      z-index: 6001;
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
      display: grid;
      gap: 14px;
      min-width: min(420px, calc(100vw - 36px));
    }
    #superAdminCompanyWarning {
      margin: 0 24px 16px;
      border: 1px solid rgba(197, 139, 43, 0.34);
      border-radius: 14px;
      background: linear-gradient(180deg, #fffaf0 0%, #fff3de 100%);
      color: #8a5a12;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 800;
      box-shadow: 0 10px 28px rgba(82, 58, 24, 0.08);
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

function injectNavigationModeStyles() {
  if (document.getElementById("erpNavigationModeStyles")) return;
  const style = document.createElement("style");
  style.id = "erpNavigationModeStyles";
  style.textContent = `
    body.erp-mode-production {
      --erp-mode-accent: #c58b2b;
      --erp-mode-accent-dark: #6f4f16;
      --erp-mode-soft: #fffaf1;
      --erp-mode-border: #eadfca;
      --erp-mode-ink: #2f2a21;
    }
    body.erp-mode-sales {
      --erp-mode-accent: #b8901f;
      --erp-mode-accent-dark: #2b2a27;
      --erp-mode-soft: #fffdf8;
      --erp-mode-border: #decfb8;
      --erp-mode-ink: #2b2a27;
    }
    body.erp-mode-production .topbar,
    body.erp-mode-sales .topbar {
      border-bottom: 1px solid var(--erp-mode-border);
    }
    body.erp-mode-production .topbar {
      background: linear-gradient(180deg, #fffdf8 0%, #ffffff 100%);
    }
    body.erp-mode-sales .topbar {
      background: linear-gradient(180deg, #fffaf1 0%, #ffffff 100%);
    }
    body.erp-mode-production .title p,
    body.erp-mode-sales .title p {
      color: var(--erp-mode-accent-dark);
      font-weight: 700;
    }
    body.erp-mode-production .menu a.active,
    body.erp-mode-sales .menu a.active {
      background: rgba(255, 255, 255, 0.16);
      border-left: 4px solid var(--erp-mode-accent);
    }
    body.erp-mode-production .menu a:hover,
    body.erp-mode-sales .menu a:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .sidebar .erp-mode-switch {
      display: none !important;
    }
    .erp-mode-switch {
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--erp-mode-border);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.82);
      box-shadow: 0 8px 22px rgba(46, 42, 36, 0.08);
      align-items: center;
      flex-shrink: 0;
    }
    .erp-mode-btn {
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #5f5a50;
      min-height: 34px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 900;
      padding: 0 13px;
      white-space: nowrap;
    }
    .erp-mode-btn.active {
      background: linear-gradient(180deg, #e8bd73 0%, #c58b2b 100%);
      color: #fff;
      box-shadow: 0 7px 16px rgba(197, 139, 43, 0.24);
    }
    body.erp-mode-sales .erp-mode-btn.active {
      background: linear-gradient(180deg, #f4dfaa 0%, #a98735 100%);
      color: #211f1a;
    }
    @media (max-width: 780px) {
      .erp-mode-switch {
        order: 10;
        width: 100%;
      }
      .erp-mode-btn {
        min-height: 38px;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderNavigationModeSwitch(mode, allowedModes) {
  document.querySelectorAll(".sidebar .erp-mode-switch").forEach((switcher) => switcher.remove());

  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  let switcher = topbar.querySelector(".erp-mode-switch");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.className = "erp-mode-switch";
    const topRight = topbar.querySelector(".top-right");
    if (topRight && topRight.parentElement === topbar) {
      topbar.insertBefore(switcher, topRight);
    } else {
      topbar.appendChild(switcher);
    }
  }

  if (allowedModes.length <= 1) {
    switcher.style.display = "none";
    return;
  }

  switcher.style.display = "";
  switcher.innerHTML = allowedModes.map((itemMode) => `
    <button class="erp-mode-btn ${itemMode === mode ? "active" : ""}" type="button" onclick="switchErpNavigationMode('${itemMode}')">
      ${itemMode === "production" ? "Production" : "Store"}
    </button>
  `).join("");
}

function updateSidebarModeLabel(mode) {
  const brandText = document.querySelector(".sidebar .brand p");
  if (!brandText) return;
  brandText.textContent = mode === "sales" ? "Store Mode" : "Production Mode";
}

function renderModeAwareMenu(menu, user, mode, allowedModes) {
  const currentPage = getCurrentPageKey();
  const items = ERP_NAVIGATION_ITEMS.filter((item) =>
    item.mode === mode && allowedModes.includes(item.mode) && canAccessPage(item.pageKey, user)
  );

  menu.innerHTML = items.map((item) => `
    <li>
      <a href="${item.href}" class="${item.pageKey === currentPage ? "active" : ""}">
        <i class="${item.icon}"></i> ${item.label}
      </a>
    </li>
  `).join("");
}

function filterSidebarMenuByRole() {
  const user = getLoggedInUser();
  const menuLinks = document.querySelectorAll(".menu a");
  const roleAwareElements = document.querySelectorAll("[data-page-key]");
  const menus = document.querySelectorAll(".menu");
  const allowedModes = getAllowedNavigationModes(user);
  const mode = getCurrentNavigationMode(user);

  document.body.classList.toggle("erp-mode-production", mode === "production");
  document.body.classList.toggle("erp-mode-sales", mode === "sales");
  document.body.dataset.erpNavigationMode = mode;
  injectNavigationModeStyles();
  renderNavigationModeSwitch(mode, allowedModes);
  updateSidebarModeLabel(mode);

  if (menus.length) {
    menus.forEach((menu) => {
      renderModeAwareMenu(menu, user, mode, allowedModes);
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
          message: "Please select a company to continue"
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
