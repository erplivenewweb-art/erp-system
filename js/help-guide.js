(function () {
  const HELP_DATA = {
    "dashboard.html": {
      title: "Dashboard",
      intro: "Use this page to quickly understand today's business position.",
      steps: [
        "Review the summary cards for sales, stock, and important counts.",
        "Check low-stock or warning sections before starting daily work.",
        "Open the required module from the menu when you need to take action.",
        "Refresh the page if you have just saved new entries and want the latest summary."
      ],
      warnings: [
        "Dashboard numbers are for review. Changes are made inside the related pages."
      ]
    },
    "sticker.html": {
      title: "Sticker",
      intro: "Use this page to create product stickers and barcodes for stock items.",
      steps: [
        "Enter product details such as product name, purity, SKU, size, and metal type.",
        "Enter the correct lot number so the item is linked to the right production lot.",
        "Enter weight and quantity carefully before saving.",
        "Generate or confirm the barcode.",
        "Save the sticker item, then print the sticker when ready."
      ],
      warnings: [
        "Do not reuse a barcode.",
        "Create stickers only after the related process lot is completed."
      ]
    },
    "stock.html": {
      title: "Stock",
      intro: "Use this page to view and manage finished item stock.",
      steps: [
        "Search by barcode, product, SKU, size, or lot number.",
        "Check item status before editing or deleting any stock item.",
        "Use filters to find available, sold, or deleted items when available.",
        "Review stock totals before billing or reporting."
      ],
      warnings: [
        "Sold or deleted items should not be treated as available stock."
      ]
    },
    "material-stock.html": {
      title: "Material Stock",
      intro: "Use this page to manage raw material and supplier stock movement.",
      steps: [
        "Add the material name, category, unit, supplier, and opening stock.",
        "Set a low-stock level so the system can show warnings.",
        "Use stock IN when material is received.",
        "Use stock OUT when material is issued or consumed.",
        "Review current balance after every movement."
      ],
      warnings: [
        "Choose the correct movement type. Wrong IN or OUT entries affect stock balance."
      ]
    },
    "process.html": {
      title: "Process",
      intro: "Use this page to track lot-wise processing, output, loss, and karigar work.",
      steps: [
        "Create or select a lot with raw weight and expected quantity.",
        "Add the first process step and choose the process/karigar details.",
        "Enter output weight and quantity after work is completed.",
        "Complete the step before starting the next process step.",
        "Complete the lot after all process steps are finished.",
        "Create stickers only after the lot is completed."
      ],
      warnings: [
        "Output weight should not be greater than input weight.",
        "Complete open steps in sequence before adding the next step."
      ]
    },
    "invoice.html": {
      title: "Invoice",
      intro: "Use this page to prepare and print customer invoices.",
      steps: [
        "Enter or select customer details.",
        "Add items by barcode or item selection.",
        "Check rate, making charge, GST type, and discount.",
        "Review the invoice total and payment details.",
        "Save the invoice, then print or share it."
      ],
      warnings: [
        "Check GST and rate before saving because invoice totals depend on them."
      ]
    },
    "billing.html": {
      title: "Billing",
      intro: "Use this page to create sales bills and collect payment.",
      steps: [
        "Enter customer details such as name and mobile number.",
        "Scan or add the items being sold.",
        "Check rate, making charge, discount, and GST settings.",
        "Enter payment amount and payment mode.",
        "Save the bill and print the customer copy."
      ],
      warnings: [
        "Billing can change item status and sales records. Review details before saving."
      ]
    },
    "sales-history.html": {
      title: "Sales History",
      intro: "Use this page to find old bills, payment details, and sale status.",
      steps: [
        "Search by invoice number, customer name, mobile number, or date.",
        "Open the sale to review items, total amount, paid amount, and due amount.",
        "Update payment only when money is received.",
        "Print or review the bill copy if needed."
      ],
      warnings: [
        "Check invoice status before editing payment or return details."
      ]
    },
    "return.html": {
      title: "Return",
      intro: "Use this page to record customer returns or damaged returns.",
      steps: [
        "Search the original invoice or barcode.",
        "Select the item being returned.",
        "Choose the correct return type.",
        "Enter the return reason clearly.",
        "Save the return after checking all details."
      ],
      warnings: [
        "Return entries can affect stock and sales records. Choose the return type carefully."
      ]
    },
    "transaction.html": {
      title: "Transaction",
      intro: "Use this page to record party cash, metal, settlement, or karigar transactions.",
      steps: [
        "Select the party or karigar.",
        "Choose the correct transaction type.",
        "Enter cash or metal details such as amount, weight, purity, and remarks.",
        "Add settlement details if this transaction closes an old balance.",
        "Save the voucher after reviewing debit and credit direction."
      ],
      warnings: [
        "Wrong transaction type can change party balance incorrectly."
      ]
    },
    "expense-manager.html": {
      title: "Expense Manager",
      intro: "Use this page to record and review business expenses.",
      steps: [
        "Enter the person or vendor name.",
        "Select the expense date and category.",
        "Enter amount and reason.",
        "Save the expense.",
        "Use filters to review expense history."
      ],
      warnings: [
        "Avoid duplicate expense entries for the same bill or payment."
      ]
    },
    "staff-management.html": {
      title: "Staff Management",
      intro: "Use this page to create staff users and manage access.",
      steps: [
        "Enter staff name, mobile number, and login details.",
        "Select the correct role for the staff member.",
        "Set the staff status as active or inactive.",
        "Save the staff record.",
        "Disable access when a staff member leaves."
      ],
      warnings: [
        "Give admin or owner access only to trusted users."
      ]
    },
    "settings.html": {
      title: "Settings",
      intro: "Use this page to set company details, invoice settings, GST, and default rates.",
      steps: [
        "Enter company name, address, GSTIN, and contact details.",
        "Set default bill type, tax type, and business state.",
        "Enter default gold/silver rates or making charge settings if used.",
        "Save settings.",
        "Create a test invoice to confirm the print format."
      ],
      warnings: [
        "Wrong GSTIN, state, or rate can affect billing and invoice totals."
      ]
    },
    "admin-approval.html": {
      title: "Company Approval",
      intro: "Use this page to review and approve company signup requests.",
      steps: [
        "Review the company name, owner details, and contact information.",
        "Check whether the request looks genuine.",
        "Approve valid companies or reject invalid requests.",
        "Ask the owner to log in after approval."
      ],
      warnings: [
        "Approve only verified company requests."
      ]
    },
    "login.html": {
      title: "Login and Forgot Password",
      intro: "Use this page to sign in, create a company request, or reset a forgotten password.",
      steps: [
        "Enter your registered mobile number or email and password to log in.",
        "For forgot password, send OTP to the registered account.",
        "Verify the OTP.",
        "Set a new password.",
        "Return to login and sign in again."
      ],
      warnings: [
        "OTP may expire. Request a new OTP if verification fails."
      ]
    },
    "daily-report.html": {
      title: "Daily Report",
      intro: "Use this page to review one day's business activity.",
      steps: [
        "Select the report date.",
        "Review sales, stock, expenses, and transaction summary.",
        "Check detailed tables for any mismatch.",
        "Print or export the report if needed."
      ],
      warnings: [
        "Choose the correct date before checking totals."
      ]
    },
    "transaction-reports.html": {
      title: "Transaction Reports",
      intro: "Use this page to review party ledger, cash, metal, and settlement reports.",
      steps: [
        "Select the report type.",
        "Choose party and date filters if required.",
        "Review opening balance, debit, credit, and closing balance.",
        "Print or export the report for records."
      ],
      warnings: [
        "Check filters carefully before sharing a report."
      ]
    },
    "index.html": {
      title: "ERP Start",
      intro: "Use this page to open the ERP login screen.",
      steps: [
        "Wait for the system to open the login page.",
        "Log in with your registered account.",
        "Contact the owner or admin if your login is not active."
      ],
      warnings: []
    }
  };

  window.HELP_DATA = HELP_DATA;

  function getCurrentHelpKey(pageName) {
    if (pageName && HELP_DATA[pageName]) return pageName;
    const fileName = String(window.location.pathname || "").split("/").pop() || "index.html";
    return HELP_DATA[fileName] ? fileName : "";
  }

  function ensureHelpStyles() {
    if (document.getElementById("erpHelpStyles")) return;
    const style = document.createElement("style");
    style.id = "erpHelpStyles";
    style.textContent = `
      .erp-help-title-wrap {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .erp-help-btn {
        min-height: 34px;
        border-radius: 999px;
        border: 1px solid var(--erp-border, #eadfce);
        background: linear-gradient(180deg, #ffffff, #f6efe4);
        color: #344357;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: var(--erp-shadow-xs, 0 2px 6px rgba(17, 24, 39, 0.04));
      }
      .erp-help-btn:hover {
        transform: translateY(-1px);
        border-color: var(--erp-border-strong, #d8c3a0);
      }
      .erp-help-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15, 23, 42, 0.48);
      }
      .erp-help-overlay.show {
        display: flex;
      }
      .erp-help-modal {
        width: min(620px, 100%);
        max-height: min(82vh, 720px);
        overflow: auto;
        border-radius: 20px;
        background: linear-gradient(180deg, var(--erp-surface, #fff) 0%, var(--erp-surface-2, #fffaf2) 100%);
        border: 1px solid var(--erp-border, #eadfce);
        box-shadow: var(--erp-shadow-lg, 0 24px 60px rgba(15, 23, 42, 0.12));
      }
      .erp-help-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 20px 12px;
        border-bottom: 1px solid var(--erp-border, #eadfce);
      }
      .erp-help-head h2 {
        margin: 0;
        color: #162033;
        font-size: 22px;
        font-weight: 800;
      }
      .erp-help-head p {
        margin: 5px 0 0;
        color: var(--erp-text-soft, #5f6b7e);
        font-size: 14px;
      }
      .erp-help-close {
        width: 38px;
        height: 38px;
        border: 1px solid var(--erp-border, #eadfce);
        border-radius: 12px;
        background: #fffdf9;
        color: #334155;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }
      .erp-help-body {
        padding: 18px 20px 20px;
      }
      .erp-help-steps {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .erp-help-steps li {
        display: grid;
        grid-template-columns: 78px 1fr;
        gap: 10px;
        align-items: start;
        padding: 11px 12px;
        border: 1px solid var(--erp-border, #eadfce);
        border-radius: 14px;
        background: #fffdf9;
        color: #2f3d52;
        font-size: 14px;
      }
      .erp-help-step-label {
        color: #8a5f17;
        font-weight: 800;
        white-space: nowrap;
      }
      .erp-help-warning {
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid #f5b97a;
        background: #fff7ed;
        color: #9a3412;
        font-size: 13px;
        line-height: 1.5;
      }
      @media (max-width: 640px) {
        .erp-help-steps li {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHelpModal() {
    let modal = document.getElementById("erpHelpOverlay");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "erpHelpOverlay";
    modal.className = "erp-help-overlay";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="erp-help-modal">
        <div class="erp-help-head">
          <div>
            <h2 id="erpHelpTitle">How to use this page</h2>
            <p id="erpHelpIntro"></p>
          </div>
          <button type="button" class="erp-help-close" aria-label="Close help" onclick="closeHelp()">x</button>
        </div>
        <div class="erp-help-body">
          <ol id="erpHelpSteps" class="erp-help-steps"></ol>
          <div id="erpHelpWarning" class="erp-help-warning" style="display:none;"></div>
        </div>
      </div>
    `;

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeHelp();
    });

    document.body.appendChild(modal);
    return modal;
  }

  function renderHelp(pageName) {
    const key = getCurrentHelpKey(pageName);
    const help = HELP_DATA[key];
    if (!help) return false;

    ensureHelpStyles();
    ensureHelpModal();

    document.getElementById("erpHelpTitle").textContent = `How to use ${help.title}`;
    document.getElementById("erpHelpIntro").textContent = help.intro || "";
    document.getElementById("erpHelpSteps").innerHTML = help.steps
      .map((step, index) => `
        <li>
          <span class="erp-help-step-label">Step ${index + 1}</span>
          <span>${step}</span>
        </li>
      `)
      .join("");

    const warningBox = document.getElementById("erpHelpWarning");
    if (help.warnings && help.warnings.length) {
      warningBox.style.display = "block";
      warningBox.innerHTML = `<strong>Important:</strong> ${help.warnings.join(" ")}`;
    } else {
      warningBox.style.display = "none";
      warningBox.textContent = "";
    }

    return true;
  }

  window.openHelp = function (pageName) {
    if (!renderHelp(pageName)) return;
    document.getElementById("erpHelpOverlay").classList.add("show");
  };

  window.closeHelp = function () {
    const modal = document.getElementById("erpHelpOverlay");
    if (modal) modal.classList.remove("show");
  };

  function addHelpButton() {
    const key = getCurrentHelpKey();
    if (!key || document.getElementById("erpHowToUseBtn")) return;

    ensureHelpStyles();

    const button = document.createElement("button");
    button.id = "erpHowToUseBtn";
    button.type = "button";
    button.className = "erp-help-btn";
    button.textContent = "How to use?";
    button.addEventListener("click", function () {
      window.openHelp(key);
    });

    const titleBox = document.querySelector(".title");
    const heading = titleBox?.querySelector("h1, h2") || document.querySelector("h1, h2");

    if (titleBox && heading) {
      const wrap = document.createElement("div");
      wrap.className = "erp-help-title-wrap";
      heading.parentNode.insertBefore(wrap, heading);
      wrap.appendChild(heading);
      wrap.appendChild(button);
      return;
    }

    if (heading) {
      heading.insertAdjacentElement("afterend", button);
      return;
    }

    document.body.insertBefore(button, document.body.firstChild);
  }

  function autoShowFirstVisit() {
    const key = getCurrentHelpKey();
    if (!key) return;

    const storageKey = `erpHelpSeen:${key}`;
    if (localStorage.getItem(storageKey) === "true") return;

    localStorage.setItem(storageKey, "true");
    window.setTimeout(function () {
      window.openHelp(key);
    }, 450);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeHelp();
  });

  document.addEventListener("DOMContentLoaded", function () {
    addHelpButton();
    ensureHelpModal();
    autoShowFirstVisit();
  });
})();
