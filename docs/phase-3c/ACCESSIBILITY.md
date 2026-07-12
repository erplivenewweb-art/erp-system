# Accessibility

- Semantic header, primary/secondary/mobile nav, main, footer and grouped footer navigation landmarks.
- First-focus skip link targets the stable main landmark.
- Visible global focus ring; 44px minimum controls and floating action.
- Drawer uses native dialog semantics, accessible name, explicit close, Escape/cancel, focus trap and focus restoration.
- Mega menus use keyboard-operable native disclosure semantics; destinations are not hover-only.
- Newsletter has a persistent label, semantic email type and autocomplete.
- Icons are decorative inside named controls; icon-only links have accessible labels.
- Reduced-motion media rules remove drawer/disclosure transitions.
- Axe shell foundation passes with jsdom color-contrast computation excluded; manual viewport inspection found no overflow.

