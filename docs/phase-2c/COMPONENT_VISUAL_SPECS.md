# Component Visual Specifications

## State contract

All interactive components define default, hover, focus-visible, pressed, loading, disabled, error and success where meaningful; dark mode remaps semantics rather than inverting; motion respects reduced preference. Controls use 48px standard height/44px minimum target, 8–16px internal gaps and content-driven responsive width.

| Component | Visual specification and responsive/accessibility rule |
|---|---|
| Buttons | Ink filled primary, hairline secondary, text tertiary; focus blue ring; loading preserves width |
| Cards | Ivory/white, border before shadow; hover optional; whole-card semantics only for one destination |
| Product Cards | 4:5 image, serif title, sans facts/price, quiet wishlist; 2-up mobile/4-up desktop |
| Dealer Cards | Denser white surface, status edge/icon/text; confidential data suppressed |
| Pricing | Tabular amount, currency/tax/freshness hierarchy; wholesale never public |
| Availability | Coarse icon/text chip; freshness secondary; no quantity/branch |
| Forms | Persistent label, 48px control, clear hint/error/success; autofill and zoom safe |
| Tables | Hairline rows, strong headers, tabular numerals; responsive semantic cards |
| Search | Prominent field, grouped suggestions, keyboard highlight, no layout jump |
| Mega Menu | Gallery surface, curated columns/image; explicit open; pointer/keyboard safe |
| Drawer | Full/partial mobile sheet, scrim, focus trap/restore, safe area |
| Breadcrumbs | 14px linked trail, wraps; current item text/aria-current |
| Tabs | Ink underline/selected text; roving focus; scroll buttons on narrow width |
| Accordion | Border dividers, 44px heading control, rotating chevron optional |
| Modal | White/charcoal raised surface, max reading width, labelled, Escape/restore |
| Toast | Compact raised surface; supplementary only, pauseable, no sole error |
| Review Cards | Rating/text/date/verified rule; media subordinate; moderation-safe |
| Rating | Vermilion/ink selected stars plus numeric text; keyboard input labels |
| Image Gallery | Stable aspect, selected thumbnail border, explicit zoom, swipe/keyboard parity |
| Video Gallery | Poster/play, caption/transcript controls, no sound autoplay |
| Wishlist | 44px icon button + accessible label; filled selected state, rollback on error |
| Cart | Image/facts/quantity/price/freshness with spacious dividers; sticky summary only if fit |
| Footer | Ink inverse surface, high-contrast links, desktop columns/mobile accessible accordions |
| Header | Ivory/transparent-to-solid controlled state; 64px mobile/80px desktop |
| Navigation | Serif optional brand, sans links, current underline; no hover-only access |
| CMS Controls | Sans operational density, explicit status/version, no brand flourish over clarity |

Component count: 26.

