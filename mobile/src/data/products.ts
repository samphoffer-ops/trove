import { Product } from '@/types';

// Onboarding steps, in order. The reveal isn't a data step, it always follows
// the last one. Image-led per Sam's decision on #56, which replaces spec §7's
// brand-picks first step: image yes/no, then never-show, then the reveal.
//
// Option ids are the exact values the catalog stores in products.styles and
// products.category, so selections can be matched without a lookup table.

export type NeverShowStep = {
  key: 'neverShow';
  title: string;
  subtitle: string;
  groups: { field: 'styles' | 'categories'; label: string; options: { id: string; label: string }[] }[];
};

export type OnboardingPick = {
  id: string;
  brand: string;
  name: string;
  image: string;
  // products.ratio (height / width): sizes the frame. The image is never cropped.
  ratio: number;
  // Placeholder while the image loads, computed from the image (#108).
  blurhash: string;
  category: string;
  styles: string[];
};

export type ImagePicksStep = {
  key: 'imagePicks';
  title: string;
  subtitle: string;
  products: OnboardingPick[];
};

export type OnboardingStep = NeverShowStep | ImagePicksStep;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'imagePicks',
    // The first screen after sign-in, so the title says what's happening.
    title: 'Let\'s find your taste',
    subtitle: 'Yes or no, one piece at a time. Go with your gut.',
    // Seeded catalog products (supabase/migrations/007_seed_products.sql),
    // images exactly as scraped. Spread across brands, categories and styles.
    products: [
      {
        id: 'eot-relaxed-button-down', brand: 'Every Other Thursday', name: 'Relaxed Button Down in Butter Blue Stripe',
        category: 'clothing', styles: ['coastal', 'minimalist'], ratio: 1.25,
        image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/ButterBlueStripeRDS.jpg?v=1775412290',
        blurhash: 'TGQJo].8~3-;j[oK~2jYE9%Mj[WX',
      },
      {
        id: 'oree-crossborder-trainer', brand: 'Orée New York', name: 'Crossborder Trainer 0-70 Sneaker (Antique Brown)',
        category: 'shoes', styles: ['streetwear'], ratio: 1,
        image: 'https://static.wixstatic.com/media/5d3369_de9ace6fc89c4631ba1b6160f71106c3~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
        blurhash: 'TLHK%zM|%1~payNHs+s:R*9aWVs:',
      },
      {
        id: 'chamula-cardigan', brand: 'Chamula', name: 'Souvenir Paisaje Zipper Cardigan - Ivory',
        category: 'clothing', styles: ['boho', 'maximalist'], ratio: 1.5,
        image: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/SOUVENIR-PAISAJE-ZIPPER-CARDIGAN-IVORY.jpg?v=1770343464',
        blurhash: 'TVSFz[%2%hxuayoz?wkCM_t8j[WA',
      },
      {
        id: 'gh-work-jacket', brand: 'Le Laboureur x Gardenheir', name: 'Stonewashed Work Jacket in Light Denim',
        category: 'clothing', styles: ['industrial', 'vintage'], ratio: 1,
        image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/StonewashedWorkJacket_LightDenim_039.jpg?v=1780425686',
        blurhash: 'ToJk$Sxa~pxuWBay_2ofWB%Mt7t6',
      },
      {
        id: 'eot-leather-max-bag', brand: 'Every Other Thursday', name: 'Leather Max Bag',
        category: 'bags', styles: ['vintage', 'minimalist'], ratio: 1.25,
        image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/MaxBagfrontbrown_e13783c5-a536-411b-bfe9-1e9293e47a9c.jpg?v=1771346034',
        blurhash: 'TaO|U+xu~q?bj[M{_3j[9FD%ay%M',
      },
      {
        id: 'necessaire-rosemary-mask', brand: 'Nécessaire', name: 'Rosemary Leave-In Mask',
        category: 'beauty', styles: ['minimalist', 'boho'], ratio: 1.17,
        image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_ROSEMARYMASK.jpg?v=1765906488',
        blurhash: 'TfPs#Bxu~q%MfQWB?cfQ9Ft7j[of',
      },
      {
        id: 'oree-military-jacket', brand: 'Orée New York', name: 'O-65 Military Field Jacket (Black)',
        category: 'clothing', styles: ['streetwear', 'industrial'], ratio: 1,
        image: 'https://static.wixstatic.com/media/5d3369_983a77b79f174a26aa891ebaef0a4269~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
        blurhash: 'TkMHGZ%N~q^+j]fk~qWV9GWBj[WB',
      },
      {
        id: 'gh-straw-hat', brand: 'Gardenheir', name: 'Handwoven Toquilla Straw Hat in Camouflage',
        category: 'accessories', styles: ['coastal', 'boho'], ratio: 1,
        image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Toquilla-Camouflage-Hat-4.jpg?v=1723348686',
        blurhash: 'TjOgHEt7~qD%WB-;%Mj[M{?bofM{',
      },
      {
        id: 'eot-club-loafer', brand: 'Every Other Thursday', name: 'The Club Loafer',
        category: 'shoes', styles: ['vintage', 'coastal'], ratio: 1.25,
        image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/LoaferSide2.jpg?v=1781631237',
        blurhash: 'TNQck-xu-;%Mayay~qt7D%%2ofof',
      },
      {
        id: 'gh-muse-lamp', brand: 'Tala', name: 'The Muse 2.0 Portable Lamp in Solid Brass',
        category: 'home', styles: ['industrial', 'minimalist'], ratio: 1,
        image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Tala-Muse-Solid-Brass-packshot-7.jpg?v=1781626733',
        blurhash: 'TGRV|Q-;.A_3oMROWYfRoI%Kj@x]',
      },
    ],
  },
  {
    key: 'neverShow',
    title: 'Never show me',
    subtitle: 'Anything you\'d skip every time. Leave it blank if nothing.',
    groups: [
      {
        field: 'styles',
        label: 'Styles',
        options: [
          { id: 'minimalist',  label: 'Minimalist' },
          { id: 'maximalist',  label: 'Maximalist' },
          { id: 'streetwear',  label: 'Streetwear' },
          { id: 'vintage',     label: 'Vintage' },
          { id: 'coastal',     label: 'Coastal' },
          { id: 'cottagecore', label: 'Cottagecore' },
          { id: 'industrial',  label: 'Industrial' },
          { id: 'boho',        label: 'Boho' },
        ],
      },
      {
        field: 'categories',
        label: 'Categories',
        options: [
          { id: 'clothing',    label: 'Clothing' },
          { id: 'shoes',       label: 'Shoes' },
          { id: 'bags',        label: 'Bags' },
          { id: 'accessories', label: 'Accessories' },
          { id: 'home',        label: 'Home' },
          { id: 'beauty',      label: 'Beauty' },
        ],
      },
    ],
  },
];

// Catalog data (products) moved to Supabase — see src/store/useProductsStore.ts
// for getProducts()/getProductById(). The 29 products that used to be
// hardcoded here are now seeded via supabase/migrations/007_seed_products.sql.

// Mini-edits for the feed's editorial bento blocks (docs/design-spec.md §7
// Feed). Each names a small set of products under an oversized italic header.
// 'just-in' and 'new-from-brand' are resolved in the feed (they need the
// viewer's followed brands and the brand list); the rest match on a filter.
export type EditKind = 'just-in' | 'new-from-brand' | 'filter';

export const EDITS: {
  id: string;
  title: string;
  kind: EditKind;
  filter?: (p: Product) => boolean;
}[] = [
  { id: 'just-in',       title: 'Just in',       kind: 'just-in' },
  { id: 'stripped-back', title: 'Stripped back', kind: 'filter', filter: (p) => p.styles?.includes('minimalist') ?? false },
  { id: 'quiet-linen',   title: 'Quiet linen',   kind: 'filter', filter: (p) => p.styles?.includes('coastal') ?? false },
  // Repeats once per brand: "New from [Brand]"
  { id: 'new-from',      title: 'New from',      kind: 'new-from-brand' },
];
