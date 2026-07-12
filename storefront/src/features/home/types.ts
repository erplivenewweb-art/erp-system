export interface HomeLink { href: string; label: string; }
export interface HomeMedia { alt: string; eyebrow: string; ratio: "landscape" | "portrait" | "square"; }
export interface HomeCard { description: string; href: string; media?: HomeMedia; title: string; }
export interface HomeSectionCopy { description: string; eyebrow: string; title: string; }
export interface HomeFaq { answer: string; id: string; question: string; }
export interface HomeContent {
  hero: HomeSectionCopy & { primary: HomeLink; secondary: HomeLink; media: HomeMedia; };
  trust: readonly { title: string; description: string }[];
  collections: HomeSectionCopy & { items: readonly HomeCard[] };
  products: HomeSectionCopy & { items: readonly { name: string; availability: string }[] };
  manufacturing: HomeSectionCopy & { action: HomeLink; media: HomeMedia };
  workshop: HomeSectionCopy & { items: readonly HomeCard[] };
  purity: HomeSectionCopy & { points: readonly { title: string; description: string }[] };
  custom: HomeSectionCopy & { action: HomeLink; media: HomeMedia };
  wholesale: HomeSectionCopy & { action: HomeLink; points: readonly string[] };
  packaging: HomeSectionCopy & { media: HomeMedia; points: readonly string[] };
  reviews: HomeSectionCopy & { items: readonly { author: string; text: string }[] };
  social: HomeSectionCopy & { items: readonly HomeCard[] };
  journal: HomeSectionCopy & { items: readonly HomeCard[] };
  faq: HomeSectionCopy & { action: HomeLink; items: readonly HomeFaq[] };
}

