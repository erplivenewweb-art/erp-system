(function () {
  const HELP_DATA = {
    "dashboard.html": {
      title: "ERP Dashboard",
      intro: "ERP me two main modes hain: Production aur Store/Sales. Dashboard se aap daily business position aur correct mode ka summary dekh sakte hain.",
      steps: [
        "Production mode manufacturing, process, sticker, lot aur karigar work ke liye hai.",
        "Store/Sales mode stock, billing, invoice, sales, return aur branch operations ke liye hai.",
        "Login ke baad sidebar/top mode switch se Production ya Store mode choose karein.",
        "Store mode me Store/Sales dashboard sections hi use karein. Production mode me production analytics hi use karein.",
        "Agar module sidebar me nahi dikh raha hai, company plan/module access check karein.",
        "Refresh tabhi karein jab new entry save karne ke baad latest numbers dekhne ho."
      ],
      warnings: [
        "Dashboard review ke liye hai. Actual entry Billing, Process, Stock, Branch, ya related page se hoti hai."
      ]
    },
    "production-dashboard.html": {
      title: "Production Dashboard",
      intro: "Production dashboard manufacturing aur karigar performance ka focused view hai.",
      steps: [
        "Date select karke production summary dekhein.",
        "Today Production Weight aur Qty se daily output check karein.",
        "Process loss, high loss alerts aur karigar summary review karein.",
        "Completed lots ko Sticker page par barcode stock banane ke liye bhejein.",
        "Production vs Sales chart ko planning ke liye use karein, lekin billing entry Store/Sales side se hi hoti hai."
      ],
      warnings: [
        "Production dashboard me sales billing ka kaam na karein. Billing/Invoice Store/Sales mode me hota hai."
      ]
    },
    "sales-dashboard.html": {
      title: "Store Dashboard",
      intro: "Store dashboard stock, billing, invoice, return aur sales performance ka focused view hai.",
      steps: [
        "Date select karke store/sales summary dekhein.",
        "Available stock, sold items, return aur sales amount review karein.",
        "Recent sales aur recent stock table se daily movement verify karein.",
        "Low stock ya mismatch dikhe to Stock, Billing, Return ya Branch page me detail check karein.",
        "Branch company me staff apne assigned branch ka data hi dekhega."
      ],
      warnings: [
        "Wrong branch barcode, IN_TRANSIT item, ya TRANSFER_SHORTAGE item billing me use nahi hoga."
      ]
    },
    "sticker.html": {
      title: "Sticker",
      intro: "Completed production lots se barcode stock banane ke liye Sticker page use hota hai.",
      steps: [
        "Process/lot complete hone ke baad hi sticker create karein.",
        "Product name, purity, SKU, size, metal type aur lot number sahi bharein.",
        "Weight aur quantity carefully check karein.",
        "Barcode generate/confirm karein.",
        "Save karke sticker print karein. Ye item Stock me available hoga."
      ],
      warnings: [
        "Do not reuse a barcode.",
        "Create stickers only after the related process lot is completed."
      ]
    },
    "stock.html": {
      title: "Stock",
      intro: "Finished barcode stock dekhne aur verify karne ke liye Stock page use karein.",
      steps: [
        "Search by barcode, product, SKU, size, or lot number.",
        "Status check karein: available, sold, deleted, IN_TRANSIT, ya shortage.",
        "Branch staff ko apne assigned branch ka stock hi dikhna chahiye.",
        "Billing se pehle barcode ka branch aur status verify karein.",
        "Owner/Admin all branches ka stock review kar sakte hain."
      ],
      warnings: [
        "Sold, deleted, IN_TRANSIT, TRANSFER_SHORTAGE, ya wrong branch item ko available stock mat maaney."
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
      intro: "Process page lot-wise manufacturing, karigar work, output aur loss tracking ke liye hai.",
      steps: [
        "Raw weight aur expected quantity ke saath lot create/select karein.",
        "Process step aur karigar choose karein.",
        "Kaam complete hone ke baad output weight aur quantity enter karein.",
        "Next step start karne se pehle current step complete karein.",
        "Sab steps complete hone ke baad lot complete karein.",
        "Completed lot ke baad Sticker page se barcode stock banayein."
      ],
      warnings: [
        "Output weight should not be greater than input weight.",
        "Complete open steps in sequence before adding the next step."
      ]
    },
    "invoice.html": {
      title: "Invoice",
      intro: "Customer invoice prepare, save aur print/share karne ke liye Invoice page use hota hai.",
      steps: [
        "Enter or select customer details.",
        "Barcode scan/add karein. Branch staff sirf apne assigned branch stock ka barcode bill kar sakta hai.",
        "Check rate, making charge, GST type, and discount.",
        "Review the invoice total and payment details.",
        "Save the invoice, then print or share it."
      ],
      warnings: [
        "IN_TRANSIT, TRANSFER_SHORTAGE, sold, deleted, ya wrong branch barcode invoice me use nahi hoga."
      ]
    },
    "billing.html": {
      title: "Billing",
      intro: "Sales bill banane, payment collect karne aur stock ko sold mark karne ke liye Billing page use hota hai.",
      steps: [
        "Enter customer details such as name and mobile number.",
        "Barcode scan/add karein. Branch staff ke liye item usi assigned branch ka hona chahiye.",
        "Check rate, making charge, discount, and GST settings.",
        "Enter payment amount and payment mode.",
        "Save the bill and print the customer copy."
      ],
      warnings: [
        "IN_TRANSIT, TRANSFER_SHORTAGE, sold, deleted, ya wrong branch barcode block hoga. Save se pehle totals zaroor check karein."
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
      intro: "Customer return ya damaged return record karne ke liye Return page use hota hai.",
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
      intro: "Staff login create karne aur role access manage karne ke liye Staff Management page use karein.",
      steps: [
        "Enter staff name, mobile number, and login details.",
        "Select the correct role for the staff member.",
        "Set the staff status as active or inactive.",
        "Branch staff ke liye Branch Management page se branch assignment bhi karein.",
        "Save the staff record.",
        "Disable access when a staff member leaves."
      ],
      warnings: [
        "Give admin or owner access only to trusted users."
      ]
    },
    "settings.html": {
      title: "Settings",
      intro: "Company details, invoice settings, GST aur default rates set karne ke liye Settings page use hota hai.",
      steps: [
        "First setup: SuperAdmin company approve karta hai, phir Owner/Admin login karke settings complete karta hai.",
        "Company name, address, GSTIN, and contact details bharein.",
        "Set default bill type, tax type, and business state.",
        "Enter default gold/silver rates or making charge settings if used.",
        "Settings save karne ke liye Send Code OTP required ho sakta hai.",
        "Send Code ke liye SMTP setup required hai: SMTP_ENABLED, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM.",
        "Gmail use kar rahe hain to Gmail App Password use karein, normal password nahi.",
        "Create a test invoice to confirm the print format."
      ],
      warnings: [
        "Email service not configured aaye to SMTP disabled/missing hai. Secrets kabhi guide ya chat me share na karein."
      ]
    },
    "admin-approval.html": {
      title: "Company Approval",
      intro: "SuperAdmin company signup requests approve/reject karta hai. Company approval SuperAdmin ka kaam hai.",
      steps: [
        "Review the company name, owner details, and contact information.",
        "Check whether the request looks genuine.",
        "Approve valid companies or reject invalid requests.",
        "Approval ke baad Owner/Admin login karega.",
        "Company approve hone ke baad SaaS plan/module access Company Plans page se assign kiya ja sakta hai."
      ],
      warnings: [
        "Approve only verified company requests."
      ]
    },
    "company-plans.html": {
      title: "Company Plans",
      intro: "SuperAdmin yahan se company ka SaaS plan aur module access manage karta hai.",
      steps: [
        "Company list me company select karein.",
        "Plan assign karein: PRODUCTION_ONLY, STORE_ONLY, BRANCH_STORE, FULL_ERP, ya CUSTOM.",
        "Plan ke modules review karein aur zarurat ho to individual module override karein.",
        "Disabled modules normal company users ke sidebar se hide ho jaate hain.",
        "HARD_ENFORCEMENT enabled ho to disabled module open karne par Module Not Included page dikhega.",
        "Audit history me plan/module changes verify karein."
      ],
      warnings: [
        "Module access role permissions ke upar apply hota hai. Role permission remove nahi hoti, module disabled ho to page hidden/blocked ho sakta hai."
      ]
    },
    "enforcement-qa-dashboard.html": {
      title: "Enforcement QA",
      intro: "SuperAdmin is dashboard se SaaS module enforcement rollout safely monitor karta hai.",
      steps: [
        "REPORT_ONLY aur HARD_ENFORCEMENT company counts dekhein.",
        "WOULD_BLOCK events se samjhein kaunse disabled modules use ho rahe hain.",
        "HARD_BLOCK events se actual blocked access verify karein.",
        "Company readiness table se HARD_ENFORCEMENT safe hai ya nahi estimate karein.",
        "Route map viewer me mapped/unmapped routes audit karein.",
        "Unmapped route risk section ko rollout se pehle review karein."
      ],
      warnings: [
        "QA dashboard monitoring ke liye hai. Business stock/billing/process data yahan se change nahi hota."
      ]
    },
    "module-access-blocked.html": {
      title: "Module Not Included",
      intro: "Ye page tab dikhta hai jab company plan me module enabled nahi hai aur hard enforcement active hai.",
      steps: [
        "Current Plan aur Required Module dekhein.",
        "Agar module chahiye, Owner/Admin ya SuperAdmin se contact karein.",
        "Go To Dashboard se allowed modules par wapas jaayein.",
        "SuperAdmin Company Plans page se plan/module enable kar sakta hai.",
        "Module enable hone ke baad page refresh ya login again karein."
      ],
      warnings: [
        "Disabled module hidden ya blocked hona expected behavior hai. Company plan/module access check karein."
      ]
    },
    "login.html": {
      title: "Login and Forgot Password",
      intro: "ERP me login, company request aur forgot password flow yahan se start hota hai.",
      steps: [
        "Enter your registered mobile number or email and password to log in.",
        "First setup me SuperAdmin company approve karega, phir Owner/Admin login karega.",
        "Owner/Admin login ke baad Settings me company details complete karein.",
        "For forgot password, send OTP to the registered account.",
        "Verify the OTP.",
        "Set a new password.",
        "Return to login and sign in again."
      ],
      warnings: [
        "OTP may expire. Email service not configured aaye to SMTP setup check karein."
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
    "branch-management.html": {
      title: "Branch Management",
      intro: "Owner/Admin yahan real branches create karta hai aur staff ko branch assign karta hai.",
      steps: [
        "Branch > Branch Management open karein.",
        "Branch name jaise Bhubaneswar, Cuttack, Puri enter karein.",
        "Branch code, type MAIN/STORE/WAREHOUSE/OFFICE, address, contact name, contact phone aur status fill karein.",
        "Create Branch par click karein. Galti ho to Edit se update karein.",
        "Assign Staff button se staff user ko selected branch assign karein.",
        "Example: Cuttack branch create karein, Raju ko Cuttack assign karein, Raju Cuttack PC/mobile se login karega.",
        "Raju ko Cuttack stock, billing aur receive hi dikhna chahiye; Owner/Admin all branches dekh sakta hai.",
        "Staff kisi bhi branch PC/laptop/mobile se same ERP URL par login karega.",
        "System staff ko uske assigned branch par automatically lock karega."
      ],
      warnings: [
        "Owner/Admin all branches dekh sakta hai. Branch staff ko assigned branch ka stock/billing/receive hi dikhna chahiye."
      ]
    },
    "branch-transfer.html": {
      title: "Branch Transfer",
      intro: "Main/source branch se destination branch ko barcode stock transfer karne ke liye Branch Transfer use hota hai.",
      steps: [
        "Source aur destination branch select karein.",
        "Transfer me barcode scan/add karein.",
        "Items verify karein, phir transfer dispatch karein.",
        "Dispatch ke baad items IN_TRANSIT ho jaate hain aur sell nahi ho sakte.",
        "Destination branch Branch Receive page me received barcodes scan karegi.",
        "Shortage ya mismatch ho to audit/shortage reports me review karein."
      ],
      warnings: [
        "IN_TRANSIT items billing/invoice me use nahi honge. Wrong branch barcode blocked hoga."
      ]
    },
    "branch-receive.html": {
      title: "Branch Receive",
      intro: "Destination branch transfer receive karne aur barcodes verify karne ke liye Branch Receive use hota hai.",
      steps: [
        "Incoming transfer open karein.",
        "Physical parcel me received barcodes scan karein.",
        "Valid received items destination branch stock me move ho jaate hain.",
        "Jo item receive nahi hua wo shortage/mismatch me mark ho sakta hai.",
        "Receive complete karne ke baad stock aur audit report verify karein."
      ],
      warnings: [
        "Sirf actual received barcode scan karein. Missing item ko manually available na mark karein."
      ]
    },
    "branch-transfer-history.html": {
      title: "Branch Transfer History",
      intro: "Purane branch transfers, status, dispatch aur receive details check karne ke liye use karein.",
      steps: [
        "Date, branch, status ya transfer number se search karein.",
        "Transfer open karke items aur barcode status verify karein.",
        "IN_TRANSIT, received, shortage aur mismatch status compare karein.",
        "Owner/Admin branch-wise movement review kar sakta hai."
      ],
      warnings: [
        "Transfer history audit reference hai. Barcode status ko billing se pehle verify karein."
      ]
    },
    "branch-shortage-report.html": {
      title: "Branch Shortage Report",
      intro: "Branch transfer me missing ya mismatch items ko track karne ke liye Shortage Report use karein.",
      steps: [
        "Branch, transfer, date ya status filter select karein.",
        "Missing barcode aur expected destination branch verify karein.",
        "Physical parcel, scan history aur receive record compare karein.",
        "Shortage item ko resolve hone tak sale ke liye available na maaney."
      ],
      warnings: [
        "Shortage item billing/invoice me blocked rehna chahiye."
      ]
    },
    "branch-analytics.html": {
      title: "Branch Analytics",
      intro: "Branch-wise stock, transfer, receive aur performance analytics ke liye use karein.",
      steps: [
        "Branch/date filters select karein.",
        "Transfer volume, receive status aur shortage trend dekhein.",
        "Owner/Admin all branches compare kar sakta hai.",
        "Staff apne assigned branch ka view use karega."
      ],
      warnings: [
        "Analytics decision support hai. Actual correction Branch Receive/Audit workflow se karein."
      ]
    },
    "transfer-ageing-report.html": {
      title: "Transfer Ageing",
      intro: "Kaunse transfers zyada time se pending ya in-transit hain, ye report batata hai.",
      steps: [
        "Date range aur branch filter select karein.",
        "Old IN_TRANSIT transfers identify karein.",
        "Destination branch se receive status confirm karein.",
        "Delay reason ko branch audit me track karein."
      ],
      warnings: [
        "Long pending transfer ka stock sale ke liye available nahi hota."
      ]
    },
    "shortage-analytics.html": {
      title: "Shortage Analytics",
      intro: "Transfer shortage/mismatch pattern samajhne ke liye Shortage Analytics use hota hai.",
      steps: [
        "Branch/date filter lagayein.",
        "Shortage count, barcode aur transfer details dekhein.",
        "Repeated shortage branch/process identify karein.",
        "Audit dashboard me follow-up karein."
      ],
      warnings: [
        "TRANSFER_SHORTAGE item billing me sell nahi hoga."
      ]
    },
    "stock-movement-ledger.html": {
      title: "Stock Movement Ledger",
      intro: "Barcode stock ka full movement trail dekhne ke liye ledger use karein.",
      steps: [
        "Barcode, branch ya date se search karein.",
        "Created, transferred, received, sold, returned jaise movements verify karein.",
        "Wrong branch ya missing stock issue me ledger first check karein.",
        "Audit ke liye movement sequence save/review karein."
      ],
      warnings: [
        "Ledger history ko manually change karne ke liye nahi, investigation ke liye use karein."
      ]
    },
    "branch-reconciliation.html": {
      title: "Branch Reconciliation",
      intro: "Branch stock aur transfer records reconcile karne ke liye use karein.",
      steps: [
        "Branch aur date range select karein.",
        "Expected stock, actual received, shortage aur mismatch compare karein.",
        "Exception items ko verify karein.",
        "Reconciliation result audit dashboard me review karein."
      ],
      warnings: [
        "Reconciliation ke baad bhi doubtful barcode ko billing me use karne se pehle status check karein."
      ]
    },
    "branch-audit-dashboard.html": {
      title: "Branch Audit Dashboard",
      intro: "Branch transfer, shortage, mismatch aur reconciliation audit ka control view hai.",
      steps: [
        "Audit summary cards review karein.",
        "Exception queue, snapshots aur reconciliation runs check karein.",
        "High risk branch/transfer identify karein.",
        "Follow-up action branch operations team ke saath close karein."
      ],
      warnings: [
        "Audit dashboard monitoring ke liye hai. Stock movement actual transfer/receive/billing workflow se hota hai."
      ]
    },
    "branch-snapshots.html": {
      title: "Branch Snapshots",
      intro: "Branch stock snapshot records audit/reference ke liye use hote hain.",
      steps: [
        "Branch aur snapshot date select karein.",
        "Snapshot stock count aur value review karein.",
        "Current stock se difference investigate karein.",
        "Exception items ko ledger/audit me verify karein."
      ],
      warnings: [
        "Snapshot past state hai. Current sale se pehle live stock status check karein."
      ]
    },
    "branch-reconciliation-runs.html": {
      title: "Reconciliation Runs",
      intro: "Past reconciliation runs aur results review karne ke liye use karein.",
      steps: [
        "Run date, branch aur status filter karein.",
        "Matched, mismatch aur shortage result dekhein.",
        "Failed/exception run ko recheck karein.",
        "Audit close karne se pehle unresolved items verify karein."
      ],
      warnings: [
        "Unresolved reconciliation issue ko ignore na karein."
      ]
    },
    "branch-exception-queue.html": {
      title: "Exception Queue",
      intro: "Branch mismatch, shortage, wrong movement ya doubtful barcode follow-up ke liye Exception Queue use hota hai.",
      steps: [
        "Exception type aur branch filter karein.",
        "Barcode/transfer detail open karke issue samjhein.",
        "Stock movement ledger se full trail verify karein.",
        "Issue resolve hone ke baad audit note maintain karein."
      ],
      warnings: [
        "Exception item ko clear proof ke bina sell/adjust na karein."
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
      intro: "ERP start page se login screen open hoti hai. Staff aur admin same ERP URL use karte hain.",
      steps: [
        "Wait for the system to open the login page.",
        "Log in with your registered account.",
        "Company first time use kar rahi hai to SuperAdmin approval required hai.",
        "Branch staff ko Owner/Admin branch assign karega, uske baad staff same URL se login karega.",
        "Contact the owner or admin if your login is not active.",
        "Common issue: port 8080 already in use ho to old node process close karein ya port change karein."
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
