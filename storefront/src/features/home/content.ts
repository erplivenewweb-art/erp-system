import type { HomeContent } from "./types";

export const homeContent: HomeContent = {
  hero: {
    eyebrow: "Silver Sankha Jewellery House",
    title: "Ceremonial silver, shaped with modern discipline.",
    description:
      "Discover Silver Sankha and Silver Pola from a manufacturer-led jewellery house built around clear product facts, considered design and dignified service.",
    primary: { href: "/products", label: "Shop the simulated catalogue" },
    secondary: { href: "/wholesale", label: "Partner with us" },
    media: {
      alt: "Reserved editorial media space for a Silver Sankha composition",
      eyebrow: "CMS editorial media · 4:5",
      ratio: "portrait",
    },
  },
  trust: [
    {
      title: "Manufacturer-led",
      description:
        "Our public story begins with design and making, without exposing workshop secrets.",
    },
    {
      title: "Material clarity",
      description:
        "Approved purity language belongs beside its source and review owner.",
    },
    {
      title: "Weight and size context",
      description:
        "Product facts will state units, variation and source clearly.",
    },
    {
      title: "Considered presentation",
      description:
        "Packaging and support claims remain factual and approval-led.",
    },
  ],
  collections: {
    eyebrow: "Product worlds",
    title: "Begin with a form that carries meaning.",
    description:
      "Four clear paths support retail discovery, personal commissions and trade relationships.",
    items: [
      {
        title: "Silver Sankha",
        description:
          "A signature ceremonial form presented with calm, precise detail.",
        href: "/collections/silver-sankha",
        media: {
          alt: "Reserved collection media for Silver Sankha",
          eyebrow: "Collection media",
          ratio: "portrait",
        },
      },
      {
        title: "Silver Pola",
        description:
          "A complementary silver expression for considered pairings.",
        href: "/collections/silver-pola",
        media: {
          alt: "Reserved collection media for Silver Pola",
          eyebrow: "Collection media",
          ratio: "portrait",
        },
      },
      {
        title: "Custom Orders",
        description:
          "A future guided path for approved size and design conversations.",
        href: "/custom-orders",
        media: {
          alt: "Reserved media for the custom-order service",
          eyebrow: "Service media",
          ratio: "portrait",
        },
      },
      {
        title: "Wholesale",
        description:
          "A separate public introduction for eligible retail and trade partners.",
        href: "/wholesale",
        media: {
          alt: "Reserved wholesale catalogue media",
          eyebrow: "Trade media",
          ratio: "portrait",
        },
      },
    ],
  },
  products: {
    eyebrow: "Retail preview",
    title: "Forms selected for closer consideration.",
    description:
      "Synthetic shells demonstrate the future public product rhythm. They contain no live price, stock or wholesale data.",
    items: [
      { name: "Sankha Form No. 01", availability: "Retail preview only" },
      { name: "Pola Form No. 02", availability: "Retail preview only" },
      { name: "Ceremonial Pair No. 03", availability: "Retail preview only" },
      { name: "Silver Form No. 04", availability: "Retail preview only" },
    ],
  },
  manufacturing: {
    eyebrow: "Manufacturer perspective",
    title: "From design discipline to a finished form.",
    description:
      "Our future manufacturing story will explain repeatability, tools and quality checks in customer-safe language—without revealing recipes, internal systems or unsupported claims.",
    action: { href: "/craftsmanship", label: "Explore our craftsmanship" },
    media: {
      alt: "Reserved wide media for the manufacturing story",
      eyebrow: "Poster-first workshop story · no autoplay",
      ratio: "landscape",
    },
  },
  workshop: {
    eyebrow: "Workshop and people",
    title: "The place, tools and hands behind the work.",
    description:
      "Media and human stories require consent, correct context and editorial review before publication.",
    items: [
      {
        title: "The workshop",
        description:
          "A future visual essay about place, tools and working rhythm.",
        href: "/manufacturing",
        media: {
          alt: "Reserved workshop environment media",
          eyebrow: "Rights-cleared media slot",
          ratio: "landscape",
        },
      },
      {
        title: "Craft practice",
        description:
          "A respectful account of skill and transformation, never romanticized or fabricated.",
        href: "/craftsmanship",
        media: {
          alt: "Reserved artisan craft media",
          eyebrow: "Consent-required media slot",
          ratio: "landscape",
        },
      },
    ],
  },
  purity: {
    eyebrow: "Facts before claims",
    title: "A promise to explain what matters.",
    description:
      "This shell reserves space for compliance-reviewed product facts. It does not claim a hallmark, certificate or standard.",
    points: [
      {
        title: "Purity",
        description:
          "Approved terminology and its evidence source will appear together.",
      },
      {
        title: "Weight",
        description:
          "Units, variability and measurement context will be explicit.",
      },
      {
        title: "Size",
        description:
          "Fit guidance will distinguish nominal and measured dimensions.",
      },
      {
        title: "Quality checks",
        description:
          "Only reviewed, customer-safe process descriptions will be published.",
      },
    ],
  },
  custom: {
    eyebrow: "Personal commissions",
    title: "Begin a considered custom-order conversation.",
    description:
      "A future enquiry path will capture size and design intent without implying automatic acceptance, price or delivery timing.",
    action: { href: "/custom-orders", label: "Explore custom orders" },
    media: {
      alt: "Reserved custom design consultation media",
      eyebrow: "Custom service media",
      ratio: "square",
    },
  },
  wholesale: {
    eyebrow: "For retail and trade partners",
    title: "Build a direct manufacturer relationship.",
    description:
      "Eligible dealers will receive authorized catalogue, MOQ and quotation information only after the appropriate approval flow. No wholesale prices are public.",
    action: { href: "/wholesale", label: "Become a dealer" },
    points: [
      "Eligibility-led registration",
      "Clear MOQ context",
      "Versioned quotations",
      "Separate dealer access",
    ],
  },
  packaging: {
    eyebrow: "Presentation",
    title: "A quiet finish to the ownership experience.",
    description:
      "This CMS-ready shell can explain approved packaging contents and care information without implying unverified sustainability, gifting or protection claims.",
    media: {
      alt: "Reserved premium packaging still-life media",
      eyebrow: "Packaging media",
      ratio: "landscape",
    },
    points: [
      "Contents stated clearly",
      "Care information included when approved",
      "Gift presentation described factually",
    ],
  },
  reviews: {
    eyebrow: "Review system preview",
    title: "Customer voices belong here—with verification rules.",
    description:
      "The following neutral cards are synthetic layout copy, not customer reviews or verified-purchase claims.",
    items: [
      {
        author: "Synthetic layout sample",
        text: "Reserved for a moderated customer perspective after review eligibility and consent are implemented.",
      },
      {
        author: "Synthetic layout sample",
        text: "Reserved for useful ownership feedback, with status labels governed by evidence rather than decoration.",
      },
    ],
  },
  social: {
    eyebrow: "Stories in motion",
    title: "Poster-first spaces for social and film.",
    description: "No third-party scripts or embeds load on this homepage.",
    items: [
      {
        title: "Instagram story slot",
        description:
          "A future rights-cleared visual story with consent-aware loading.",
        href: "/social/instagram",
        media: {
          alt: "Reserved Instagram-ready story media",
          eyebrow: "No external embed",
          ratio: "square",
        },
      },
      {
        title: "YouTube film slot",
        description:
          "A future poster and transcript before any external player is activated.",
        href: "/social/youtube",
        media: {
          alt: "Reserved YouTube-ready film poster",
          eyebrow: "Poster and transcript ready",
          ratio: "landscape",
        },
      },
    ],
  },
  journal: {
    eyebrow: "Guides and journal",
    title: "Knowledge for choosing and caring well.",
    description:
      "Synthetic CMS cards reserve a clear editorial path without publishing unreviewed advice.",
    items: [
      {
        title: "A practical silver care guide",
        description: "Future approved care steps and boundaries.",
        href: "/guides/care",
      },
      {
        title: "Understanding size and fit",
        description: "Future measurement guidance with units and variability.",
        href: "/guides/size",
      },
      {
        title: "How a ceremonial form is shaped",
        description: "A future customer-safe craftsmanship story.",
        href: "/guides/craftsmanship",
      },
    ],
  },
  faq: {
    eyebrow: "Questions, answered carefully",
    title: "A clear starting point.",
    description:
      "Preview answers avoid unapproved policy, certification and delivery commitments.",
    action: { href: "/faq", label: "View all questions" },
    items: [
      {
        id: "maker",
        question: "Does Silver Sankha manufacture its own designs?",
        answer:
          "Silver Sankha is presented as a manufacturer-led jewellery house. Detailed public process claims will be published only after content review.",
      },
      {
        id: "facts",
        question: "Where will purity, weight and size be shown?",
        answer:
          "Approved facts will sit close to each product with units, variability and source wording.",
      },
      {
        id: "custom",
        question: "Can I request a custom size or design?",
        answer:
          "A future custom-order path will support enquiries. Submission will not guarantee acceptance, price or timing.",
      },
      {
        id: "dealer",
        question: "How will dealer access work?",
        answer:
          "Eligible businesses will use a separate approval journey before seeing authorized wholesale catalogue or quotation information.",
      },
      {
        id: "packaging",
        question: "What packaging is included?",
        answer:
          "Final included contents will be stated factually after merchandising and compliance approval.",
      },
    ],
  },
};
