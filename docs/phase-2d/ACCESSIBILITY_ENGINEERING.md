# Accessibility Engineering

WCAG 2.2 AA is an exit gate. Use semantic HTML/landmarks/headings/native controls first. Route changes announce title and place focus predictably. Dialogs/drawers trap and restore focus; carousels/galleries/tabs/tables implement established keyboard semantics. Dynamic price/cart/status changes use restrained live regions.

Forms have persistent labels, autocomplete, instructions, field errors and focusable summary; preserve input. 44px targets, 4.5:1 text, 3:1 UI/focus, 200% zoom/320px reflow, OS text and reduced motion are required. Loading/empty/error have semantic status and no color-only meaning.

Testing: lint/static rules, axe component/page automation, keyboard-only and screen-reader manual tests (at least NVDA/Firefox, VoiceOver/Safari, TalkBack/Chrome per approved matrix), zoom/reflow, contrast, reduced motion and disabled-user usability studies before critical releases.

