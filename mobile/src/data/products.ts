import { Product } from '@/types';

// Generic mood/concept imagery for onboarding tiles (aesthetics + categories are
// abstract concepts, not real products, so a placeholder image service is fine here).
function moodImg(tags: string, w: number, h: number, lock: number) {
  return `https://loremflickr.com/${w}/${h}/${tags}?lock=${lock}`;
}

export const ONBOARDING_STEPS = [
  {
    key: 'brands' as const,
    title: 'Brands you gravitate toward',
    subtitle: 'Tap the ones that feel like you.',
    options: [
      { id: 'every-other-thursday', label: 'Every Other Thursday', img: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/ButterBlueStripeRDS.jpg?v=1775412290' },
      { id: 'gardenheir',           label: 'Gardenheir',            img: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Toquilla-Camouflage-Hat-4.jpg?v=1723348686' },
      { id: 'chamula',              label: 'Chamula',                img: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/8536251M-MO-Smile-Moc-Moca.jpg?v=1773430108' },
      { id: 'oree-new-york',        label: 'Orée New York',          img: 'https://static.wixstatic.com/media/5d3369_384a0bfdcffa4ad38fc295287a8361c3~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg' },
      { id: 'necessaire',           label: 'Nécessaire',             img: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_THEEUCALYPTUSWATER.jpg?v=1779917039' },
    ],
  },
  {
    key: 'styles' as const,
    title: 'Aesthetics that speak to you',
    subtitle: 'Your taste, in a few taps.',
    options: [
      { id: 'minimalist',  label: 'minimalist',  img: moodImg('minimalist,interior,white', 300, 300, 201) },
      { id: 'maximalist',  label: 'maximalist',  img: moodImg('colorful,pattern,maximalist', 300, 300, 202) },
      { id: 'streetwear',  label: 'streetwear',  img: moodImg('streetwear,urban,fashion', 300, 300, 203) },
      { id: 'vintage',     label: 'vintage',     img: moodImg('vintage,fashion,retro', 300, 300, 204) },
      { id: 'coastal',     label: 'coastal',     img: moodImg('coastal,beach,linen', 300, 300, 205) },
      { id: 'cottagecore', label: 'cottagecore', img: moodImg('cottagecore,floral,countryside', 300, 300, 206) },
      { id: 'industrial',  label: 'industrial',  img: moodImg('industrial,loft,concrete', 300, 300, 207) },
      { id: 'boho',        label: 'boho',        img: moodImg('bohemian,textile,decor', 300, 300, 208) },
    ],
  },
  {
    key: 'categories' as const,
    title: "What are you shopping for?",
    subtitle: "Last step — we'll tailor your feed.",
    options: [
      { id: 'clothing',    label: 'clothing',    img: moodImg('clothing,rack,fashion', 300, 300, 301) },
      { id: 'shoes',       label: 'shoes',       img: moodImg('shoes,sneakers', 300, 300, 302) },
      { id: 'bags',        label: 'bags',        img: moodImg('handbag,tote,leather', 300, 300, 303) },
      { id: 'accessories', label: 'accessories', img: moodImg('accessories,scarf,belt', 300, 300, 304) },
      { id: 'home',        label: 'home',        img: moodImg('homedecor,interior', 300, 300, 305) },
      { id: 'beauty',      label: 'beauty',      img: moodImg('cosmetics,beauty,skincare', 300, 300, 306) },
    ],
  },
];

// Catalog data (products) moved to Supabase — see src/store/useProductsStore.ts
// for getProducts()/getProductById(). The 29 products that used to be
// hardcoded here are now seeded via supabase/migrations/007_seed_products.sql.

export const EDITORIAL_STRIPS: {
  title: string;
  subtitle: string;
  bg: string;
  fg: string;
  filter: (p: Product, i: number) => boolean;
}[] = [
  {
    title: 'just in',
    subtitle: 'The latest from brands we\'re watching.',
    bg: '#FF4422',
    fg: '#FFF8F0',
    filter: (_p, i) => i % 3 === 0,
  },
  {
    title: 'stripped back',
    subtitle: 'Considered objects. Nothing extra.',
    bg: '#0D1035',
    fg: '#FFF8F0',
    filter: (p) => p.styles?.includes('minimalist') ?? false,
  },
  {
    title: 'under $60',
    subtitle: 'Quality that doesn\'t ask for much.',
    bg: '#D6E849',
    fg: '#0D1035',
    filter: (p) => p.price < 60,
  },
];
