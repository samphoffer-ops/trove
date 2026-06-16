// Static data for the Shopping Discovery POC

// LoremFlickr returns real photos matched to keyword tags, with a stable
// "lock" seed so the same item always gets the same image.
function img(tags, w, h, lock) {
  return `https://loremflickr.com/${w}/${h}/${tags}?lock=${lock}`;
}

const ONBOARDING_STEPS = [
  {
    key: 'brands',
    title: 'Brands you gravitate toward',
    subtitle: 'Tap the ones that feel like you. Pick as many as you like.',
    options: [
      { id: 'aldo-lane', label: 'Aldo Lane', img: img('wool,coat,fashion', 300, 300, 101) },
      { id: 'north-co', label: 'North & Co', img: img('denim,jacket,fashion', 300, 300, 102) },
      { id: 'mira-studio', label: 'Mira Studio', img: img('jewelry,earrings', 300, 300, 103) },
      { id: 'velora', label: 'Velora', img: img('leather,shoes,fashion', 300, 300, 104) },
      { id: 'heath-bram', label: 'Heath & Bram', img: img('ceramic,homedecor', 300, 300, 105) },
      { id: 'lumen', label: 'Lumen', img: img('headphones,tech,minimal', 300, 300, 106) },
      { id: 'pace-goods', label: 'Pace Goods', img: img('streetwear,sneakers', 300, 300, 107) },
      { id: 'faro', label: 'Faro', img: img('sunglasses,strawhat,summer', 300, 300, 108) },
    ],
  },
  {
    key: 'styles',
    title: 'Aesthetics that speak to you',
    subtitle: 'Your taste, in a few taps.',
    options: [
      { id: 'minimalist', label: 'Minimalist', img: img('minimalist,interior,white', 300, 300, 201) },
      { id: 'maximalist', label: 'Maximalist', img: img('colorful,pattern,maximalist', 300, 300, 202) },
      { id: 'streetwear', label: 'Streetwear', img: img('streetwear,urban,fashion', 300, 300, 203) },
      { id: 'vintage', label: 'Vintage', img: img('vintage,fashion,retro', 300, 300, 204) },
      { id: 'coastal', label: 'Coastal', img: img('coastal,beach,linen', 300, 300, 205) },
      { id: 'cottagecore', label: 'Cottagecore', img: img('cottagecore,floral,countryside', 300, 300, 206) },
      { id: 'industrial', label: 'Industrial', img: img('industrial,loft,concrete', 300, 300, 207) },
      { id: 'boho', label: 'Boho', img: img('bohemian,textile,decor', 300, 300, 208) },
    ],
  },
  {
    key: 'categories',
    title: 'What are you shopping for?',
    subtitle: "Last step — we'll tailor your feed.",
    options: [
      { id: 'clothing', label: 'Clothing', img: img('clothing,rack,fashion', 300, 300, 301) },
      { id: 'shoes', label: 'Shoes', img: img('shoes,sneakers', 300, 300, 302) },
      { id: 'bags', label: 'Bags', img: img('handbag,tote,leather', 300, 300, 303) },
      { id: 'accessories', label: 'Accessories', img: img('accessories,scarf,belt', 300, 300, 304) },
      { id: 'home', label: 'Home', img: img('homedecor,interior', 300, 300, 305) },
      { id: 'beauty', label: 'Beauty', img: img('cosmetics,beauty,skincare', 300, 300, 306) },
      { id: 'tech', label: 'Tech', img: img('gadgets,tech,minimal', 300, 300, 307) },
      { id: 'jewelry', label: 'Jewelry', img: img('jewelry,gold,rings', 300, 300, 308) },
    ],
  },
];

const PRODUCTS = [
  { id: 'p1',  brand: 'Aldo Lane',   name: 'Wool Overcoat',        price: 248, category: 'clothing',    styles: ['minimalist', 'vintage'],    tags: 'wool,overcoat,fashion' },
  { id: 'p2',  brand: 'North & Co',  name: 'Canvas Tote',          price: 58,  category: 'bags',        styles: ['coastal', 'minimalist'],    tags: 'canvas,tote,bag' },
  { id: 'p3',  brand: 'Mira Studio', name: 'Statement Earrings',   price: 42,  category: 'jewelry',     styles: ['maximalist', 'boho'],       tags: 'earrings,jewelry' },
  { id: 'p4',  brand: 'Velora',      name: 'Leather Loafers',      price: 165, category: 'shoes',       styles: ['minimalist'],               tags: 'loafers,leather,shoes' },
  { id: 'p5',  brand: 'Heath & Bram',name: 'Ceramic Vase Set',     price: 76,  category: 'home',        styles: ['cottagecore'],              tags: 'ceramic,vase,homedecor' },
  { id: 'p6',  brand: 'Lumen',       name: 'Wireless Earbuds',     price: 129, category: 'tech',        styles: ['minimalist', 'industrial'], tags: 'earbuds,headphones,tech' },
  { id: 'p7',  brand: 'Pace Goods',  name: 'Cargo Trousers',       price: 98,  category: 'clothing',    styles: ['streetwear'],               tags: 'cargo,pants,streetwear' },
  { id: 'p8',  brand: 'Faro',        name: 'Woven Belt',           price: 34,  category: 'accessories', styles: ['boho', 'coastal'],          tags: 'belt,leather,accessory' },
  { id: 'p9',  brand: 'Aldo Lane',   name: 'Cashmere Scarf',       price: 89,  category: 'accessories', styles: ['minimalist'],               tags: 'scarf,cashmere,fashion' },
  { id: 'p10', brand: 'North & Co',  name: 'Denim Jacket',         price: 112, category: 'clothing',    styles: ['streetwear', 'vintage'],    tags: 'denim,jacket,fashion' },
  { id: 'p11', brand: 'Mira Studio', name: 'Beaded Necklace',      price: 56,  category: 'jewelry',     styles: ['boho'],                     tags: 'necklace,beads,jewelry' },
  { id: 'p12', brand: 'Velora',      name: 'Chunky Sneakers',      price: 145, category: 'shoes',       styles: ['streetwear'],               tags: 'sneakers,shoes,streetwear' },
  { id: 'p13', brand: 'Heath & Bram',name: 'Linen Throw Pillow',   price: 38,  category: 'home',        styles: ['cottagecore', 'coastal'],   tags: 'linen,pillow,homedecor' },
  { id: 'p14', brand: 'Lumen',       name: 'Desk Lamp',            price: 84,  category: 'home',        styles: ['industrial', 'minimalist'], tags: 'desklamp,lamp,minimal' },
  { id: 'p15', brand: 'Pace Goods',  name: 'Graphic Tee',          price: 36,  category: 'clothing',    styles: ['streetwear'],               tags: 'tshirt,graphic,streetwear' },
  { id: 'p16', brand: 'Faro',        name: 'Sunglasses',           price: 54,  category: 'accessories', styles: ['coastal', 'vintage'],       tags: 'sunglasses,summer,fashion' },
  { id: 'p17', brand: 'Aldo Lane',   name: 'Knit Sweater',         price: 118, category: 'clothing',    styles: ['minimalist', 'cottagecore'],tags: 'sweater,knit,fashion' },
  { id: 'p18', brand: 'North & Co',  name: 'Crossbody Bag',        price: 92,  category: 'bags',        styles: ['minimalist'],               tags: 'crossbody,bag,leather' },
  { id: 'p19', brand: 'Mira Studio', name: 'Gold Hoop Earrings',   price: 48,  category: 'jewelry',     styles: ['minimalist', 'maximalist'], tags: 'goldearrings,jewelry' },
  { id: 'p20', brand: 'Velora',      name: 'Suede Boots',          price: 178, category: 'shoes',       styles: ['vintage', 'boho'],          tags: 'suede,boots,shoes' },
  { id: 'p21', brand: 'Heath & Bram',name: 'Rattan Mirror',        price: 64,  category: 'home',        styles: ['boho', 'cottagecore'],      tags: 'rattan,mirror,homedecor' },
  { id: 'p22', brand: 'Lumen',       name: 'Bluetooth Speaker',    price: 79,  category: 'tech',        styles: ['industrial'],               tags: 'speaker,bluetooth,tech' },
  { id: 'p23', brand: 'Pace Goods',  name: 'Puffer Vest',          price: 134, category: 'clothing',    styles: ['streetwear', 'industrial'], tags: 'puffer,vest,streetwear' },
  { id: 'p24', brand: 'Faro',        name: 'Straw Hat',            price: 28,  category: 'accessories', styles: ['coastal', 'boho'],          tags: 'strawhat,summer,fashion' },
].map((p, i) => {
  const ratios = [1.25, 0.8, 1.4, 1.1, 0.95, 1.3, 1.15, 0.85, 1.35, 1.0, 1.2, 0.9, 1.45, 1.05, 0.8, 1.25, 1.1, 1.35, 0.95, 1.4, 1.15, 0.85, 1.3, 1.0];
  const ratio = ratios[i % ratios.length];
  const width = 400;
  const height = Math.round(width * ratio);
  return { ...p, ratio, image: img(p.tags, width, height, 1000 + i) };
});
