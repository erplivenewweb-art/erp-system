export interface NavigationItem {
  href: string;
  label: string;
  openInNewTab?: boolean;
  children?: readonly NavigationItem[];
  future?: boolean;
}

export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  {
    href: "/products",
    label: "Categories",
    children: [
      { href: "/products/category/sankha", label: "Silver Sankha" },
      { href: "/products/category/pola", label: "Silver Pola" },
      {
        href: "/products/category/gold-plated",
        label: "Gold-plated Jewellery",
      },
      {
        href: "/products/category/related-jewellery",
        label: "Related Jewellery",
      },
    ],
  },
  {
    href: "/collections",
    label: "Collections",
    children: [
      { href: "/collections/silver-sankha", label: "Silver Sankha" },
      { href: "/collections/silver-pola", label: "Silver Pola" },
      { href: "/collections/signatures", label: "Signature collections" },
    ],
  },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/wholesale", label: "Wholesale" },
];

export const secondaryNavigation: readonly NavigationItem[] = [
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog", future: true },
  { href: "/reviews", label: "Reviews", future: true },
  { href: "/dealer", label: "Dealer", future: true },
];

export const footerGroups = [
  {
    title: "Discover",
    links: [
      { href: "/collections", label: "Collections" },
      { href: "/shop", label: "Shop" },
      { href: "/custom-orders", label: "Custom Orders" },
    ],
  },
  {
    title: "Our making",
    links: [
      { href: "/craftsmanship", label: "Craftsmanship" },
      { href: "/manufacturing", label: "Manufacturing" },
      { href: "/about", label: "Our Story" },
    ],
  },
  {
    title: "Customer care",
    links: [
      { href: "/guides", label: "Care Guides" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Wholesale",
    links: [
      { href: "/wholesale", label: "Partner with us" },
      { href: "/dealer", label: "Dealer portal" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/policies/privacy", label: "Privacy" },
      { href: "/policies/terms", label: "Terms" },
      { href: "/policies/delivery-returns", label: "Delivery & Returns" },
    ],
  },
] as const;
