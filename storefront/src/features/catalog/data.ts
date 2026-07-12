import type { CategoryFixture, CollectionFixture, ProductFixture } from "./types";

const gallery = (name: string) => [
  { alt: `Reserved primary catalogue media for ${name}`, label: "Primary 4:5 media", ratio: "portrait" as const },
  { alt: `Reserved detail media for ${name}`, label: "Detail view", ratio: "square" as const },
  { alt: `Reserved context media for ${name}`, label: "Context view", ratio: "portrait" as const },
  { alt: `Reserved packaging media for ${name}`, label: "Packaging view", ratio: "landscape" as const },
];

export const collections: readonly CollectionFixture[] = [
  { slug: "silver-sankha", name: "Silver Sankha", eyebrow: "Signature collection", description: "Synthetic ceremonial silver forms presented with calm, precise facts.", story: "A CMS-ready collection story about form, meaning and disciplined manufacture.", featured: true, media: { alt: "Reserved Silver Sankha collection media", label: "Silver Sankha collection", ratio: "portrait" } },
  { slug: "silver-pola", name: "Silver Pola", eyebrow: "Signature collection", description: "A complementary silver collection shell for considered pairings.", story: "A future editor-owned narrative with approved terminology and rights-cleared media.", featured: true, media: { alt: "Reserved Silver Pola collection media", label: "Silver Pola collection", ratio: "portrait" } },
  { slug: "custom-orders", name: "Custom Orders", eyebrow: "Service collection", description: "A future guided path for size and design enquiries.", story: "Enquiries will not imply acceptance, price or delivery timing.", media: { alt: "Reserved custom-order collection media", label: "Custom order service", ratio: "portrait" } },
  { slug: "wholesale", name: "Wholesale Collection", eyebrow: "Trade introduction", description: "Public-safe range context for eligible dealer applicants.", story: "Authorized catalogue, MOQ and quotations remain behind future approval.", media: { alt: "Reserved wholesale collection media", label: "Wholesale collection", ratio: "portrait" } },
  { slug: "gift-collection", name: "Gift Collection", eyebrow: "Future collection", description: "A synthetic merchandising shell without occasion or delivery claims.", story: "Final contents and presentation require merchandising approval.", media: { alt: "Reserved gift collection media", label: "Gift collection", ratio: "portrait" } },
  { slug: "new-arrivals", name: "New Arrivals", eyebrow: "Editorial collection", description: "A CMS-ready shell for newly published retail forms.", story: "Publication status will be owned by the future commerce catalogue.", media: { alt: "Reserved new arrivals media", label: "New arrivals", ratio: "portrait" } },
];

export const categories: readonly CategoryFixture[] = [
  { slug: "sankha", name: "Sankha Forms", description: "Synthetic listing of Silver Sankha forms." },
  { slug: "pola", name: "Pola Forms", description: "Synthetic listing of Silver Pola forms." },
  { slug: "ceremonial-pairs", name: "Ceremonial Pairs", description: "Synthetic paired-form catalogue shell." },
];

const pendingFacts = (manufacturing: string) => ({ purity: "Approved fact pending CMS review", weight: "Weight and variability pending", size: "Measured size guide pending", material: "Silver material wording pending approval", manufacturing });

export const products: readonly ProductFixture[] = [
  { slug: "sankha-form-01", name: "Sankha Form No. 01", collection: "silver-sankha", category: "sankha", description: "A synthetic retail product shell for layout and content-model verification.", availability: "Availability not connected", priceLabel: "Retail price pending publication", featured: true, facts: pendingFacts("Manufacturer-led process summary pending"), gallery: gallery("Sankha Form No. 01") },
  { slug: "sankha-form-02", name: "Sankha Form No. 02", collection: "silver-sankha", category: "sankha", description: "A second synthetic Sankha form with no live commercial data.", availability: "Availability not connected", priceLabel: "Retail price pending publication", facts: pendingFacts("Customer-safe making note pending"), gallery: gallery("Sankha Form No. 02") },
  { slug: "pola-form-01", name: "Pola Form No. 01", collection: "silver-pola", category: "pola", description: "A synthetic Silver Pola presentation shell.", availability: "Availability not connected", priceLabel: "Retail price pending publication", featured: true, facts: pendingFacts("Manufacturer-led process summary pending"), gallery: gallery("Pola Form No. 01") },
  { slug: "pola-form-02", name: "Pola Form No. 02", collection: "silver-pola", category: "pola", description: "A synthetic product fixture for responsive catalogue verification.", availability: "Availability not connected", priceLabel: "Retail price pending publication", facts: pendingFacts("Customer-safe making note pending"), gallery: gallery("Pola Form No. 02") },
  { slug: "ceremonial-pair-01", name: "Ceremonial Pair No. 01", collection: "gift-collection", category: "ceremonial-pairs", description: "A synthetic paired-form shell without included-content claims.", availability: "Availability not connected", priceLabel: "Retail price pending publication", featured: true, facts: pendingFacts("Pairing and finishing note pending"), gallery: gallery("Ceremonial Pair No. 01") },
  { slug: "ceremonial-pair-02", name: "Ceremonial Pair No. 02", collection: "new-arrivals", category: "ceremonial-pairs", description: "A static new-arrival shell with no freshness or scarcity claim.", availability: "Availability not connected", priceLabel: "Retail price pending publication", facts: pendingFacts("Pairing and finishing note pending"), gallery: gallery("Ceremonial Pair No. 02") },
];

export const getCollection = (slug: string) => collections.find((item) => item.slug === slug);
export const getCategory = (slug: string) => categories.find((item) => item.slug === slug);
export const getProduct = (slug: string) => products.find((item) => item.slug === slug);

