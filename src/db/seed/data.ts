import type { Localized } from '../schema/columns';
import type {
  bookingSource,
  conversationStatus,
  department,
  integrationProvider,
  memberRole,
  messageAuthor,
  messageChannel,
  outletType,
} from '../schema/enums';

type E<T extends { enumValues: readonly string[] }> = T['enumValues'][number];

export const ORG = {
  name: 'Vala Resort & Spa',
  slug: 'vala',
  legalName: 'Vala Resort shpk (DEMO)',
  nipt: 'L00000000D',
  country: 'AL',
  city: 'Dhërmi',
  address: 'Rruga e Plazhit, Dhërmi, Himarë',
  phone: '+355 69 000 0000',
  email: 'info@vala-demo.test',
  website: 'https://vala-demo.test',
  latitude: '40.1525',
  longitude: '19.6431',
  timezone: 'Europe/Tirane',
  defaultLocale: 'sq',
  brandColor: '#143A56',
  aiPersona: {
    name: 'Vala',
    tone: 'warm, elegant, concise; replies in the guest’s language',
    instructions: 'Breakfast 07:30–10:30. Check-in 14:00, check-out 11:00. Free parking. Wi-Fi VALA-GUEST / dhermi2026. Airport transfer from Tirana €90 per car.',
  },
  settings: { checkInTime: '14:00', checkOutTime: '11:00', breakfastIncluded: true },
};

export type DemoUserKey = 'owner' | 'manager' | 'receptionist' | 'housekeeping' | 'pos' | 'spa' | 'accountant' | 'admin';

export const USERS: { key: DemoUserKey; email: string; fullName: string; role: E<typeof memberRole> | null }[] = [
  { key: 'owner', email: 'owner@vala-demo.test', fullName: 'Dritan Shehu', role: 'owner' },
  { key: 'manager', email: 'manager@vala-demo.test', fullName: 'Elira Kola', role: 'manager' },
  { key: 'receptionist', email: 'reception@vala-demo.test', fullName: 'Klevis Duka', role: 'receptionist' },
  { key: 'housekeeping', email: 'housekeeping@vala-demo.test', fullName: 'Mimoza Leka', role: 'housekeeping' },
  { key: 'pos', email: 'bar@vala-demo.test', fullName: 'Ardit Marku', role: 'pos' },
  { key: 'spa', email: 'spa@vala-demo.test', fullName: 'Elona Basha', role: 'spa' },
  { key: 'accountant', email: 'finance@vala-demo.test', fullName: 'Rovena Prifti', role: 'accountant' },
  { key: 'admin', email: 'admin@iliria.test', fullName: 'Iliria Admin', role: null },
];

export const INTEGRATIONS: E<typeof integrationProvider>[] = [
  'channex', 'ical', 'meta_whatsapp', 'meta_instagram', 'meta_messenger', 'paysera', 'easypos', 'vapi', 'resend', 'ai',
];

export const OUT_OF_ORDER_ROOM = '108';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

export const ROOM_TYPES: {
  code: string; name: Localized; description: Localized; basePrice: number; baseOccupancy: number; maxOccupancy: number;
  sizeSqm: number; bedType: string; view: string; amenities: string[]; floor: number; building?: string; layoutStart: number; rooms: string[];
}[] = [
  {
    code: 'STD', name: { sq: 'Dhomë Standarde Dyshe', en: 'Standard Double' },
    description: { sq: 'Dhomë e qetë me pamje nga kopshti i ullinjve.', en: 'A quiet room overlooking the olive garden.' },
    basePrice: 85, baseOccupancy: 2, maxOccupancy: 2, sizeSqm: 22, bedType: 'queen', view: 'garden',
    amenities: ['wifi', 'ac', 'minibar', 'safe'], floor: 1, layoutStart: 0, rooms: range(101, 110),
  },
  {
    code: 'DLX', name: { sq: 'Deluxe me pamje nga deti', en: 'Deluxe Sea View' },
    description: { sq: 'Ballkon privat mbi Jon, drita e perëndimit brenda dhomës.', en: 'Private balcony above the Ionian, sunset light inside.' },
    basePrice: 120, baseOccupancy: 2, maxOccupancy: 3, sizeSqm: 28, bedType: 'king', view: 'sea',
    amenities: ['wifi', 'ac', 'minibar', 'safe', 'balcony', 'espresso'], floor: 2, layoutStart: 0, rooms: range(201, 210),
  },
  {
    code: 'JS', name: { sq: 'Junior Suite', en: 'Junior Suite' },
    description: { sq: 'Sallon i veçantë, vaskë dhe tarracë me pamje nga gjiri.', en: 'Separate lounge, bathtub and a terrace facing the bay.' },
    basePrice: 180, baseOccupancy: 2, maxOccupancy: 3, sizeSqm: 42, bedType: 'king', view: 'sea',
    amenities: ['wifi', 'ac', 'minibar', 'safe', 'terrace', 'bathtub', 'espresso'], floor: 3, layoutStart: 0, rooms: range(301, 304),
  },
  {
    code: 'FAM', name: { sq: 'Dhomë Familjare', en: 'Family Room' },
    description: { sq: 'Dy dhoma të lidhura, ideale për familje me fëmijë.', en: 'Two connected rooms, ideal for families with children.' },
    basePrice: 150, baseOccupancy: 3, maxOccupancy: 4, sizeSqm: 38, bedType: 'king+twin', view: 'partial_sea',
    amenities: ['wifi', 'ac', 'minibar', 'safe', 'balcony'], floor: 3, layoutStart: 4, rooms: range(305, 308),
  },
  {
    code: 'VIL', name: { sq: 'Vilë me pishinë private', en: 'Villa with Private Pool' },
    description: { sq: 'Vilë private me pishinë, kuzhinë dhe kopsht mbi plazh.', en: 'Private villa with pool, kitchen and garden above the beach.' },
    basePrice: 320, baseOccupancy: 4, maxOccupancy: 6, sizeSqm: 110, bedType: '2x king', view: 'sea',
    amenities: ['wifi', 'ac', 'pool', 'kitchen', 'garden', 'bbq'], floor: 0, building: 'Vilat', layoutStart: 0, rooms: ['V1', 'V2', 'V3', 'V4'],
  },
];

export const NATIONALITY_WEIGHTS = { AL: 22, XK: 14, IT: 18, PL: 15, DE: 10, GB: 9, US: 5 } as const;

export const NAME_POOLS: Record<keyof typeof NATIONALITY_WEIGHTS, { first: string[]; last: string[]; lang: string; phone: string; digits: number }> = {
  AL: { first: ['Arben', 'Elira', 'Klodian', 'Anisa', 'Erion', 'Jonida', 'Ermal', 'Megi', 'Besnik', 'Sara'], last: ['Hoxha', 'Leka', 'Dervishi', 'Kola', 'Gjoka', 'Prifti', 'Çela', 'Bregu', 'Zeneli', 'Meta'], lang: 'sq', phone: '+35569', digits: 7 },
  XK: { first: ['Blerim', 'Valbona', 'Arianit', 'Drenusha', 'Fatlind', 'Lirie'], last: ['Krasniqi', 'Berisha', 'Gashi', 'Morina', 'Hoti', 'Rexhepi'], lang: 'sq', phone: '+38344', digits: 6 },
  IT: { first: ['Marco', 'Giulia', 'Luca', 'Chiara', 'Matteo', 'Francesca', 'Alessandro', 'Sofia'], last: ['Rossi', 'Bianchi', 'Romano', 'Ricci', 'Greco', 'Conti', 'Esposito', 'Marino'], lang: 'it', phone: '+39347', digits: 7 },
  PL: { first: ['Jakub', 'Zuzanna', 'Kacper', 'Maja', 'Piotr', 'Aleksandra'], last: ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Zieliński'], lang: 'pl', phone: '+48512', digits: 6 },
  DE: { first: ['Lukas', 'Anna', 'Jonas', 'Lea', 'Felix', 'Laura'], last: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker'], lang: 'de', phone: '+49151', digits: 8 },
  GB: { first: ['James', 'Emily', 'Oliver', 'Charlotte', 'Harry', 'Amelia'], last: ['Smith', 'Taylor', 'Brown', 'Wilson', 'Davies', 'Evans'], lang: 'en', phone: '+447', digits: 9 },
  US: { first: ['Michael', 'Jessica', 'David', 'Ashley', 'Daniel', 'Sarah'], last: ['Johnson', 'Williams', 'Miller', 'Davis', 'Garcia', 'Martinez'], lang: 'en', phone: '+1917', digits: 7 },
};

export const SOURCE_WEIGHTS = {
  booking_com: 38, website: 14, direct: 8, whatsapp: 9, airbnb: 5, expedia: 6, agoda: 3, instagram: 4, phone: 6, ai_voice: 2, walk_in: 3, messenger: 2,
} as const satisfies Partial<Record<E<typeof bookingSource>, number>>;

export const SOURCE_WEIGHTS_VILLA = {
  airbnb: 30, booking_com: 30, website: 15, whatsapp: 12, direct: 8, expedia: 5,
} as const satisfies Partial<Record<E<typeof bookingSource>, number>>;

export const COMMISSION: Partial<Record<E<typeof bookingSource>, number>> = {
  booking_com: 0.15, expedia: 0.18, agoda: 0.15, airbnb: 0.03,
};

export const PREPAID_SOURCES: E<typeof bookingSource>[] = ['airbnb', 'expedia'];
export const DEPOSIT_SOURCES: E<typeof bookingSource>[] = ['direct', 'website', 'whatsapp', 'instagram', 'messenger', 'phone', 'ai_voice'];

export const PAYMENT_WEIGHTS = { cash: 45, card: 45, bank_transfer: 10 } as const;
export const EXTRA_WEIGHTS = { restaurant: 4, bar: 4, pool_bar: 2, spa: 1, minibar: 1 } as const;

export const MINIBAR: { sq: string; price: number }[] = [
  { sq: 'Minibar: ujë', price: 2 },
  { sq: 'Minibar: birrë', price: 4 },
  { sq: 'Minibar: çokollatë', price: 3 },
  { sq: 'Minibar: verë (shishe e vogël)', price: 9 },
];

type Product = { name: Localized; price: number; stock?: number; threshold?: number };
type OutletKey = 'restaurant' | 'bar' | 'pool_bar' | 'room_service' | 'spa';

export const OUTLETS: {
  key: OutletKey; type: E<typeof outletType>; name: Localized; openingHours: string;
  tablePrefix: string; tables: number; dailyOrders: [number, number] | null; hours: [number, number];
  categories: { name: Localized; products: Product[] }[];
}[] = [
  {
    key: 'restaurant', type: 'restaurant', name: { sq: 'Kuzhina e Valës', en: 'Kuzhina e Valës' }, openingHours: '07:30–23:00',
    tablePrefix: 'T', tables: 12, dailyOrders: [10, 18], hours: [12, 22],
    categories: [
      { name: { sq: 'Antipasta', en: 'Starters' }, products: [
        { name: { sq: 'Sallatë greke', en: 'Greek salad' }, price: 8 },
        { name: { sq: 'Byrek me spinaq', en: 'Spinach byrek' }, price: 6 },
        { name: { sq: 'Djathë i bardhë me ullinj', en: 'White cheese & olives' }, price: 7 },
        { name: { sq: 'Qofte të fërguara', en: 'Albanian meatballs' }, price: 9 },
      ] },
      { name: { sq: 'Pjata kryesore', en: 'Mains' }, products: [
        { name: { sq: 'Fërgesë', en: 'Fërgesë' }, price: 10 },
        { name: { sq: 'Levrek në skarë', en: 'Grilled sea bass' }, price: 22 },
        { name: { sq: 'Midhje me verë të bardhë', en: 'Mussels in white wine' }, price: 14 },
        { name: { sq: 'Tavë kosi', en: 'Baked lamb with yoghurt' }, price: 16 },
        { name: { sq: 'Oktapod në skarë', en: 'Grilled octopus' }, price: 24 },
      ] },
      { name: { sq: 'Ëmbëlsira', en: 'Desserts' }, products: [
        { name: { sq: 'Bakllava', en: 'Baklava' }, price: 5 },
        { name: { sq: 'Trileçe', en: 'Trileçe' }, price: 5 },
      ] },
    ],
  },
  {
    key: 'bar', type: 'bar', name: { sq: 'Bar Laguna', en: 'Laguna Bar' }, openingHours: '08:00–01:00',
    tablePrefix: 'B', tables: 8, dailyOrders: [15, 28], hours: [9, 23],
    categories: [
      { name: { sq: 'Kafe', en: 'Coffee' }, products: [
        { name: { sq: 'Espresso', en: 'Espresso' }, price: 1.5 },
        { name: { sq: 'Kapuçino', en: 'Cappuccino' }, price: 2.5 },
        { name: { sq: 'Freddo espresso', en: 'Freddo espresso' }, price: 3 },
      ] },
      { name: { sq: 'Kokteje', en: 'Cocktails' }, products: [
        { name: { sq: 'Aperol Spritz', en: 'Aperol Spritz' }, price: 8, stock: 6, threshold: 10 },
        { name: { sq: 'Negroni', en: 'Negroni' }, price: 9, stock: 24, threshold: 8 },
        { name: { sq: 'Mojito', en: 'Mojito' }, price: 8 },
      ] },
      { name: { sq: 'Verë, birrë & raki', en: 'Wine, beer & raki' }, products: [
        { name: { sq: 'Raki rrushi', en: 'Grape raki' }, price: 3 },
        { name: { sq: 'Verë e kuqe Kallmet (gotë)', en: 'Kallmet red wine (glass)' }, price: 6 },
        { name: { sq: 'Birrë vendase', en: 'Local beer' }, price: 3.5, stock: 96, threshold: 24 },
      ] },
      { name: { sq: 'Pije freskuese', en: 'Soft drinks' }, products: [
        { name: { sq: 'Ujë mineral', en: 'Mineral water' }, price: 1.5 },
        { name: { sq: 'Lëng portokalli i freskët', en: 'Fresh orange juice' }, price: 4 },
      ] },
    ],
  },
  {
    key: 'pool_bar', type: 'pool_bar', name: { sq: 'Pool Bar', en: 'Pool Bar' }, openingHours: '10:00–19:00',
    tablePrefix: 'P', tables: 8, dailyOrders: [6, 14], hours: [10, 18],
    categories: [
      { name: { sq: 'Pije & snack', en: 'Drinks & snacks' }, products: [
        { name: { sq: 'Smoothie frutash', en: 'Fruit smoothie' }, price: 6 },
        { name: { sq: 'Club sandwich', en: 'Club sandwich' }, price: 9 },
        { name: { sq: 'Patate të skuqura', en: 'Fries' }, price: 4 },
        { name: { sq: 'Birrë e ftohtë', en: 'Cold beer' }, price: 3.5 },
        { name: { sq: 'Ujë', en: 'Water' }, price: 1.5 },
      ] },
    ],
  },
  {
    key: 'room_service', type: 'room_service', name: { sq: 'Shërbim në dhomë', en: 'Room Service' }, openingHours: '07:00–23:00',
    tablePrefix: 'R', tables: 0, dailyOrders: null, hours: [7, 23], categories: [],
  },
  {
    key: 'spa', type: 'spa', name: { sq: 'Vala Spa', en: 'Vala Spa' }, openingHours: '10:00–20:00',
    tablePrefix: 'S', tables: 0, dailyOrders: null, hours: [10, 20], categories: [],
  },
];

export const SPA_SERVICES: { name: Localized; durationMin: number; price: number }[] = [
  { name: { sq: 'Masazh relaksues', en: 'Relaxing massage' }, durationMin: 60, price: 60 },
  { name: { sq: 'Masazh me gurë të nxehtë', en: 'Hot stone massage' }, durationMin: 75, price: 85 },
  { name: { sq: 'Trajtim fytyre', en: 'Facial treatment' }, durationMin: 50, price: 55 },
  { name: { sq: 'Ritual për çifte', en: 'Couples ritual' }, durationMin: 90, price: 150 },
  { name: { sq: 'Hamam & scrub', en: 'Hammam & scrub' }, durationMin: 45, price: 45 },
];

export const THERAPISTS = [
  { name: 'Elona', specialties: 'Masazh, gurë të nxehtë' },
  { name: 'Mirela', specialties: 'Trajtime fytyre, hamam' },
  { name: 'Andi', specialties: 'Masazh sportiv, çifte' },
];

export const WALKIN_NAMES = ['Klientë e jashtme', 'Vizitor ditor', 'Klient i jashtëm'];

export const EXPENSES: {
  supplier: string; nipt: string; category: string; department: E<typeof department>; min: number; max: number; weight: number;
}[] = [
  { supplier: 'Agro Himara shpk', nipt: 'L61234567A', category: 'Perime & fruta', department: 'restaurant', min: 8000, max: 35000, weight: 10 },
  { supplier: 'Peshku i Freskët Palasë', nipt: 'L71234567B', category: 'Peshk & fruta deti', department: 'restaurant', min: 15000, max: 60000, weight: 8 },
  { supplier: 'Kantina Vlora', nipt: 'K81234567C', category: 'Pije alkoolike', department: 'bar', min: 10000, max: 45000, weight: 6 },
  { supplier: 'Pastrimi Jon shpk', nipt: 'L91234567D', category: 'Pastrim & higjienë', department: 'rooms', min: 5000, max: 20000, weight: 6 },
  { supplier: 'Tekstil Durrësi', nipt: 'M01234567E', category: 'Lino & peshqirë', department: 'rooms', min: 20000, max: 90000, weight: 2 },
  { supplier: 'Tech Service Vlorë', nipt: 'L11234567F', category: 'Mirëmbajtje', department: 'maintenance', min: 6000, max: 40000, weight: 4 },
  { supplier: 'Energji Jugu (demo)', nipt: 'K21234567G', category: 'Energji elektrike', department: 'admin', min: 80000, max: 180000, weight: 1 },
  { supplier: 'Reklama Online', nipt: 'L31234567H', category: 'Marketing', department: 'marketing', min: 10000, max: 30000, weight: 2 },
  { supplier: 'Spa Supplies Tirana', nipt: 'L41234567J', category: 'Produkte spa', department: 'spa', min: 8000, max: 30000, weight: 2 },
];

type Msg = { author: E<typeof messageAuthor>; body: string; minutesAgo: number; attachment?: string };

export const CONVERSATIONS: {
  channel: E<typeof messageChannel>; contactName: string; contactHandle: string; language: string;
  status: E<typeof conversationStatus>; unread: number; messages: Msg[];
}[] = [
  {
    channel: 'whatsapp', contactName: 'Giulia Romano', contactHandle: '+393471234567', language: 'it', status: 'ai_handling', unread: 0,
    messages: [
      { author: 'guest', body: 'Buongiorno! Avete una camera vista mare dal 10 al 13 ottobre per due persone?', minutesAgo: 42 },
      { author: 'ai', body: 'Buongiorno Giulia! Sì, per il 10–13 ottobre abbiamo ancora 2 camere Deluxe Vista Mare al 2° piano, da €120 a notte con colazione inclusa. Vuole che ne blocchi una per lei?', minutesAgo: 41 },
      { author: 'guest', body: 'Perfetto, sì per favore!', minutesAgo: 30 },
      { author: 'ai', body: 'Fatto! La prenotazione è confermata. Le ho inviato i dettagli e il link per il check-in online. A presto a Dhërmi!', minutesAgo: 29 },
    ],
  },
  {
    channel: 'instagram', contactName: 'Anisa Gjoka', contactHandle: '@anisa.gjoka', language: 'sq', status: 'needs_human', unread: 2,
    messages: [
      { author: 'guest', body: 'Përshëndetje! Po organizojmë një dasmë për rreth 80 të ftuar në qershor 2027. A e bëni këtë?', minutesAgo: 18 },
      { author: 'ai', body: 'Përshëndetje Anisa, urime paraprakisht! Po, organizojmë evente në tarracën me pamje nga deti. Për një ofertë të plotë për 80 persona po ju lidh me menaxheren tonë, që do t’ju shkruajë sot.', minutesAgo: 17 },
      { author: 'system', body: 'AI e kaloi bisedën te stafi: kërkesë për event (80 persona).', minutesAgo: 17 },
      { author: 'guest', body: 'Faleminderit! Mund të më dërgoni edhe foto të tarracës?', minutesAgo: 5 },
    ],
  },
  {
    channel: 'web_chat', contactName: 'Vizitor', contactHandle: 'web-7F2A', language: 'en', status: 'resolved', unread: 0,
    messages: [
      { author: 'guest', body: 'Hi, is breakfast included and do you have parking?', minutesAgo: 190 },
      { author: 'ai', body: 'Hi! Yes, breakfast is included in every room rate (07:30–10:30 at Kuzhina e Valës), and parking is free for all guests. Shall I check dates for you?', minutesAgo: 190 },
      { author: 'guest', body: 'Great, thanks!', minutesAgo: 188 },
    ],
  },
  {
    channel: 'whatsapp', contactName: 'Lukas Müller', contactHandle: '+4915112345678', language: 'en', status: 'resolved', unread: 0,
    messages: [
      { author: 'guest', body: 'Hi, what’s the wifi password?', minutesAgo: 300 },
      { author: 'ai', body: 'Hi Lukas! Network: VALA-GUEST, password: dhermi2026. Enjoy your stay!', minutesAgo: 300 },
    ],
  },
  {
    channel: 'messenger', contactName: 'Piotr Nowak', contactHandle: 'fb-piotr.nowak', language: 'en', status: 'human_handling', unread: 1,
    messages: [
      { author: 'guest', body: 'Hello, could we have a late checkout tomorrow? Our flight is in the evening.', minutesAgo: 60 },
      { author: 'ai', body: 'Of course, Piotr. Late checkout until 14:00 is €30, or until 18:00 for €60. Would you like one of these?', minutesAgo: 59 },
      { author: 'guest', body: '18:00 please. Can we also leave our bags after?', minutesAgo: 50 },
      { author: 'staff', body: 'Hi Piotr, Klevis from reception here. Done: late checkout until 18:00 is booked, and you can leave your bags with us anytime.', minutesAgo: 12 },
      { author: 'guest', body: 'Perfect, thank you!', minutesAgo: 3 },
    ],
  },
  {
    channel: 'whatsapp', contactName: 'Anna Schmidt', contactHandle: '+4915187654321', language: 'en', status: 'ai_handling', unread: 0,
    messages: [
      { author: 'ai', body: 'Hello Anna, we look forward to welcoming you today! To skip the queue at reception, just send a photo of your passport here.', minutesAgo: 130 },
      { author: 'guest', body: 'Here you go', minutesAgo: 95, attachment: '/demo/passport-sample.jpg' },
      { author: 'ai', body: 'Thank you! Your details are saved and your check-in is ready. Your room will be ready from 14:00. Would you like us to book a table for dinner tonight?', minutesAgo: 94 },
      { author: 'guest', body: 'Yes, 20:00 for two please', minutesAgo: 90 },
      { author: 'ai', body: 'Booked: table for 2 at 20:00 at Kuzhina e Valës.', minutesAgo: 89 },
    ],
  },
  {
    channel: 'booking_com', contactName: 'James Taylor', contactHandle: 'bdc-4412987301', language: 'en', status: 'resolved', unread: 0,
    messages: [
      { author: 'guest', body: 'Do you offer a transfer from Tirana airport?', minutesAgo: 1500 },
      { author: 'ai', body: 'Yes! A private transfer from Tirana airport to Vala Resort costs €90 per car (up to 3 people, about 3.5 hours). Shall I arrange it for your arrival?', minutesAgo: 1499 },
      { author: 'guest', body: 'Yes please, we land at 13:40.', minutesAgo: 1480 },
      { author: 'ai', body: 'All set. Your driver will wait at arrivals with a Vala Resort sign.', minutesAgo: 1479 },
    ],
  },
  {
    channel: 'whatsapp', contactName: 'Ermal Leka', contactHandle: '+355691234567', language: 'sq', status: 'ai_handling', unread: 0,
    messages: [
      { author: 'guest', body: 'Mirëmbrëma, keni vend për darkë sonte për 4 veta në 20:30?', minutesAgo: 25 },
      { author: 'ai', body: 'Mirëmbrëma Ermal! Po, ju kam rezervuar një tavolinë për 4 persona sonte në 20:30 në Kuzhina e Valës, pranë tarracës. Ju presim!', minutesAgo: 24 },
      { author: 'guest', body: 'Faleminderit shumë!', minutesAgo: 20 },
    ],
  },
];

export const CALLS: {
  from: string; language: string; durationSec: number; outcome: string; summary: string; minutesAgo: number; transferredTo?: string;
  transcript: { role: 'ai' | 'caller'; text: string }[];
}[] = [
  {
    from: '+355692223344', language: 'sq', durationSec: 184, outcome: 'booking_created', minutesAgo: 75,
    summary: 'Rezervim i ri: 2 netë në Deluxe me pamje nga deti për z. Besnik Marku.',
    transcript: [
      { role: 'ai', text: 'Vala Resort & Spa, mirëdita! Si mund t’ju ndihmoj?' },
      { role: 'caller', text: 'Dua një dhomë me pamje nga deti për dy netë, fundjavën e ardhshme.' },
      { role: 'ai', text: 'Kemi të lirë një Deluxe me pamje nga deti. Ta rezervoj në emrin tuaj?' },
      { role: 'caller', text: 'Po, Besnik Marku.' },
    ],
  },
  {
    from: '+447700900123', language: 'en', durationSec: 96, outcome: 'question_answered', minutesAgo: 240,
    summary: 'Caller asked about spa hours and prices. AI shared the menu and offered to send it on WhatsApp.',
    transcript: [
      { role: 'caller', text: 'Hi, what time is the spa open?' },
      { role: 'ai', text: 'Vala Spa is open 10:00 to 20:00. A relaxing massage is €60 for 60 minutes. Shall I send you the full menu on WhatsApp?' },
    ],
  },
  {
    from: '+393331234567', language: 'it', durationSec: 142, outcome: 'transferred', minutesAgo: 1440, transferredTo: 'Recepsioni',
    summary: 'Kërkesë për grup (12 dhoma, maj 2027). U kalua te recepsioni.',
    transcript: [
      { role: 'caller', text: 'Buongiorno, vorrei un preventivo per un gruppo di 12 camere a maggio.' },
      { role: 'ai', text: 'Certo! Per i gruppi la metto subito in contatto con la reception.' },
    ],
  },
  {
    from: '+355682345678', language: 'sq', durationSec: 61, outcome: 'question_answered', minutesAgo: 2000,
    summary: 'Pyetje për orën e check-in dhe parkimin.',
    transcript: [
      { role: 'caller', text: 'Nga çfarë ore bëhet check-in?' },
      { role: 'ai', text: 'Check-in bëhet nga ora 14:00, ndërsa parkimi është falas për mysafirët.' },
    ],
  },
];

export const TEMPLATES: { key: string; name: string; trigger: string; body: Localized }[] = [
  { key: 'pre_arrival', name: 'Para mbërritjes', trigger: 'before_arrival_1d', body: { sq: 'Përshëndetje {{name}}, ju presim më {{check_in}} në Vala Resort & Spa! Check-in nga ora 14:00. Na shkruani këtu nëse keni nevojë për transfertë.', en: 'Hello {{name}}, we look forward to welcoming you on {{check_in}} at Vala Resort & Spa! Check-in from 14:00. Message us here if you need a transfer.' } },
  { key: 'passport_checkin', name: 'Check-in me pasaportë', trigger: 'arrival_day', body: { sq: 'Për check-in pa pritje, na dërgoni këtu një foto të pasaportës ose ID-së.', en: 'To skip the queue, just send a photo of your passport or ID here.' } },
  { key: 'welcome', name: 'Mirëseardhje', trigger: 'after_checkin', body: { sq: 'Mirë se erdhët, {{name}}! Wi-Fi: VALA-GUEST / dhermi2026. Mëngjesi 07:30–10:30.', en: 'Welcome, {{name}}! Wi-Fi: VALA-GUEST / dhermi2026. Breakfast 07:30–10:30.' } },
  { key: 'review_request', name: 'Kërkesë për vlerësim', trigger: 'after_checkout', body: { sq: 'Faleminderit që qëndruat me ne, {{name}}! Një vlerësim do të na ndihmonte shumë: {{review_link}}', en: 'Thank you for staying with us, {{name}}! A review would mean a lot: {{review_link}}' } },
  { key: 'return_offer', name: 'Ofertë rikthimi', trigger: 'after_checkout_30d', body: { sq: '{{name}}, për vizitën tuaj të ardhshme keni 10% zbritje me kodin RIKTHEHU10.', en: '{{name}}, enjoy 10% off your next stay with code RIKTHEHU10.' } },
];
