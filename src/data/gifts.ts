export interface GiftCategory {
  id: string
  name: string
  description: string
  subcategories: string[]
}

export interface GiftProduct {
  id: string
  name: string
  category: string
  subcategory: string
  price: number
  description: string
  image: string
  badge?: string
}

export interface GiftStore {
  id: string
  name: string
  address: string
  hours: string
  phone: string
}

export const giftCategories: GiftCategory[] = [
  { id: 'flowers-hampers', name: 'Flowers & Hampers', description: 'Fresh blooms and thoughtfully curated gift baskets.', subcategories: ['Fresh Flowers', 'Gourmet Hampers', 'Fruit Baskets'] },
  { id: 'celebrations', name: 'Celebrations', description: 'Make birthdays and milestones feel extra special.', subcategories: ['Cakes & Sweets', 'Balloons', 'Party Gifts'] },
  { id: 'fashion-beauty', name: 'Fashion & Beauty', description: 'Personal treats selected for style and self-care.', subcategories: ['Fragrance', 'Jewellery', 'Beauty Sets'] },
  { id: 'tech-lifestyle', name: 'Tech & Lifestyle', description: 'Useful everyday technology and premium accessories.', subcategories: ['Audio', 'Watches', 'Home & Living'] },
  { id: 'kids-family', name: 'Kids & Family', description: 'Joyful surprises for children and growing families.', subcategories: ['Toys', 'Baby Gifts', 'Family Games'] },
]

export const giftProducts: GiftProduct[] = [
  {
    id: 'GFT-FLR-001', name: 'Island Bloom Bouquet', category: 'Flowers & Hampers', subcategory: 'Fresh Flowers', price: 89,
    description: 'A bright seasonal bouquet arranged with tropical foliage and a keepsake ribbon.', badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-HMP-002', name: 'Pacific Gourmet Hamper', category: 'Flowers & Hampers', subcategory: 'Gourmet Hampers', price: 145,
    description: 'Premium chocolates, savoury treats, tea and locally inspired delicacies in a reusable basket.', badge: 'Premium',
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-CKE-003', name: 'Celebration Chocolate Cake', category: 'Celebrations', subcategory: 'Cakes & Sweets', price: 68,
    description: 'A rich chocolate celebration cake finished with ganache and a personalised greeting.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-PTY-004', name: 'Birthday Cheer Box', category: 'Celebrations', subcategory: 'Party Gifts', price: 54,
    description: 'A cheerful birthday box with sweets, party accessories and a reusable celebration tumbler.', badge: 'New',
    image: 'https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-FRG-005', name: 'Signature Fragrance Set', category: 'Fashion & Beauty', subcategory: 'Fragrance', price: 129,
    description: 'A refined fragrance and travel spray presented in a satin-lined gift box.',
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-JWL-006', name: 'Silver Heart Pendant', category: 'Fashion & Beauty', subcategory: 'Jewellery', price: 110,
    description: 'A delicate silver-toned heart pendant with an adjustable chain and presentation case.',
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-AUD-007', name: 'Wireless Sound Headphones', category: 'Tech & Lifestyle', subcategory: 'Audio', price: 179,
    description: 'Comfortable wireless headphones with rich sound, built-in controls and a travel pouch.', badge: 'Popular',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-WCH-008', name: 'Classic Everyday Watch', category: 'Tech & Lifestyle', subcategory: 'Watches', price: 195,
    description: 'A clean, versatile watch with a polished case, comfortable strap and gift-ready packaging.',
    image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-TOY-009', name: 'Cuddly Teddy Companion', category: 'Kids & Family', subcategory: 'Toys', price: 42,
    description: 'A soft, huggable teddy bear made for comforting cuddles and happy childhood memories.',
    image: 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=900&q=82',
  },
  {
    id: 'GFT-BBY-010', name: 'Little One Welcome Set', category: 'Kids & Family', subcategory: 'Baby Gifts', price: 96,
    description: 'A gentle baby-care collection with a blanket, comfort toy and practical nursery essentials.', badge: 'New arrival',
    image: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=82',
  },
]

export const giftStores: GiftStore[] = [
  { id: 'suva-central', name: 'Suva Central Store', address: 'Victoria Parade, Suva', hours: 'Mon–Sat, 9:00 AM–6:00 PM', phone: '+679 330 0001' },
  { id: 'nadi-town', name: 'Nadi Town Store', address: 'Main Street, Nadi', hours: 'Mon–Sat, 9:00 AM–6:00 PM', phone: '+679 670 0002' },
  { id: 'lautoka-city', name: 'Lautoka City Store', address: 'Vitogo Parade, Lautoka', hours: 'Mon–Sat, 9:00 AM–5:30 PM', phone: '+679 666 0003' },
  { id: 'labasa', name: 'Labasa Store', address: 'Nasekula Road, Labasa', hours: 'Mon–Sat, 9:00 AM–5:00 PM', phone: '+679 881 0004' },
]

export const giftPaymentMethods = [
  { id: 'wallet', label: 'MH Wallet', detail: 'Pay from your available wallet balance' },
  { id: 'mpaisa', label: 'M-PAiSA / M-Pesa', detail: 'Mobile-money payment' },
  { id: 'mycash', label: 'MyCash', detail: 'Pay from your MyCash account' },
  { id: 'card', label: 'Debit or Credit Card', detail: 'Visa or Mastercard' },
  { id: 'bank', label: 'Bank Transfer', detail: 'Pay using a bank reference' },
  { id: 'moneygram', label: 'MoneyGram Inbound', detail: 'Use an eligible inbound transfer' },
]
