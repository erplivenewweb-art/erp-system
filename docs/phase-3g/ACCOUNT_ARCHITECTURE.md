# Account Architecture

`src/features/account/` owns the shared responsive shell, account navigation, dashboard, notification presentation and centralized synthetic fixtures. Feature-specific order, address, profile and security modules compose the shell without duplicating navigation.

Routes live under `/account`, preserving the Phase 3F `/orders` empty-state screen. Navigation covers Overview, Orders, Addresses, Profile, Security, Notifications, Phase 3F Wishlist and a non-functional logout placeholder.

Server Components render every Phase 3G screen. No Phase 3G client boundary or dependency was required.
