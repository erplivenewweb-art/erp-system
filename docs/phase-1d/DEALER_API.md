# B2B Dealer API

39 endpoints cover dealer identity/application, business/GST references, protected document references, status/profile, restricted catalogues, wholesale/special quotes, MOQ/slabs, bulk cart, quotations/revisions/accept/reject, custom enquiries, repeat/direct staged orders, history, credit terms, download metadata and dashboard.

Applicant access is limited to its own application. Approved-dealer resources require active approval plus explicit visibility/price entitlements on every request. A valid login alone never unlocks wholesale price. Suspended/revoked dealers fail closed and cached dealer data is invalidated.

Raw verification documents are not accepted through ordinary profile endpoints; upload workflows return opaque protected references after type/size/malware controls. Wholesale quote responses contain customer-safe outputs, not cost, formula, silver-rate source secrets or making-charge internals.

