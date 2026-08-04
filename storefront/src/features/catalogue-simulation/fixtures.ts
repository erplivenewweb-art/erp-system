import type {
  CatalogueCategory,
  CatalogueProduct,
  ProductMedia,
  ProductVariant,
} from "./types";

export const developmentCategories: readonly CatalogueCategory[] = [
  {
    id: "dev-category-sankha",
    slug: "sankha",
    title: "Silver Sankha",
    description: "Fictional ceremonial forms for development presentation.",
  },
  {
    id: "dev-category-pola",
    slug: "pola",
    title: "Silver Pola",
    description: "Fictional silver Pola forms and paired styles.",
  },
  {
    id: "dev-category-gold-plated",
    slug: "gold-plated",
    title: "Gold-plated Jewellery",
    description: "Fictional gold-plated presentation pieces.",
  },
  {
    id: "dev-category-related",
    slug: "related-jewellery",
    title: "Related Jewellery",
    description: "Fictional complementary jewellery forms.",
  },
] as const;

const category = (slug: string) => {
  const match = developmentCategories.find((item) => item.slug === slug);
  if (!match) throw new Error(`Development category missing: ${slug}`);
  return match;
};

const media = (slug: string, title: string): readonly ProductMedia[] => [
  {
    id: `${slug}-media-primary`,
    alt: `Development placeholder showing the primary view of ${title}`,
    label: "Primary view",
    aspectRatio: "portrait",
  },
  {
    id: `${slug}-media-detail`,
    alt: `Development placeholder showing a detail view of ${title}`,
    label: "Detail view",
    aspectRatio: "square",
  },
  {
    id: `${slug}-media-pairing`,
    alt: `Development placeholder showing a styling view of ${title}`,
    label: "Styling view",
    aspectRatio: "landscape",
  },
];

const variants = (
  slug: string,
  values: readonly [
    size: string,
    weight: string,
    availability: ProductVariant["availability"],
  ][],
): readonly ProductVariant[] =>
  values.map(([size, weight, availability], index) => ({
    id: `${slug}-variant-${index + 1}`,
    size,
    weight,
    availability,
  }));

export const developmentProducts: readonly CatalogueProduct[] = [
  {
    id: "dev-product-sankha-heritage",
    slug: "silver-sankha-heritage",
    title: "Silver Sankha Heritage",
    subtitle: "A softly contoured ceremonial form",
    description:
      "A fictional development piece balancing a traditional silhouette with a restrained polished finish.",
    category: category("sankha"),
    purity: "925_SILVER",
    variants: variants("silver-sankha-heritage", [
      ["2.4", "18–20 g", "IN_STOCK"],
      ["2.6", "20–22 g", "LOW_STOCK"],
      ["2.8", "22–24 g", "MADE_TO_ORDER"],
    ]),
    media: media("silver-sankha-heritage", "Silver Sankha Heritage"),
    price: {
      currency: "INR",
      amount: 4850,
      label: "Simulated retail ₹4,850",
      simulated: true,
    },
    availability: "IN_STOCK",
    badges: ["FEATURED"],
    highlights: [
      "Fictional 925 silver specification",
      "Smooth interior profile",
      "Three presentation sizes",
    ],
    care: [
      "Keep dry between wears",
      "Store separately",
      "Use a soft, non-abrasive cloth",
    ],
    b2cVisible: true,
    b2bVisible: true,
    seo: {
      title: "Silver Sankha Heritage — Development Catalogue",
      description:
        "Fictional Silver Sankha product used for development simulation.",
      canonicalPath: "/products/silver-sankha-heritage",
    },
  },
  {
    id: "dev-product-sankha-moonline",
    slug: "silver-sankha-moonline",
    title: "Silver Sankha Moonline",
    subtitle: "A slender form with a satin contour",
    description:
      "A fictional contemporary Sankha presentation with a satin exterior and polished edge detail.",
    category: category("sankha"),
    purity: "999_SILVER",
    variants: variants("silver-sankha-moonline", [
      ["2.4", "16–18 g", "LOW_STOCK"],
      ["2.6", "18–20 g", "MADE_TO_ORDER"],
    ]),
    media: media("silver-sankha-moonline", "Silver Sankha Moonline"),
    price: {
      currency: "INR",
      amount: 5400,
      label: "Simulated retail ₹5,400",
      simulated: true,
    },
    availability: "LOW_STOCK",
    badges: ["NEW"],
    highlights: [
      "Fictional fine-silver specification",
      "Satin development finish",
      "Two presentation sizes",
    ],
    care: [
      "Avoid moisture and perfume",
      "Store in a soft pouch",
      "Polish only with an approved cloth",
    ],
    b2cVisible: true,
    b2bVisible: false,
    seo: {
      title: "Silver Sankha Moonline — Development Catalogue",
      description:
        "Fictional fine-silver Sankha used for development simulation.",
      canonicalPath: "/products/silver-sankha-moonline",
    },
  },
  {
    id: "dev-product-pola-classic",
    slug: "silver-pola-classic",
    title: "Silver Pola Classic",
    subtitle: "A rounded Pola profile for considered pairing",
    description:
      "A fictional Silver Pola with a clean rounded profile, created solely for catalogue testing.",
    category: category("pola"),
    purity: "925_SILVER",
    variants: variants("silver-pola-classic", [
      ["2.4", "14–16 g", "IN_STOCK"],
      ["2.6", "16–18 g", "IN_STOCK"],
      ["2.8", "18–20 g", "LOW_STOCK"],
    ]),
    media: media("silver-pola-classic", "Silver Pola Classic"),
    price: {
      currency: "INR",
      amount: 4250,
      label: "Simulated retail ₹4,250",
      simulated: true,
    },
    availability: "IN_STOCK",
    badges: ["FEATURED"],
    highlights: [
      "Fictional 925 silver specification",
      "Rounded profile",
      "Pairing-friendly proportions",
    ],
    care: [
      "Wipe after wear",
      "Avoid harsh chemicals",
      "Store away from harder jewellery",
    ],
    b2cVisible: true,
    b2bVisible: true,
    seo: {
      title: "Silver Pola Classic — Development Catalogue",
      description: "Fictional Silver Pola used for development simulation.",
      canonicalPath: "/products/silver-pola-classic",
    },
  },
  {
    id: "dev-product-pola-river",
    slug: "silver-pola-river",
    title: "Silver Pola River",
    subtitle: "A gently tapered development silhouette",
    description:
      "A fictional tapered Pola form with a quiet linear accent and no connection to live stock.",
    category: category("pola"),
    purity: "925_SILVER",
    variants: variants("silver-pola-river", [
      ["2.6", "17–19 g", "MADE_TO_ORDER"],
      ["2.8", "19–21 g", "MADE_TO_ORDER"],
    ]),
    media: media("silver-pola-river", "Silver Pola River"),
    price: {
      currency: "INR",
      amount: 4650,
      label: "Simulated retail ₹4,650",
      simulated: true,
    },
    availability: "MADE_TO_ORDER",
    badges: ["MADE_TO_ORDER"],
    highlights: [
      "Fictional silver specification",
      "Tapered development profile",
      "Presentation-only sizing",
    ],
    care: ["Store dry", "Keep away from chlorine", "Use gentle surface care"],
    b2cVisible: true,
    b2bVisible: true,
    seo: {
      title: "Silver Pola River — Development Catalogue",
      description:
        "Fictional made-to-order Pola used for development simulation.",
      canonicalPath: "/products/silver-pola-river",
    },
  },
  {
    id: "dev-product-gilded-arc",
    slug: "gilded-arc-bangle",
    title: "Gilded Arc Bangle",
    subtitle: "A warm-toned presentation accent",
    description:
      "A fictional gold-plated jewellery piece for testing mixed-material catalogue presentation.",
    category: category("gold-plated"),
    purity: "GOLD_PLATED",
    variants: variants("gilded-arc-bangle", [
      ["2.4", "12–14 g", "IN_STOCK"],
      ["2.6", "14–16 g", "IN_STOCK"],
    ]),
    media: media("gilded-arc-bangle", "Gilded Arc Bangle"),
    price: {
      currency: "INR",
      amount: 3200,
      label: "Simulated retail ₹3,200",
      simulated: true,
    },
    availability: "IN_STOCK",
    badges: ["NEW"],
    highlights: [
      "Fictional plated finish",
      "Lightweight presentation",
      "Two simulated sizes",
    ],
    care: [
      "Avoid water and fragrance",
      "Do not use silver polish",
      "Store in a soft dry pouch",
    ],
    b2cVisible: true,
    b2bVisible: false,
    seo: {
      title: "Gilded Arc Bangle — Development Catalogue",
      description:
        "Fictional gold-plated bangle used for development simulation.",
      canonicalPath: "/products/gilded-arc-bangle",
    },
  },
  {
    id: "dev-product-ceremonial-pair",
    slug: "ceremonial-sankha-pola-pair",
    title: "Ceremonial Sankha Pola Pair",
    subtitle: "A fictional paired presentation",
    description:
      "A development-only paired set designed to exercise wholesale visibility and related-product layouts.",
    category: category("related-jewellery"),
    purity: "925_SILVER",
    variants: variants("ceremonial-sankha-pola-pair", [
      ["2.6 pair", "38–42 g", "LOW_STOCK"],
      ["2.8 pair", "42–46 g", "OUT_OF_STOCK"],
    ]),
    media: media("ceremonial-sankha-pola-pair", "Ceremonial Sankha Pola Pair"),
    price: {
      currency: "INR",
      amount: 8900,
      label: "Simulated retail ₹8,900",
      simulated: true,
    },
    availability: "LOW_STOCK",
    badges: ["FEATURED"],
    highlights: [
      "Fictional paired presentation",
      "Wholesale enquiry indicator",
      "No live availability",
    ],
    care: [
      "Store each form separately",
      "Keep dry",
      "Use a soft cloth after handling",
    ],
    b2cVisible: true,
    b2bVisible: true,
    seo: {
      title: "Ceremonial Sankha Pola Pair — Development Catalogue",
      description: "Fictional ceremonial pair used for development simulation.",
      canonicalPath: "/products/ceremonial-sankha-pola-pair",
    },
  },
] as const;
