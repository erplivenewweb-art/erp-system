export const accountNavigation = [
  { href: "/account", label: "Overview" }, { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" }, { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Security" }, { href: "/account/notifications", label: "Notifications" },
  { href: "/wishlist", label: "Wishlist" },
] as const;
export const syntheticOrders = [{ slug: "sample-order", title: "Synthetic order preview", status: "Preview status — not a live order", date: "Date pending", total: "Total unavailable" }] as const;
export const syntheticNotifications = [
  { title: "Profile reminder preview", body: "Synthetic notification — no message was delivered.", unread: true },
  { title: "Care guide placeholder", body: "A future CMS notification slot without customer activity.", unread: false },
] as const;
