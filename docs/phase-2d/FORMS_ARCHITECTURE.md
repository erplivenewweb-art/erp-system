# Forms Architecture

Forms cover registration, dealer application, profile, address, checkout, quotations, custom orders, reviews, contact, newsletter, CMS and media upload. Domain contract/schema owner defines canonical rules; client mirrors for speed but server is authoritative.

Use typed schema adapters, accessible field components and server-error mapping by stable field/code. Validate on blur/submit without hostile keystroke errors. Draft saving is scoped/versioned and excludes secrets/payment data; dealer/CMS drafts are server-side. File uploads use signed direct flow and validation pipeline.

All consequential POSTs carry idempotency keys; duplicate normalized dealer applications, newsletter requests and orders return prior/safe outcome. Multi-step forms use version/ETag, save/resume, summary and focus restoration. Mass assignment is prevented through explicit payload construction.

