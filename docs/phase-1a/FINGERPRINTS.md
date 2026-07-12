# Phase 1A Fingerprints

Captured from the current working tree on 2026-07-11. Because `js/backend/server.js` had pre-existing uncommitted changes, these working-tree hashes—not the committed blob alone—represent the approved Phase 1A runtime baseline.

## Canonical inventories

- Ordered route inventory: 252 newline-separated `METHOD path` values in source declaration order.
- Route inventory SHA-256: `6a43d9cc74a1fdda45ad0938b25e48245beed921d109b0894ea489bb1c918e63`
- Sorted startup `CREATE TABLE IF NOT EXISTS` inventory: 69 unique table names.
- Table-name inventory SHA-256: `cadf86db9b9b00094ee699d34b06db472e565259a2c21235ca9b04824d38fa75`

The table-name hash is not a full schema fingerprint. The future full fingerprint must include normalized columns, types, defaults, indexes, constraints, and foreign keys from a disposable database after startup.

## Protected file SHA-256

| File | SHA-256 |
|---|---|
| `js/backend/server.js` | `9906740fc29f5dbc4c0416de29abd6e56d157beee06cba3291b07862cca74bbe` |
| `js/backend/authMiddleware.js` | `4f0184d947fa41d98ee8b3830ffb3636d6a24df083b4d1832065df2e5d7356c8` |
| `package.json` | `8a481ff9bda2c7d6b0bb9c32d7a90aed1a2cb210c06330c23c7bfb6db3a020d7` |
| `package-lock.json` | `63dd469d81b45635fc1d20aae62502f1dd86b5e453b5e9af8c03748634949f66` |
| `railway.json` | `9b15f3becfafeb459dc4155d1386a54fef2ae101323eeb17e6bffe3f42b3dfd5` |
| `service-worker.js` | `26400890a276896d698e009055c6f38fb71ba50a14b1d5df40d8f33b5d0d0c43` |

Any later mismatch requires explicit review; it must not be automatically overwritten or normalized.
