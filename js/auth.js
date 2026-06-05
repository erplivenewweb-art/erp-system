// =============================
// ERP AUTH SYSTEM
// =============================

const ERP_PAGE_PERMISSION_MAP = {
  dashboard: ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "production-dashboard": ["SUPERADMIN", "OWNER", "STAFF"],
  "sales-dashboard": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "admin-approval": ["SUPERADMIN", "OWNER"],
  "company-plans": ["SUPERADMIN"],
  "company-package-enforcement": ["SUPERADMIN"],
  "enforcement-qa-dashboard": ["SUPERADMIN"],
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
  "customer-ledger": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-cash-book": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "transaction-summary-dashboard": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "transaction-reversal": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "payment-accounts": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "account-ledger": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "daily-closing": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "profit-report": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "lot-commercial-analytics": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "barcode-lifecycle": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "reconciliation-dashboard": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
  "branch-transfer": ["SUPERADMIN", "OWNER", "STAFF", "ACCOUNTS"],
  "branch-management": ["SUPERADMIN", "OWNER", "ACCOUNTS"],
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
  "backup-health": ["OWNER"],
  settings: ["SUPERADMIN", "OWNER"]
};

const ERP_MENU_PAGE_BY_HREF = {
  "dashboard.html": "dashboard",
  "production-dashboard.html": "production-dashboard",
  "sales-dashboard.html": "sales-dashboard",
  "admin-approval.html": "admin-approval",
  "company-plans.html": "company-plans",
  "company-package-enforcement.html": "company-package-enforcement",
  "enforcement-qa-dashboard.html": "enforcement-qa-dashboard",
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
  "customer-ledger.html": "customer-ledger",
  "branch-cash-book.html": "branch-cash-book",
  "transaction-summary-dashboard.html": "transaction-summary-dashboard",
  "transaction-reversal.html": "transaction-reversal",
  "payment-accounts.html": "payment-accounts",
  "account-ledger.html": "account-ledger",
  "daily-closing.html": "daily-closing",
  "profit-report.html": "profit-report",
  "lot-commercial-analytics.html": "lot-commercial-analytics",
  "barcode-lifecycle.html": "barcode-lifecycle",
  "reconciliation-dashboard.html": "reconciliation-dashboard",
  "branch-transfer.html": "branch-transfer",
  "branch-management.html": "branch-management",
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
  "backup-health.html": "backup-health",
  "settings.html": "settings"
};

const ERP_AUTH_TOKEN_STORAGE_KEY = "erpAuthToken";
const ERP_SELECTED_COMPANY_STORAGE_KEY = "selectedCompanyId";
const ERP_NAVIGATION_MODE_STORAGE_KEY = "erpNavigationMode";
const ERP_ALL_COMPANIES_VALUE = "__ALL__";
const ERP_MODULE_PREVIEW_EVENT = "erp:module-preview-context";
const ERP_MODULE_BLOCKED_STORAGE_KEY = "erpModuleAccessBlocked";
const ERP_ADMIN_ALL_COMPANY_PAGES = new Set(["admin-approval"]);
const ERP_SUPERADMIN_ALWAYS_VISIBLE_PAGES = new Set(["admin-approval", "company-plans", "company-package-enforcement", "enforcement-qa-dashboard"]);
const ERP_COMPANY_REQUIRED_PAGES = new Set(["process", "billing", "stock", "sticker", "transaction", "transaction-reports", "customer-ledger", "branch-cash-book", "transaction-summary-dashboard", "transaction-reversal", "payment-accounts", "account-ledger", "daily-closing", "branch-management", "reconciliation-dashboard", "lot-commercial-analytics", "barcode-lifecycle"]);
const ERP_BRANCH_MANAGER_PAGE_KEYS = new Set([
  "sales-dashboard",
  "stock",
  "billing",
  "invoice",
  "return",
  "sales-history",
  "daily-report",
  "transaction",
  "transaction-reports",
  "customer-ledger",
  "branch-cash-book",
  "account-ledger",
  "daily-closing",
  "profit-report",
  "branch-receive",
  "branch-transfer-history"
]);
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
const ERP_NAVIGATION_GROUPS = {
  accounting: {
    label: "Transactions",
    icon: "fas fa-scale-balanced"
  },
  branch: {
    label: "Branch",
    icon: "fas fa-code-branch"
  }
};
const ERP_NAVIGATION_ITEMS = [
  { mode: "production", pageKey: "production-dashboard", href: "production-dashboard.html", label: "Production Dashboard", icon: "fas fa-chart-pie", moduleKey: "PRODUCTION_REPORTS" },
  { mode: "production", pageKey: "process", href: "process.html", label: "Process", icon: "fas fa-screwdriver-wrench", moduleKey: "PROCESS" },
  { mode: "production", pageKey: "sticker", href: "sticker.html", label: "Sticker", icon: "fas fa-barcode", moduleKey: "STICKER" },
  { mode: "production", pageKey: "material-stock", href: "material-stock.html", label: "Material Stock", icon: "fas fa-box-open", moduleKey: "MATERIAL_STOCK" },
  { mode: "production", pageKey: "staff-management", href: "staff-management.html", label: "Staff Management", icon: "fas fa-users", moduleKey: "STAFF_MANAGEMENT" },
  { mode: "production", pageKey: "expense-manager", href: "expense-manager.html", label: "Expense Manager", icon: "fas fa-wallet", moduleKey: "EXPENSE" },
  { mode: "production", pageKey: "settings", href: "settings.html", label: "Settings", icon: "fas fa-gear", moduleKey: "SETTINGS" },
  { mode: "production", pageKey: "admin-approval", href: "admin-approval.html", label: "Admin Approval", icon: "fas fa-user-check", moduleKey: "ADMIN_APPROVAL" },
  { mode: "production", pageKey: "company-plans", href: "company-plans.html", label: "Company Plans", icon: "fas fa-layer-group", moduleKey: "ADMIN_APPROVAL" },
  { mode: "production", pageKey: "company-package-enforcement", href: "company-package-enforcement.html", label: "Package Enforcement", icon: "fas fa-building-shield", moduleKey: "ADMIN_APPROVAL" },
  { mode: "production", pageKey: "enforcement-qa-dashboard", href: "enforcement-qa-dashboard.html", label: "Enforcement QA", icon: "fas fa-shield-halved", moduleKey: "ADMIN_APPROVAL" },
  { mode: "sales", pageKey: "sales-dashboard", href: "sales-dashboard.html", label: "Store Dashboard", icon: "fas fa-store", moduleKey: "STORE" },
  { mode: "sales", pageKey: "stock", href: "stock.html", label: "Stock", icon: "fas fa-boxes-stacked", moduleKey: "STOCK" },
  { mode: "sales", pageKey: "billing", href: "billing.html", label: "Billing", icon: "fas fa-money-bill-wave", moduleKey: "BILLING" },
  { mode: "sales", pageKey: "invoice", href: "invoice.html", label: "Invoice", icon: "fas fa-file-invoice", moduleKey: "INVOICE" },
  { mode: "sales", pageKey: "return", href: "return.html", label: "Return", icon: "fas fa-rotate-left", moduleKey: "RETURN" },
  { mode: "sales", pageKey: "sales-history", href: "sales-history.html", label: "Sales History", icon: "fas fa-clock-rotate-left", moduleKey: "SALES" },
  { mode: "sales", pageKey: "daily-report", href: "daily-report.html", label: "Daily Report", icon: "fas fa-chart-line", moduleKey: "DAILY_REPORT" },
  { mode: "sales", group: "accounting", pageKey: "transaction", href: "transaction.html", label: "Transaction", icon: "fas fa-arrow-right-arrow-left", moduleKey: "TRANSACTION" },
  { mode: "sales", group: "accounting", pageKey: "transaction-summary-dashboard", href: "transaction-summary-dashboard.html", label: "Transaction Dashboard", icon: "fas fa-chart-line", moduleKey: "TRANSACTION_REPORTS" },
  { mode: "sales", group: "accounting", pageKey: "transaction-reports", href: "transaction-reports.html", label: "Transaction Reports", icon: "fas fa-file-lines", moduleKey: "TRANSACTION_REPORTS" },
  { mode: "sales", group: "accounting", pageKey: "customer-ledger", href: "customer-ledger.html", label: "Customer Ledger", icon: "fas fa-book", moduleKey: "CUSTOMER_LEDGER" },
  { mode: "sales", group: "accounting", pageKey: "branch-cash-book", href: "branch-cash-book.html", label: "Branch Cash Book", icon: "fas fa-cash-register", moduleKey: "BRANCH_CASH_BOOK" },
  { mode: "sales", group: "accounting", pageKey: "account-ledger", href: "account-ledger.html", label: "Account Ledger", icon: "fas fa-book-open", moduleKey: "PAYMENT_ACCOUNTS" },
  { mode: "sales", group: "accounting", pageKey: "payment-accounts", href: "payment-accounts.html", label: "Payment Accounts", icon: "fas fa-wallet", moduleKey: "PAYMENT_ACCOUNTS" },
  { mode: "sales", group: "accounting", pageKey: "daily-closing", href: "daily-closing.html", label: "Daily Closing", icon: "fas fa-lock", moduleKey: "DAILY_CLOSING" },
  { mode: "sales", group: "accounting", pageKey: "transaction-reversal", href: "transaction-reversal.html", label: "Transaction Reversal", icon: "fas fa-rotate-left", moduleKey: "TRANSACTION_REVERSAL" },
  { mode: "sales", pageKey: "profit-report", href: "profit-report.html", label: "Profit Loss", icon: "fas fa-coins", moduleKey: "PROFIT_REPORT" },
  { mode: "sales", pageKey: "lot-commercial-analytics", href: "lot-commercial-analytics.html", label: "Lot Commercial Analytics", icon: "fas fa-chart-line", moduleKey: "PROFIT_REPORT" },
  { mode: "sales", pageKey: "barcode-lifecycle", href: "barcode-lifecycle.html", label: "Barcode Lifecycle", icon: "fas fa-timeline", moduleKey: "AUDIT" },
  { mode: "sales", pageKey: "reconciliation-dashboard", href: "reconciliation-dashboard.html", label: "ERP Health Check", icon: "fas fa-heart-pulse", moduleKey: "AUDIT" },
  { mode: "sales", pageKey: "backup-health", href: "backup-health.html", label: "Backup Health", icon: "fas fa-database", moduleKey: "BACKUP_HEALTH" },
  { mode: "sales", group: "branch", pageKey: "branch-management", href: "branch-management.html", label: "Branch Management", icon: "fas fa-code-branch", moduleKey: "BRANCH" },
  { mode: "sales", group: "branch", pageKey: "branch-transfer", href: "branch-transfer.html", label: "Branch Transfer", icon: "fas fa-truck-ramp-box", moduleKey: "BRANCH_TRANSFER" },
  { mode: "sales", group: "branch", pageKey: "branch-receive", href: "branch-receive.html", label: "Branch Receive", icon: "fas fa-barcode", moduleKey: "BRANCH_RECEIVE" },
  { mode: "sales", group: "branch", pageKey: "branch-transfer-history", href: "branch-transfer-history.html", label: "Transfer History", icon: "fas fa-route", moduleKey: "BRANCH_TRANSFER" },
  { mode: "sales", group: "branch", pageKey: "branch-shortage-report", href: "branch-shortage-report.html", label: "Shortage Report", icon: "fas fa-triangle-exclamation", moduleKey: "BRANCH_TRANSFER" },
  { mode: "sales", group: "branch", pageKey: "branch-analytics", href: "branch-analytics.html", label: "Branch Analytics", icon: "fas fa-chart-simple", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "transfer-ageing-report", href: "transfer-ageing-report.html", label: "Transfer Ageing", icon: "fas fa-hourglass-half", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "shortage-analytics", href: "shortage-analytics.html", label: "Shortage Analytics", icon: "fas fa-circle-exclamation", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "stock-movement-ledger", href: "stock-movement-ledger.html", label: "Stock Movement Ledger", icon: "fas fa-timeline", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "branch-reconciliation", href: "branch-reconciliation.html", label: "Branch Reconciliation", icon: "fas fa-scale-balanced", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "branch-audit-dashboard", href: "branch-audit-dashboard.html", label: "Branch Audit Dashboard", icon: "fas fa-shield-halved", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "branch-snapshots", href: "branch-snapshots.html", label: "Branch Snapshots", icon: "fas fa-camera-retro", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "branch-reconciliation-runs", href: "branch-reconciliation-runs.html", label: "Reconciliation Runs", icon: "fas fa-clipboard-check", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", group: "branch", pageKey: "branch-exception-queue", href: "branch-exception-queue.html", label: "Exception Queue", icon: "fas fa-list-check", moduleKey: "BRANCH_AUDIT" },
  { mode: "sales", pageKey: "settings", href: "settings.html", label: "Settings", icon: "fas fa-gear", moduleKey: "SETTINGS" }
];
const ERP_PAGE_MODULE_KEYS = {
  dashboard: "DASHBOARD"
};

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
  if (["branchmanager", "branch_manager", "storemanager", "store_manager"].includes(raw)) return "staff";
  if (["billing", "invoice", "sticker", "stock", "process"].includes(raw)) return "staff";
  if (["transaction", "expense"].includes(raw)) return "accounts";

  return raw;
}

function isBranchManagerProfile(user = null) {
  const targetUser = user || getLoggedInUser();
  const raw = String(targetUser?.role || "").trim().toLowerCase();
  return raw === "branchmanager";
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
  if (isBranchManagerProfile(user)) return ["sales"];
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

function hasValidSuperAdminCompanyScope() {
  return !isSuperAdmin() || isAllCompaniesSelected() || Boolean(getSelectedCompanyId());
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

  if (isCompanySelectionRequiredForPage() && !hasValidSuperAdminCompanyScope()) {
    showCompanySelectionBlock();
    return;
  }

  if (!isCompanySelectionRequiredForPage() && !hasValidSuperAdminCompanyScope()) {
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
  if (!isCompanySelectionRequiredForPage() || hasValidSuperAdminCompanyScope()) return;
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
  if (hasValidSuperAdminCompanyScope()) return;

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
  if (isBranchManagerProfile(targetUser)) return ERP_BRANCH_MANAGER_PAGE_KEYS.has(pageKey);

  const allowedRoles = ERP_PAGE_PERMISSION_MAP[pageKey];
  if (!Array.isArray(allowedRoles) || !allowedRoles.length) return true;

  return normalizeAllowedRoles(allowedRoles).includes(getNormalizedRole(targetUser));
}

function normalizeErpModuleKey(moduleKey = "") {
  return String(moduleKey || "").trim().toUpperCase();
}

function getCompanyModulePreviewContext() {
  return window.__erpCompanyModuleContext || null;
}

async function loadCompanyModuleContext({ force = false } = {}) {
  if (!force && window.__erpCompanyModuleContextLoaded) {
    return getCompanyModulePreviewContext();
  }

  window.__erpCompanyModuleContextLoaded = true;

  try {
    const response = await fetch(`${window.ERP_API_BASE}/company-module-context`, {
      credentials: "include",
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || "Module context unavailable");
    }

    window.__erpCompanyModuleContext = {
      plan: data.plan || null,
      modules: data.modules || {},
      moduleList: data.module_list || [],
      isFallback: Boolean(data.is_fallback)
    };

    window.dispatchEvent(new CustomEvent(ERP_MODULE_PREVIEW_EVENT, {
      detail: window.__erpCompanyModuleContext
    }));

    return window.__erpCompanyModuleContext;
  } catch (error) {
    window.__erpCompanyModuleContext = null;
    window.__erpCompanyModuleContextError = error;
    return null;
  }
}

function isModuleEnabled(moduleKey) {
  const normalizedModuleKey = normalizeErpModuleKey(moduleKey);
  if (!normalizedModuleKey) return true;

  const context = getCompanyModulePreviewContext();
  if (!context || !context.modules) return true;
  if (!Object.prototype.hasOwnProperty.call(context.modules, normalizedModuleKey)) return true;

  return context.modules[normalizedModuleKey] !== false;
}

function isModulePreviewDebugMode() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("modulePreview") === "1") return true;
  } catch (_) {}

  return window.ERP_MODULE_PREVIEW_MODE === true || document.body?.dataset?.modulePreview === "1";
}

function canShowNavigationItem(item, user = null) {
  if (!item || !canAccessPage(item.pageKey, user)) return false;
  if (!item.moduleKey) return true;
  if (isModuleEnabled(item.moduleKey)) return true;
  if (isModulePreviewDebugMode()) return true;
  if (isSuperAdmin(user) && ERP_SUPERADMIN_ALWAYS_VISIBLE_PAGES.has(item.pageKey)) return true;
  return false;
}

function getCurrentPageModuleKey() {
  const currentPage = getCurrentPageKey();
  const item = ERP_NAVIGATION_ITEMS.find((navItem) => navItem.pageKey === currentPage);
  return item?.moduleKey || ERP_PAGE_MODULE_KEYS[currentPage] || "";
}

function renderModulePreviewWarningIfNeeded() {
  const moduleKey = getCurrentPageModuleKey();
  const existing = document.getElementById("erpModulePreviewWarning");
  if (!moduleKey || isModuleEnabled(moduleKey)) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const warning = document.createElement("div");
  warning.id = "erpModulePreviewWarning";
  warning.className = "erp-module-preview-warning";
  warning.innerHTML = `
    <i class="fas fa-triangle-exclamation"></i>
    <span>This module is not enabled for your company plan.</span>
  `;

  const topbar = document.querySelector(".topbar");
  const main = document.querySelector(".main");
  if (topbar?.parentElement) {
    topbar.insertAdjacentElement("afterend", warning);
  } else if (main) {
    main.prepend(warning);
  } else {
    document.body.prepend(warning);
  }
}

function getModuleDisplayName(moduleKey = "") {
  const normalizedModuleKey = normalizeErpModuleKey(moduleKey);
  if (!normalizedModuleKey) return "";

  const navItem = ERP_NAVIGATION_ITEMS.find((item) => normalizeErpModuleKey(item.moduleKey) === normalizedModuleKey);
  if (navItem?.label) return navItem.label;

  const contextItem = getCompanyModulePreviewContext()?.moduleList?.find(
    (item) => normalizeErpModuleKey(item.module_key) === normalizedModuleKey
  );
  if (contextItem?.module_name) return contextItem.module_name;

  return normalizedModuleKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCurrentPlanKey() {
  const plan = getCompanyModulePreviewContext()?.plan || {};
  return String(plan.plan_key || plan.planKey || "").trim();
}

function getModuleBlockedPageUrl(payload = {}) {
  const params = new URLSearchParams();
  const moduleKey = normalizeErpModuleKey(payload.module || payload.module_key || "");
  const planKey = String(payload.plan || payload.plan_key || getCurrentPlanKey() || "").trim();
  const enforcementMode = String(payload.enforcement_mode || payload.enforcementMode || "").trim();

  if (moduleKey) params.set("module", moduleKey);
  if (planKey) params.set("plan", planKey);
  if (enforcementMode) params.set("mode", enforcementMode);

  const query = params.toString();
  return `module-access-blocked.html${query ? `?${query}` : ""}`;
}

function handleModuleAccessBlockedResponse(response, data = {}) {
  try {
    if (!response || Number(response.status) !== 403) return false;

    const moduleKey = normalizeErpModuleKey(data.module || data.module_key || "");
    const enforcementMode = String(data.enforcement_mode || data.enforcementMode || "").trim().toUpperCase();
    if (!moduleKey || enforcementMode !== "HARD_ENFORCEMENT") return false;

    const currentPage = String(window.location.pathname || "").split("/").pop().toLowerCase();
    if (currentPage === "module-access-blocked.html") return true;

    const payload = {
      module: moduleKey,
      moduleName: getModuleDisplayName(moduleKey),
      plan: data.plan || data.plan_key || getCurrentPlanKey() || "",
      enforcement_mode: enforcementMode,
      message: data.message || "This module is not enabled for your company",
      companyName: getSelectedCompanyName() || getLoggedInUser()?.company_name || getLoggedInUser()?.companyName || "",
      isSuperAdmin: isSuperAdmin()
    };

    try {
      sessionStorage.setItem(ERP_MODULE_BLOCKED_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}

    window.location.assign(getModuleBlockedPageUrl(payload));
    return true;
  } catch (_) {
    return false;
  }
}

function decorateDisabledModuleNavItems() {
  document.querySelectorAll(".menu a[data-module-key]").forEach((link) => {
    const moduleKey = link.dataset.moduleKey || "";
    const disabled = Boolean(isModulePreviewDebugMode() && moduleKey && !isModuleEnabled(moduleKey));
    link.classList.toggle("erp-module-preview-disabled", disabled);
    link.querySelector(".erp-module-disabled-badge")?.remove();

    if (disabled) {
      const badge = document.createElement("span");
      badge.className = "erp-module-disabled-badge";
      badge.textContent = "Disabled";
      link.appendChild(badge);
    }
  });
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
    body.erp-mode-sales .menu a:hover,
    body.erp-mode-sales .menu .erp-nav-group-toggle:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .menu .erp-nav-group {
      margin: 4px 0;
    }
    .menu .erp-nav-group-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
      padding: 12px 18px;
      border-radius: 0;
    }
    .menu .erp-nav-group-toggle i:first-child {
      width: 20px;
      text-align: center;
    }
    .menu .erp-nav-group-toggle .erp-nav-group-title {
      flex: 1;
      font-weight: 800;
    }
    .menu .erp-nav-group-toggle .erp-nav-group-chevron {
      font-size: 12px;
      transition: transform 0.18s ease;
    }
    .menu .erp-nav-group.open .erp-nav-group-chevron {
      transform: rotate(90deg);
    }
    .menu .erp-nav-submenu {
      display: none;
      list-style: none;
      margin: 0;
      padding: 0 0 6px 0;
    }
    .menu .erp-nav-group.open .erp-nav-submenu {
      display: block;
    }
    .menu .erp-nav-submenu a {
      padding-left: 38px;
      font-size: 13px;
    }
    .menu .erp-nav-group.has-active > .erp-nav-group-toggle {
      background: rgba(255, 255, 255, 0.1);
    }
    .menu a.erp-module-preview-disabled {
      opacity: 0.62;
    }
    .erp-module-disabled-badge {
      margin-left: auto;
      border-radius: 999px;
      padding: 3px 7px;
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
      color: #b42318;
      background: #fff1f1;
      border: 1px solid rgba(180, 35, 24, 0.18);
      white-space: nowrap;
    }
    .erp-module-preview-warning {
      margin: 0 20px 16px;
      border: 1px solid #f6c453;
      background: #fff8df;
      color: #7a4b00;
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 800;
      box-shadow: 0 8px 22px rgba(146, 97, 15, 0.08);
    }
    .erp-module-preview-warning i {
      color: #b7791f;
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
      .erp-module-preview-warning {
        margin: 0 12px 14px;
        align-items: flex-start;
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

function getNavGroupStorageKey(groupKey) {
  return `erpNavGroup:${groupKey}`;
}

function isNavGroupOpen(groupKey, groupItems, currentPage) {
  if (groupItems.some((item) => item.pageKey === currentPage)) return true;
  const storedState = String(localStorage.getItem(getNavGroupStorageKey(groupKey)) || "").trim().toLowerCase();
  if (storedState === "open") return true;
  if (storedState === "closed") return false;
  if (groupKey === "accounting") return true;
  return false;
}

function toggleErpNavGroup(groupKey) {
  const group = document.querySelector(`[data-erp-nav-group="${groupKey}"]`);
  if (!group) return;

  const willOpen = !group.classList.contains("open");
  group.classList.toggle("open", willOpen);
  group.querySelector(".erp-nav-group-toggle")?.setAttribute("aria-expanded", willOpen ? "true" : "false");
  localStorage.setItem(getNavGroupStorageKey(groupKey), willOpen ? "open" : "closed");
}

function renderNavigationItem(item, currentPage) {
  const disabled = Boolean(isModulePreviewDebugMode() && item.moduleKey && !isModuleEnabled(item.moduleKey));
  return `
    <li>
      <a href="${item.href}" class="${item.pageKey === currentPage ? "active" : ""} ${disabled ? "erp-module-preview-disabled" : ""}" data-module-key="${item.moduleKey || ""}">
        <i class="${item.icon}"></i> ${item.label}
        ${disabled ? `<span class="erp-module-disabled-badge">Disabled</span>` : ""}
      </a>
    </li>
  `;
}

function renderNavigationGroup(groupKey, groupItems, currentPage) {
  const group = ERP_NAVIGATION_GROUPS[groupKey] || {
    label: groupKey,
    icon: "fas fa-folder"
  };
  const hasActive = groupItems.some((item) => item.pageKey === currentPage);
  const isOpen = isNavGroupOpen(groupKey, groupItems, currentPage);

  return `
    <li class="erp-nav-group ${isOpen ? "open" : ""} ${hasActive ? "has-active" : ""}" data-erp-nav-group="${groupKey}">
      <button class="erp-nav-group-toggle" type="button" onclick="toggleErpNavGroup('${groupKey}')" aria-expanded="${isOpen ? "true" : "false"}">
        <i class="${group.icon}"></i>
        <span class="erp-nav-group-title">${group.label}</span>
        <i class="fas fa-chevron-right erp-nav-group-chevron"></i>
      </button>
      <ul class="erp-nav-submenu">
        ${groupItems.map((item) => renderNavigationItem(item, currentPage)).join("")}
      </ul>
    </li>
  `;
}

function renderModeAwareMenu(menu, user, mode, allowedModes) {
  const currentPage = getCurrentPageKey();
  const items = ERP_NAVIGATION_ITEMS.filter((item) =>
    item.mode === mode && allowedModes.includes(item.mode) && canShowNavigationItem(item, user)
  );

  const html = [];
  const renderedGroups = new Set();

  items.forEach((item) => {
    if (!item.group) {
      html.push(renderNavigationItem(item, currentPage));
      return;
    }

    if (renderedGroups.has(item.group)) return;

    const groupItems = items.filter((candidate) => candidate.group === item.group);
    html.push(renderNavigationGroup(item.group, groupItems, currentPage));
    renderedGroups.add(item.group);
  });

  menu.innerHTML = html.join("");
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
    decorateDisabledModuleNavItems();
  }

  roleAwareElements.forEach((element) => {
    if (element.closest(".menu")) return;

    const pageKey = String(element.dataset.pageKey || "").trim();
    if (!pageKey) return;

    const navItem = ERP_NAVIGATION_ITEMS.find((item) => item.pageKey === pageKey);
    element.style.display = !user || (navItem ? canShowNavigationItem(navItem, user) : canAccessPage(pageKey, user)) ? "" : "none";
  });

  renderModulePreviewWarningIfNeeded();
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

      if (!selectedCompanyId && !isAllCompaniesSelected() && !canBypassCompanySelection) {
        showCompanySelectionBlock();
        return Promise.resolve(new Response(JSON.stringify({
          success: false,
          message: "Please select a company to continue"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }));
      }

      if (isAllCompaniesSelected() && !["GET", "HEAD", "OPTIONS"].includes(method) && !canBypassCompanySelection) {
        return Promise.resolve(new Response(JSON.stringify({
          success: false,
          message: "SuperAdmin support mode is read-only for ERP operational data."
        }), {
          status: 403,
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
    }).then((response) => {
      if (isApiRequest && response?.status === 403) {
        response.clone().json()
          .then((data) => handleModuleAccessBlockedResponse(response, data))
          .catch(() => {});
      }
      return response;
    });
  };

  window.__erpFetchAuthPatched = true;
}

window.handleModuleAccessBlockedResponse = handleModuleAccessBlockedResponse;
window.getModuleDisplayName = getModuleDisplayName;

function bootstrapSidebarNavigation() {
  const run = () => filterSidebarMenuByRole();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

function bootstrapModulePreviewAwareness() {
  const run = () => {
    loadCompanyModuleContext()
      .then(() => {
        filterSidebarMenuByRole();
        renderModulePreviewWarningIfNeeded();
      })
      .catch(() => {});
  };

  window.addEventListener(ERP_MODULE_PREVIEW_EVENT, () => {
    filterSidebarMenuByRole();
    renderModulePreviewWarningIfNeeded();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}

patchFetchWithAuthHeader();
bootstrapSidebarNavigation();
bootstrapModulePreviewAwareness();
bootstrapSuperAdminCompanyContext();
