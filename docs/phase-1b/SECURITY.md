# Commerce Contract Security Boundary

Never return or accept general-purpose fields for internal cost, margin formula, manufacturing recipe/process/secret, ERP employee/user/session/token/role, ERP authentication cookie, branch identifiers or locations, company/tenant internals, accounting ledger/balance, database/table/row IDs, physical barcode, exact stock quantity, supplier secret, or raw verification evidence.

Allowed safe projections are opaque commerce IDs; coarse availability with timestamps; customer-facing display weight when explicitly approved and sourced from ERP; masked GST display; safe tax summary; commerce actor IDs; carrier-safe tracking milestones; and public media/content.

Logs and errors follow the same exclusion. Restricted verification records must use a dedicated encrypted workflow and retention policy and are never embedded in DealerProfile. Authorization is server-side, least-privilege, audience-bound, and deny-by-default. Commerce credentials cannot be accepted by ERP and ERP credentials cannot be accepted by commerce.

