# Error, Loading and Offline Architecture

Root error boundary handles unrecoverable shell errors; route boundaries isolate pages; feature boundaries isolate galleries/recommendations/providers without hiding core facts. Safe errors include action and correlation reference, never stack/SQL/path/ERP ID. Loading skeletons preserve final geometry; empty states explain and recover.

API outage: preserve safe content/drafts and fail actions clearly. ERP integration outage: never call ERP directly; availability/price/order conversion fail closed. Stale availability becomes UNAVAILABLE; stale price requires refresh; checkout never assumes success after timeout. Quote failure preserves revision/draft and reconciles before retry.

Maintenance mode is remotely controlled by storefront environment/config in future deployment, not ERP. PWA/offline is future: public content and drafts only, never private prices/tokens/order acceptance. Order status falls back to last safe projected state plus timestamp/support.

