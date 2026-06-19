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
      { id: 'minimalist',  label: 'Minimalist',  img: moodImg('minimalist,interior,white', 300, 300, 201) },
      { id: 'maximalist',  label: 'Maximalist',  img: moodImg('colorful,pattern,maximalist', 300, 300, 202) },
      { id: 'streetwear',  label: 'Streetwear',  img: moodImg('streetwear,urban,fashion', 300, 300, 203) },
      { id: 'vintage',     label: 'Vintage',     img: moodImg('vintage,fashion,retro', 300, 300, 204) },
      { id: 'coastal',     label: 'Coastal',     img: moodImg('coastal,beach,linen', 300, 300, 205) },
      { id: 'cottagecore', label: 'Cottagecore', img: moodImg('cottagecore,floral,countryside', 300, 300, 206) },
      { id: 'industrial',  label: 'Industrial',  img: moodImg('industrial,loft,concrete', 300, 300, 207) },
      { id: 'boho',        label: 'Boho',        img: moodImg('bohemian,textile,decor', 300, 300, 208) },
    ],
  },
  {
    key: 'categories' as const,
    title: "What are you shopping for?",
    subtitle: "Last step — we'll tailor your feed.",
    options: [
      { id: 'clothing',    label: 'Clothing',    img: moodImg('clothing,rack,fashion', 300, 300, 301) },
      { id: 'shoes',       label: 'Shoes',       img: moodImg('shoes,sneakers', 300, 300, 302) },
      { id: 'bags',        label: 'Bags',        img: moodImg('handbag,tote,leather', 300, 300, 303) },
      { id: 'accessories', label: 'Accessories', img: moodImg('accessories,scarf,belt', 300, 300, 304) },
      { id: 'home',        label: 'Home',        img: moodImg('homedecor,interior', 300, 300, 305) },
      { id: 'beauty',      label: 'Beauty',      img: moodImg('cosmetics,beauty,skincare', 300, 300, 306) },
    ],
  },
];

// Real products, pulled live from each brand's storefront (Shopify products.json
// or Wix product schema) — see PRD §9 "Prototype Phase: curated static mock data
// that reflects the target aesthetic." Image URLs are hotlinked from the brands'
// own CDNs for now; pre-launch this should move to the affiliate network's feed
// per PRD §9 so images/prices stay in sync and aren't dependent on hotlinking.
export const PRODUCTS: Product[] = [
  // Every Other Thursday — preppy East Coast menswear
  {
    id: 'eot-club-loafer', brand: 'Every Other Thursday', name: 'The Club Loafer', price: 450,
    category: 'shoes', styles: ['vintage', 'coastal'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/LoaferSide2.jpg?v=1781631237',
    url: 'https://everyotherthursday.com/products/the-club-loafer',
    description: 'A collaboration with Morjas in Sweden. Crafted from soft Italian "Guanto" leather with no stiff lining and a collapsable heel — wearable from day one.',
  },
  {
    id: 'eot-relaxed-button-down', brand: 'Every Other Thursday', name: 'Relaxed Button Down in Butter Blue Stripe', price: 184,
    category: 'clothing', styles: ['coastal', 'minimalist'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/ButterBlueStripeRDS.jpg?v=1775412290',
    url: 'https://everyotherthursday.com/products/relaxed-dress-shirt-in-butter-blue-stripe',
    description: 'A wardrobe classic with an EOT approach — crisp cotton shirting in a blue and faint yellow stripe, cut with a relaxed, true-to-size fit.',
  },
  {
    id: 'eot-linen-fatigue-pants', brand: 'Every Other Thursday', name: 'Linen Fatigue Pants', price: 149,
    category: 'clothing', styles: ['coastal', 'minimalist'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/CreamLinenFatigues.jpg?v=1775412666',
    url: 'https://everyotherthursday.com/products/linen-fatigue-pants',
    description: 'Mid-weight 100% linen, cut in the standard Fatigue Pant silhouette with patch pockets, custom branded buttons, and a high rise, straight leg.',
  },
  {
    id: 'eot-leather-max-bag', brand: 'Every Other Thursday', name: 'Leather Max Bag', price: 329,
    category: 'bags', styles: ['vintage', 'minimalist'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/MaxBagfrontbrown_e13783c5-a536-411b-bfe9-1e9293e47a9c.jpg?v=1771346034',
    url: 'https://everyotherthursday.com/products/leather-max-bag',
    description: 'The daily driver. Genuine leather with a tumbled, worn-in treatment — large enough for a laptop and all your daily essentials.',
  },
  {
    id: 'eot-cashmere-vneck', brand: 'Every Other Thursday', name: 'Cashmere V-Neck Knit', price: 234,
    category: 'clothing', styles: ['minimalist', 'coastal'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/Buttervneck.jpg?v=1775413114',
    url: 'https://everyotherthursday.com/products/cashmere-v-neck-knit',
    description: "A closet staple worn like an everyday sweatshirt, but made from 100% cashmere yarn that's soft on skin and won't irritate.",
  },
  {
    id: 'eot-knitted-rugby', brand: 'Every Other Thursday', name: 'Knitted Rugby Shirt', price: 109,
    category: 'clothing', styles: ['vintage', 'coastal'], ratio: 1.25,
    image: 'https://cdn.shopify.com/s/files/1/0432/6450/8061/files/BlueRugby.jpg?v=1775412512',
    url: 'https://everyotherthursday.com/products/knitted-rugby-shirt',
    description: 'A classic utilitarian sports style with a more elegant construction — knitted like a sweater in 100% cotton with a ribbed hem and open placket.',
  },

  // Gardenheir — curated garden apparel, tools, and home goods
  {
    id: 'gh-muse-lamp', brand: 'Tala', name: 'The Muse 2.0 Portable Lamp in Solid Brass', price: 595,
    category: 'home', styles: ['industrial', 'minimalist'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Tala-Muse-Solid-Brass-packshot-7.jpg?v=1781626733',
    url: 'https://gardenheir.com/products/portable-solid-brass-led-lantern',
    description: 'An iconic British lantern reimagined for modern living — a cordless solid brass lamp, hand-polished to a rich golden finish, for table or terrace.',
  },
  {
    id: 'gh-hose-reel', brand: 'Claverton Cloches', name: 'English Garden Hose Reel', price: 460,
    category: 'home', styles: ['cottagecore'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Garden_Hose_Reel_Timeless.webp?v=1780666895',
    url: 'https://gardenheir.com/products/english-garden-hose-reel',
    description: 'High-grade stainless steel with solid hardwood handles — a refined way to store and use a garden hose, with a British Racing Green hose included.',
  },
  {
    id: 'gh-watering-can', brand: 'Haws England', name: 'Professional Series Watering Can in British Green', price: 98,
    category: 'home', styles: ['cottagecore'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Haws-Professional-Heavy-Duty-Large-Plastic-Watering-Can-2.jpg?v=1697480377',
    url: 'https://gardenheir.com/products/haws-england-professional-series-15-gallon-plastic-watering-can-in-british-green',
    description: "The professional's choice — a long reach watering can perfectly balanced for long sessions in the garden.",
  },
  {
    id: 'gh-garden-clogs', brand: 'Gardenheir', name: 'Italian Garden Clogs in Bluebird', price: 78,
    category: 'shoes', styles: ['boho', 'coastal'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Bluebird_1.jpg?v=1778681635',
    url: 'https://gardenheir.com/products/italian-garden-clogs-in-bluebird',
    description: 'Lightweight Italian clogs in a cheerful bluebird hue — as at home in the garden as they are running errands.',
  },
  {
    id: 'gh-work-jacket', brand: 'Le Laboureur x Gardenheir', name: 'Stonewashed Work Jacket in Light Denim', price: 188,
    category: 'clothing', styles: ['industrial', 'vintage'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/StonewashedWorkJacket_LightDenim_039.jpg?v=1780425686',
    url: 'https://gardenheir.com/products/le-laboureur-x-gardenheir-stonewashed-work-jacket-in-light-denim',
    description: "Bringing two classics together — the denim jacket and the chore coat — made in stonewashed denim from one of France's oldest mills.",
  },
  {
    id: 'gh-straw-hat', brand: 'Gardenheir', name: 'Handwoven Toquilla Straw Hat in Camouflage', price: 178,
    category: 'accessories', styles: ['coastal', 'boho'], ratio: 1.0,
    image: 'https://cdn.shopify.com/s/files/1/0720/5824/1345/files/Toquilla-Camouflage-Hat-4.jpg?v=1723348686',
    url: 'https://gardenheir.com/products/handwoven-toquilla-straw-hat-in-camouflage',
    description: 'Lightweight and flexible, individually dyed in camouflage multi-tones that bridge the warm and cool seasons.',
  },

  // Chamula — handmade Mexican leatherwork and Merino knits
  {
    id: 'chamula-smile-moc', brand: 'Chamula', name: 'Smile Moc', price: 198,
    category: 'shoes', styles: ['boho', 'vintage'], ratio: 1.5,
    image: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/8536251M-MO-Smile-Moc-Moca.jpg?v=1773430108',
    url: 'https://www.chamulaoriginal.com/products/m-smile-moc',
    description: 'Handmade moccasins crafted one by one by Huron artisans, made exclusively from high-quality Canadian leather.',
  },
  {
    id: 'chamula-brasilia', brand: 'Chamula', name: 'Brasilia', price: 209,
    category: 'shoes', styles: ['vintage'], ratio: 1.5,
    image: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/6110-Brasilia-Brown-2.jpg?v=1773249214',
    url: 'https://www.chamulaoriginal.com/products/m-brasilia',
    description: 'A timeless slip-on sandal handcrafted in Mexico, woven using traditional huarache techniques passed down through generations.',
  },
  {
    id: 'chamula-cuff-cap', brand: 'Chamula', name: 'Double Cuff Cap Windmill - Black', price: 141,
    category: 'accessories', styles: ['boho'], ratio: 1.5,
    image: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/DOUBLE-CUFF-CAP-WINDMILL-BLACK.jpg?v=1770410944',
    url: 'https://www.chamulaoriginal.com/products/double-cuff-cap-windmill-black',
    description: 'Hand-knit from Merino wool raised on purebred sheep grazing the Mexican mountains — warm, soft, and built to last.',
  },
  {
    id: 'chamula-cardigan', brand: 'Chamula', name: 'Souvenir Paisaje Zipper Cardigan - Ivory', price: 847,
    category: 'clothing', styles: ['boho', 'maximalist'], ratio: 1.5,
    image: 'https://cdn.shopify.com/s/files/1/0628/0098/6298/files/SOUVENIR-PAISAJE-ZIPPER-CARDIGAN-IVORY.jpg?v=1770343464',
    url: 'https://www.chamulaoriginal.com/products/souvenir-paisaje-zipper-cardigan-ivory',
    description: 'Hand-knit Merino wool cardigan with an intricate landscape jacquard — a statement piece native artisans knit one at a time.',
  },

  // Orée New York — Cyber-Americana streetwear
  {
    id: 'oree-smoking-tee', brand: 'Orée New York', name: 'Smoking Tee', price: 85,
    category: 'clothing', styles: ['streetwear', 'minimalist'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_384a0bfdcffa4ad38fc295287a8361c3~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/smoking-tee',
    description: 'A 6.5oz loop-wheeled cotton jersey tee, produced in Japan with traditional circular knitting for a soft, structured feel that improves with wear.',
  },
  {
    id: 'oree-crossborder-trainer', brand: 'Orée New York', name: 'Crossborder Trainer 0-70 Sneaker (Antique Brown)', price: 250,
    category: 'shoes', styles: ['streetwear'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_de9ace6fc89c4631ba1b6160f71106c3~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/crossborder-trainer-0-70-sneaker-antique-brown',
    description: 'A trainer that responds to movement, creating subtle shifts in color and texture as it wears in.',
  },
  {
    id: 'oree-astrud-lace-up', brand: 'Orée New York', name: 'Astrud Leather Lace Up', price: 270,
    category: 'shoes', styles: ['streetwear', 'vintage'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_0a14edf38a704dfa8144da673afe1f33~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/astrud-leather-lace-up',
    description: 'A leather lace-up built on Orée’s Cyber-Americana sensibility — rugged construction with a refined silhouette.',
  },
  {
    id: 'oree-military-jacket', brand: 'Orée New York', name: 'O-65 Military Field Jacket (Black)', price: 197,
    category: 'clothing', styles: ['streetwear', 'industrial'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_983a77b79f174a26aa891ebaef0a4269~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/o-65-military-jacket-black',
    description: 'A field jacket silhouette reworked with utilitarian pockets and a clean, blacked-out finish.',
  },
  {
    id: 'oree-tracer-belt', brand: 'Orée New York', name: 'Vachetta Tracer Belt', price: 160,
    category: 'accessories', styles: ['streetwear'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_a1465e7c74884166a41d8f064c4efd01~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/vachetta-tracer-belt',
    description: 'Vachetta leather that develops a rich patina over time — a quiet, everyday staple.',
  },
  {
    id: 'oree-monk-skullcap', brand: 'Orée New York', name: 'Monk Skullcap', price: 45,
    category: 'accessories', styles: ['streetwear', 'minimalist'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_f1cca41a5633428dbdfc2e12be396ca4~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/monk-skullcap',
    description: 'A close-fit skullcap with a pared-back, monastic simplicity.',
  },
  {
    id: 'oree-soft-landing-tray', brand: 'Orée New York', name: 'Soft Landing Tray', price: 25,
    category: 'home', styles: ['minimalist'], ratio: 1.0,
    image: 'https://static.wixstatic.com/media/5d3369_c8c8be9b0f704c3ab0b846189f59fe41~mv2.jpg/v1/fit/w_500,h_500,q_90/file.jpg',
    url: 'https://www.oreenyc.com/product-page/soft-landing-tray',
    description: 'A catch-all tray for keys, change, and the rest of a daily-carry — minimal and unfussy.',
  },

  // Nécessaire — minimalist personal care
  {
    id: 'necessaire-eucalyptus-water', brand: 'Nécessaire', name: 'Eucalyptus Water', price: 35,
    category: 'beauty', styles: ['minimalist'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_THEEUCALYPTUSWATER.jpg?v=1779917039',
    url: 'https://www.necessaire.com/products/eucalyptus-water',
    description: 'An immediate skin refresh in an ultra-fine mist that helps depleted skin feel restored, cooled, and revived.',
  },
  {
    id: 'necessaire-hand-duo', brand: 'Nécessaire', name: 'The Hand Wash + The Hand Lotion', price: 100,
    category: 'beauty', styles: ['minimalist'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_THEHANDDUO_SA.jpg?v=1778016466',
    url: 'https://www.necessaire.com/products/the-hand-wash-lotion-duo',
    description: 'The covetable hand duo — The Hand Wash cleanses, The Hand Lotion restores.',
  },
  {
    id: 'necessaire-body-exfoliator', brand: 'Nécessaire', name: 'The Body Exfoliator', price: 35,
    category: 'beauty', styles: ['minimalist'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_THEBODYEXFOLIATOR_SA_PDP.jpg?v=1770939118',
    url: 'https://www.necessaire.com/products/the-body-exfoliator-santal',
    description: 'A mild-to-moderate in-shower physical and chemical exfoliant for the body.',
  },
  {
    id: 'necessaire-deodorant', brand: 'Nécessaire', name: 'The Deodorant | Mandelic Acid', price: 24,
    category: 'beauty', styles: ['minimalist'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_THEDEODORANT_CC_1.jpg?v=1780332576',
    url: 'https://www.necessaire.com/products/the-deodorant-mandelic-acid-cypres-citronne',
    description: 'An extra-strength, aluminum-free deodorant in a soft-solid stick.',
  },
  {
    id: 'necessaire-rosemary-mask', brand: 'Nécessaire', name: 'Rosemary Leave-In Mask', price: 60,
    category: 'beauty', styles: ['minimalist', 'boho'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_ROSEMARYMASK.jpg?v=1765906488',
    url: 'https://www.necessaire.com/products/rosemary-leave-in-mask',
    description: 'An advanced leave-in hair treatment for use once or twice a week, formulated with rosemary extract.',
  },
  {
    id: 'necessaire-body-brush', brand: 'Nécessaire', name: 'The Body Brush', price: 25,
    category: 'beauty', styles: ['minimalist'], ratio: 1.17,
    image: 'https://cdn.shopify.com/s/files/1/0034/8812/0947/files/01_TheBodyBrush_PDP.jpg?v=1761340499',
    url: 'https://www.necessaire.com/products/the-body-brush',
    description: 'A daily body exfoliation brush, crafted from sustainably sourced, FSC-certified beechwood.',
  },
];

export function getProducts({ category = 'all', query = '', page = 1, perPage = 30 } = {}) {
  let list = category === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
    );
  }
  const start = (page - 1) * perPage;
  return { products: list.slice(start, start + perPage), hasMore: start + perPage < list.length };
}

export const EDITORIAL_STRIPS = [
  { title: 'Trending Now',  filter: (p: Product) => p.price > 150 },
  { title: 'Under $60',     filter: (p: Product) => p.price < 60 },
  { title: 'Minimal Picks', filter: (p: Product) => p.styles?.includes('minimalist') ?? false },
  { title: 'New Arrivals',  filter: (_: Product, i: number) => i % 3 === 0 },
];
