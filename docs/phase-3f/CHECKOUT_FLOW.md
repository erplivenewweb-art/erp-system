# Checkout Flow

The checkout experience is a server-rendered form presentation composed from small reusable cards: shipping address, billing-same choice, shipping method, payment placeholder, coupon, gift note, review/consent and order summary.

The accessible five-step navigation is Cart, Address, Payment, Review and Confirmation. `aria-current="step"` identifies the active stage. The Place Order control is explicitly `type="button"`; it cannot submit. A separate link opens the synthetic confirmation preview.

The success screen labels order number, invoice and tracking as ungenerated or unavailable. `/orders` provides the no-orders state. No address, credential, payment, order, invoice or tracking data is stored or transmitted.
