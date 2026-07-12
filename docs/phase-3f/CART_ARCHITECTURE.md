# Cart Architecture

`src/features/cart/` owns the typed synthetic item fixture, responsive cart item, quantity/action controls, order summary, price rows, empty cart and two mini-cart drawer states. Quantity, removal and save controls are intentionally inert.

The mini cart is the only cart client boundary. It composes the established native-dialog Drawer, which supplies modal isolation, Escape behavior, initial focus and focus restoration. Both populated and empty variants are available from the cart screen without changing the global Phase 3C header.

Subtotal, shipping, taxes and estimated total are explicit placeholders. No arithmetic, stock check, pricing, persistence or checkout mutation exists.
