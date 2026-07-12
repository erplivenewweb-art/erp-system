# State Management

Server state: Server Components/fetch cache for public reads; TanStack Query is the provisional client server-state tool only for interactive/mutating areas. Auth/session: HttpOnly cookies, server resolved. Cart/wishlist/quotes/orders: server authoritative with query invalidation and optimistic rollback. Checkout: scoped reducer/state machine, no durable payment secrets. Theme: validated cookie + context. Consent: cookie/server record plus CMP adapter. Search/filter: URL state. Forms: React Hook Form + shared Zod schemas provisionally. CMS preview: separate app/state.

No access/refresh token, GST evidence, address book, wholesale price cache, payment data or sensitive identity in localStorage. sessionStorage is limited to non-sensitive recovery hints. IndexedDB/offline holds only approved public catalogue/drafts and is purged by version/consent.

BroadcastChannel/storage events may synchronize logout, cart invalidation and theme without broadcasting payloads. Logout clears client caches, drafts, channels and service-worker/private caches. Optimistic updates require reversible UI and server reconciliation.

