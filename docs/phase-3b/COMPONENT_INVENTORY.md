# Component Inventory

48 public component primitives/shells are organized by ownership:

- Icon: Icon (1).
- Typography: Typography with display, H1–H6, lead, body, small, caption, overline, label, price and muted variants (1 API).
- Layout: Container, Section, Stack, Inline, Grid, Cluster, Center, Surface, Divider, VisuallyHidden (10).
- Actions: Button, IconButton, LinkButton (3).
- Forms: Field, Label, HelpText, ValidationMessage, Input, Textarea, Select, Checkbox, Radio, Switch (10).
- Display: Card, Badge, StatusChip, PriceBlock, AvailabilityIndicator, AvatarPlaceholder, Rating (7).
- Feedback: Spinner, Skeleton, Alert, InlineMessage, EmptyState, ErrorState, LoadingState (7).
- Navigation: Breadcrumb, Tabs, Accordion (3).
- Overlays: Modal, Drawer, Toast (3).
- Commerce shells: QuantitySelector, WishlistButton, ProductCardShell, ReviewCardShell (4).

Interactive public APIs: 16. They cover default/hover/focus/pressed/disabled/loading/error/success/selected/expanded states where relevant. All data is synthetic; commerce shells contain no persistence, API calls, price logic, entitlement, cart, wishlist or review verification.

Controlled barrel files exist per component family; no global giant barrel or cross-feature logic is introduced.

