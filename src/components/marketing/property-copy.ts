import type { PaidPlan, SizeKey } from '@/config/plans';

export const PROPERTY_TYPES = ['resort', 'heritage', 'city', 'mountain'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_PHOTOS: Record<PropertyType, { card: string; hero: string }> = {
  resort: { card: '/images/marketing/beach-club.jpg', hero: '/images/marketing/cove.jpg' },
  heritage: { card: '/images/platform/heritage-gjirokaster.jpg', hero: '/images/platform/heritage-gjirokaster.jpg' },
  city: { card: '/images/platform/city-tirana.jpg', hero: '/images/platform/city-tirana.jpg' },
  mountain: { card: '/images/platform/mountain-theth.jpg', hero: '/images/platform/mountain-theth.jpg' },
};

export type FeatureIcon = 'calendar' | 'channels' | 'inbox' | 'pos' | 'fiscal' | 'ask' | 'profile' | 'book' | 'voice' | 'alerts' | 'housekeeping' | 'reports' | 'expenses';

export type PropertyCopy = {
  name: string;
  place: string;
  cardText: string;
  eyebrow: string;
  title: [string, string];
  sub: string;
  stats: { value: string; label: string }[];
  painsTitle: string;
  pains: { pain: string; fix: string }[];
  featuresTitle: string;
  features: { icon: FeatureIcon; title: string; text: string }[];
  chat: { title: string; sub: string; guest: string; ai: string };
  fit: { title: string; rooms: string; size: SizeKey; plan: PaidPlan; why: string };
  seoTitle: string;
  seoDescription: string;
};

type Shared = {
  common: {
    back: string;
    painLabel: string;
    fixLabel: string;
    otherTypes: string;
    from: string;
    perMonth: string;
    setup: string;
    plan: string;
    seePricing: string;
    demo: string;
    talk: string;
    ctaTitle: string;
    ctaSub: string;
    welcome: string;
    foundingNote: string;
    sizes: Record<SizeKey, string>;
  };
  types: { eyebrow: string; title: string; sub: string; open: string };
};

export const SHARED: Record<'sq' | 'en', Shared> = {
  sq: {
    common: {
      back: 'Të gjitha llojet',
      painLabel: 'Sot',
      fixLabel: 'Me Iliria',
      otherTypes: 'Edhe llojet e tjera të hoteleve',
      from: 'Nga',
      perMonth: 'në muaj',
      setup: 'Konfigurimi një herë',
      plan: 'Plani i rekomanduar',
      seePricing: 'Shih të gjitha çmimet',
      demo: 'Provo demon live',
      talk: 'Flasim për hotelin tuaj',
      ctaTitle: 'Provoje sonte, me të dhënat e një hoteli si i yti.',
      ctaSub: 'Hyn me një klik në Vala Resort & Spa, një hotel fiktiv me rezervime, mesazhe dhe fatura të gatshme. Ose na lër numrin dhe ta ngremë hotelin tënd të vërtetë.',
      welcome: 'Mirë se vini',
      foundingNote: 'Çmim themelues, 30% më i ulët për hotelet e para.',
      sizes: { small: '1 deri 15 dhoma', medium: '16 deri 40 dhoma', large: '41 deri 100 dhoma' },
    },
    types: {
      eyebrow: 'Për çdo hotel',
      title: 'Nga bregdeti te bjeshkët.',
      sub: 'Një resort në Dhërmi nuk punon si një kullë guri në Gjirokastër. Iliria përshtatet me mënyrën si punon hoteli yt.',
      open: 'Shiko si punon',
    },
  },
  en: {
    common: {
      back: 'All property types',
      painLabel: 'Today',
      fixLabel: 'With Iliria',
      otherTypes: 'Other kinds of properties',
      from: 'From',
      perMonth: 'per month',
      setup: 'One-time setup',
      plan: 'Recommended plan',
      seePricing: 'See all pricing',
      demo: 'Try the live demo',
      talk: 'Talk about your hotel',
      ctaTitle: 'Try it tonight, with the data of a hotel like yours.',
      ctaSub: 'One click takes you into Vala Resort & Spa, a fictional hotel with bookings, messages and invoices ready. Or leave your number and we will set up your real one.',
      welcome: 'Welcome',
      foundingNote: 'Founding price, 30% lower for the first hotels.',
      sizes: { small: '1 to 15 rooms', medium: '16 to 40 rooms', large: '41 to 100 rooms' },
    },
    types: {
      eyebrow: 'For every hotel',
      title: 'From the coast to the mountains.',
      sub: 'A resort in Dhërmi does not run like a stone tower house in Gjirokastër. Iliria fits the way your property works.',
      open: 'See how it works',
    },
  },
};

export const PROPERTY: Record<'sq' | 'en', Record<PropertyType, PropertyCopy>> = {
  sq: {
    resort: {
      name: 'Resorte bregdetare',
      place: 'Dhërmi · Himarë · Ksamil · Sarandë',
      cardText: 'Sezon i shkurtër, shumë kanale, çdo natë duhet të shitet.',
      eyebrow: 'Për resortet bregdetare',
      title: ['Sezoni është i shkurtër.', 'Çdo natë duhet të shitet.'],
      sub: 'Nga korriku në gusht telefoni nuk pushon. Iliria u përgjigjet mysafirëve në gjuhën e tyre, mban një kalendar të vetëm për të gjitha kanalet dhe çdo mëngjes të tregon sa fitove dhe çfarë ka rëndësi sot.',
      stats: [
        { value: '4', label: 'kanale rezervimesh në një kalendar' },
        { value: '24/7', label: 'përgjigje nga AI në gjuhën e mysafirit' },
        { value: '1 klik', label: 'nga shitja në bar te fatura e fiskalizuar' },
      ],
      painsTitle: 'Çfarë e bën të vështirë sezonin',
      pains: [
        { pain: 'Dyfishime mes Booking, Airbnb dhe telefonit.', fix: 'Një kalendar i vetëm. Çdo rezervim e bllokon dhomën në të gjitha kanalet.' },
        { pain: 'Mesazhe në WhatsApp dhe Instagram që humbasin mes sezonit.', fix: 'Kuti e përbashkët për të gjitha. AI përgjigjet menjëherë dhe të kalon vetëm ato që duan njeri.' },
        { pain: 'Bari, restoranti dhe spa faturohen veçmas.', fix: 'Çdo shitje shkon te llogaria e dhomës dhe del në një faturë të vetme të fiskalizuar.' },
      ],
      featuresTitle: 'Ç’ke nevojë në një resort',
      features: [
        { icon: 'calendar', title: 'Kalendar që lëviz me gisht', text: 'Zhvendos një mysafir me një gjest, zgjat një qëndrim duke tërhequr skajin.' },
        { icon: 'channels', title: 'Kanalet në një vend', text: 'Booking, Airbnb, Expedia dhe Agoda sinkronizohen me kalendarin tënd.' },
        { icon: 'inbox', title: 'Kuti postare me AI', text: 'WhatsApp, Instagram dhe Messenger në një ekran, me përgjigje të gatshme.' },
        { icon: 'pos', title: 'Bar, restorant, spa', text: 'Porosit nga tavolina dhe faturo në dhomë ose direkt.' },
        { icon: 'fiscal', title: 'Faturë e fiskalizuar', text: 'NIVF, NSLF dhe kod QR, të gatshme për çdo shitje.' },
        { icon: 'ask', title: 'Pyet hotelin', text: '“Sa fitoi bari këtë javë?” Përgjigjja vjen me numra dhe grafik.' },
      ],
      chat: {
        title: 'Një mysafir shkruan në orën 9 të mëngjesit',
        sub: 'AI kontrollon disponueshmërinë, jep çmimin dhe të kërkon vetëm të konfirmosh.',
        guest: 'Do të vijmë me dy fëmijë. A keni dhomë familjare dhe transfertë nga aeroporti i Vlorës?',
        ai: 'Po. Suita familjare me pamje nga deti për 3 net është 690 €. Transferta nga aeroporti i Vlorës është 45 €. E rezervoj për ju?',
      },
      fit: { title: 'Sa kushton për një resort', rooms: '20 deri 80 dhoma', size: 'medium', plan: 'premium', why: 'Plani Signature përfshin sinkronizimin në kohë reale me kanalet, që është ajo që i duhet një resorti me shumë rezervime.' },
      seoTitle: 'Software për resorte bregdetare në Shqipëri | Iliria',
      seoDescription: 'Kalendar i vetëm për Booking, Airbnb dhe Expedia, AI që u përgjigjet mysafirëve në shqip e anglisht, dhe faturë e fiskalizuar. Për resorte në Riviera.',
    },
    heritage: {
      name: 'Hotele trashëgimie',
      place: 'Gjirokastër · Berat · Voskopojë',
      cardText: 'Pak dhoma, mysafirë nga larg, çdo detaj ka rëndësi.',
      eyebrow: 'Për hotelet e trashëgimisë',
      title: ['Pak dhoma.', 'Mysafirë që vijnë nga larg.'],
      sub: 'Në një kullë guri me tetë dhoma nuk ke recepsionist gjithë natën. Iliria merr rezervimet, u përgjigjet mysafirëve të huaj kur ti fle dhe të kujton çdo detaj: mëngjesin, transfertën, ditëlindjen.',
      stats: [
        { value: '24/7', label: 'përgjigje edhe kur je në gjumë' },
        { value: '360°', label: 'profil për çdo mysafir që kthehet' },
        { value: '0%', label: 'komision në rezervimet nga faqja jote' },
      ],
      painsTitle: 'Çfarë e lodh një hotel të vogël',
      pains: [
        { pain: 'Mysafirët e huaj shkruajnë në orë të çuditshme.', fix: 'AI përgjigjet menjëherë në gjuhën e tyre, në çdo orë, dhe konfirmon vetëm çfarë duhet.' },
        { pain: 'Ti je pronar, recepsionist dhe guidë në të njëjtën kohë.', fix: 'Në 06:30 merr një përmbledhje: kush vjen, çfarë duhet përgatitur, çfarë ka ndryshuar.' },
        { pain: 'Preferencat e mysafirit harrohen deri vitin tjetër.', fix: 'Profili ruan çfarë i pëlqen, ditëlindjet dhe qëndrimet e kaluara. Kur kthehet, e njeh.' },
      ],
      featuresTitle: 'Ç’ke nevojë në një hotel të vogël',
      features: [
        { icon: 'profile', title: 'Profili i mysafirit', text: 'Historia, preferencat dhe vlera e çdo mysafiri në një faqe, si një profil.' },
        { icon: 'ask', title: 'Pyet hotelin', text: 'Shkruaj çfarë do të dish ose çfarë do të bësh, dhe agjenti e kryen pasi ti konfirmon.' },
        { icon: 'inbox', title: 'Kuti postare me AI', text: 'Të gjitha mesazhet në një vend, me përgjigje në gjuhën e mysafirit.' },
        { icon: 'book', title: 'Faqe rezervimi direkte', text: 'Mysafiri rezervon nga faqja jote, pa komision për platformat.' },
        { icon: 'voice', title: 'Asistent zanor', text: 'Telefonatat marrin përgjigje edhe kur je te mysafirët.' },
        { icon: 'alerts', title: 'Njoftime që kanë kuptim', text: 'Të alarmon vetëm për ato që kërkojnë veprim, jo për çdo gjë.' },
      ],
      chat: {
        title: 'Një mysafir italian shkruan natën vonë',
        sub: 'AI përgjigjet në italisht, kontrollon datat dhe rezervon pa e zgjuar askënd.',
        guest: 'Buongiorno, avete una camera per due notti a ottobre? Arriviamo in auto da Tirana.',
        ai: 'Buongiorno! Sì, per il 12 e 13 ottobre abbiamo la camera Kulla con vista sul castello a 95 €. Il parcheggio è a due minuti a piedi. La prenoto?',
      },
      fit: { title: 'Sa kushton për një hotel të vogël', rooms: '5 deri 15 dhoma', size: 'small', plan: 'pro', why: 'Plani Professional ka kutinë postare me AI, faturën e fiskalizuar dhe bar-restorantin, pa paguar për gjëra që nuk të duhen.' },
      seoTitle: 'Software për hotele trashëgimie dhe kulla guri | Iliria',
      seoDescription: 'Rezervime direkte, AI që flet gjuhën e mysafirit dhe profil 360° për çdo mysafir. Për hotele të vogla në Gjirokastër, Berat dhe Voskopojë.',
    },
    city: {
      name: 'Hotele qyteti',
      place: 'Tiranë · Durrës · Shkodër',
      cardText: 'Biznes, turizëm dhe ngjarje, me një ekip të vogël.',
      eyebrow: 'Për hotelet e qytetit',
      title: ['Biznes, turizëm, ngjarje.', 'Një ekip i vogël.'],
      sub: 'Hotelet e qytetit jetojnë me rezervime në minutën e fundit, grupe dhe mbërritje natën vonë. Iliria e mban recepsionin të shpejtë me kalendar, faturë të fiskalizuar dhe pastrim që ndiqet dhomë pas dhome.',
      stats: [
        { value: 'Live', label: 'gjendja e dhomave nga pastrimi te recepsioni' },
        { value: 'QR', label: 'faturë e fiskalizuar për çdo shitje' },
        { value: '1 ekran', label: 'për të parë ku të vijnë paratë' },
      ],
      painsTitle: 'Çfarë e ngadalëson një hotel qyteti',
      pains: [
        { pain: 'Check-in i vonë dhe dhoma që nuk janë gati.', fix: 'Pastrimi ndiqet në kohë reale. Sapo dhoma është gati, recepsioni e sheh.' },
        { pain: 'Fatura për kompani dhe fiskalizimi merr kohë.', fix: 'Fatura del me NIVF dhe kod QR, me një klikim, në emër të kompanisë.' },
        { pain: 'Çmimet nuk ndjekin kërkesën.', fix: 'Raportet tregojnë zënien dhe kanalin që sjell më shumë para, që të vendosësh me numra.' },
      ],
      featuresTitle: 'Ç’ke nevojë në një hotel qyteti',
      features: [
        { icon: 'housekeeping', title: 'Pastrim në kohë reale', text: 'Kush po pastron çfarë, dhe cilat dhoma janë gati për mbërritjen tjetër.' },
        { icon: 'fiscal', title: 'Faturë e fiskalizuar', text: 'NIVF, NSLF dhe kod QR, me PDF për kompani.' },
        { icon: 'reports', title: 'Raporte që lexohen', text: 'Të ardhura, zënie dhe kanale, pa Excel dhe pa pritje.' },
        { icon: 'calendar', title: 'Kalendar me gisht', text: 'Ndërro dhoma dhe zgjat qëndrime pa hapur dhjetë ekrane.' },
        { icon: 'channels', title: 'Kanalet në një vend', text: 'Rezervimet nga platformat hyjnë vetë në kalendar.' },
        { icon: 'pos', title: 'Bar në lobby', text: 'Shitjet e barit bashkohen me llogarinë e dhomës.' },
      ],
      chat: {
        title: 'Një klient biznesi shkruan të hënën në mëngjes',
        sub: 'AI kontrollon disponueshmërinë për disa netë dhe përgatit ofertën me faturë për kompaninë.',
        guest: 'Kam nevojë për dy dhoma për 5 net nga e hëna, me faturë për kompaninë.',
        ai: 'Kemi dy dhoma Superior nga e hëna 12 deri të shtunën 17, 82 € natën. Fatura del në emër të kompanisë. Më jepni emrin dhe NIPT-in?',
      },
      fit: { title: 'Sa kushton për një hotel qyteti', rooms: '15 deri 40 dhoma', size: 'medium', plan: 'pro', why: 'Professional mbulon recepsionin, pastrimin, faturën e fiskalizuar dhe raportet. Kalo në Signature kur të duash sinkronizim në kohë reale me kanalet.' },
      seoTitle: 'Software për hotele qyteti në Tiranë dhe Durrës | Iliria',
      seoDescription: 'Recepsion i shpejtë, pastrim në kohë reale, faturë e fiskalizuar dhe raporte për hotele boutique në qytet.',
    },
    mountain: {
      name: 'Bujtina malore',
      place: 'Theth · Valbonë · Vermosh',
      cardText: 'Sezon i shkurtër, sinjal i dobët, mysafirë që duan siguri.',
      eyebrow: 'Për bujtinat malore',
      title: ['Larg qytetit.', 'Afër çdo rezervimi.'],
      sub: 'Në Theth apo Valbonë interneti ikën, sezoni është i shkurtër dhe mysafirët duan gjithçka të konfirmuar para se të nisen. Iliria punon nga telefoni, konfirmon vetë dhe të kujton çdo pritje: kalimin, ushqimin, transfertën.',
      stats: [
        { value: '24/7', label: 'konfirmime edhe kur je në shteg' },
        { value: '3', label: 'gjuhë të përgjigjeve: shqip, anglisht, gjermanisht' },
        { value: '20 €', label: 'në muaj për fillim, me çmimin themelues' },
      ],
      painsTitle: 'Çfarë e vështirëson një bujtinë malore',
      pains: [
        { pain: 'Konfirmime që vonojnë kur je në kullotë ose në shteg.', fix: 'AI konfirmon dhe përgjigjet ndërkohë që ti je jashtë, sipas rregullave që ke vendosur.' },
        { pain: 'Mysafirët pyesin për rrugën, ushqimin dhe kohën.', fix: 'Asistenti i di rregullat e bujtinës dhe përgjigjet në shqip, anglisht e gjermanisht.' },
        { pain: 'Parapagesa dhe shpenzimet mbahen me fletore.', fix: 'Parapagesa me link, shpenzimet në telefon dhe një pamje e qartë e sezonit.' },
      ],
      featuresTitle: 'Ç’ke nevojë në një bujtinë',
      features: [
        { icon: 'ask', title: 'Pyet hotelin', text: 'Nga telefoni pyet për rezervimet e ditës dhe merr përgjigje të shkurtër.' },
        { icon: 'inbox', title: 'Kuti postare me AI', text: 'WhatsApp dhe Messenger në një vend, me përgjigje të gatshme.' },
        { icon: 'book', title: 'Rezervim direkt', text: 'Mysafiri rezervon dhe paguan parapagesën online, pa komision.' },
        { icon: 'fiscal', title: 'Faturë e thjeshtë', text: 'Faturë e fiskalizuar në pak sekonda kur mysafiri ikën.' },
        { icon: 'expenses', title: 'Shpenzimet në telefon', text: 'Fotografo faturën e furnizuesit dhe sistemi e lexon vetë.' },
        { icon: 'housekeeping', title: 'Pastrimi i dhomave', text: 'Një listë e thjeshtë për kush duhet pastruar sot.' },
      ],
      chat: {
        title: 'Një çift gjerman planifikon Valbonë-Theth',
        sub: 'AI përgjigjet në gjermanisht, jep çmimin me darkë e mëngjes dhe dërgon linkun e parapagesës.',
        guest: 'Hallo, wir wandern von Valbona nach Theth. Habt ihr am 3. September ein Zimmer für zwei Personen mit Abendessen?',
        ai: 'Hallo! Ja, ein Doppelzimmer mit Abendessen und Frühstück kostet 65 € pro Person. Ich reserviere es und sende den Link für die Anzahlung.',
      },
      fit: { title: 'Sa kushton për një bujtinë', rooms: '4 deri 12 dhoma', size: 'small', plan: 'basic', why: 'Essential mjafton për rezervimet, faturat dhe raportet. Shto kutinë me AI kur sezoni të bëhet i ngarkuar.' },
      seoTitle: 'Software për bujtina malore në Theth dhe Valbonë | Iliria',
      seoDescription: 'Rezervime direkte me parapagesë, përgjigje automatike në shqip, anglisht dhe gjermanisht, dhe faturë e thjeshtë. Për bujtina në Alpet Shqiptare.',
    },
  },
  en: {
    resort: {
      name: 'Coastal resorts',
      place: 'Dhërmi · Himarë · Ksamil · Sarandë',
      cardText: 'A short season, many channels, every night has to sell.',
      eyebrow: 'For coastal resorts',
      title: ['The season is short.', 'Every night should sell.'],
      sub: 'From July to August the phone never stops. Iliria answers guests in their own language, keeps one calendar for every channel, and each morning tells you what you earned and what matters today.',
      stats: [
        { value: '4', label: 'booking channels in one calendar' },
        { value: '24/7', label: 'AI replies in the guest’s language' },
        { value: '1 click', label: 'from a bar sale to a fiscalized invoice' },
      ],
      painsTitle: 'What makes the season hard',
      pains: [
        { pain: 'Double bookings between Booking, Airbnb and the phone.', fix: 'One calendar. Every booking blocks the room on all channels.' },
        { pain: 'WhatsApp and Instagram messages get lost mid-season.', fix: 'One shared inbox. AI answers instantly and only passes you what needs a person.' },
        { pain: 'Bar, restaurant and spa are billed separately.', fix: 'Every sale lands on the room account and goes out as one fiscalized invoice.' },
      ],
      featuresTitle: 'What a resort needs',
      features: [
        { icon: 'calendar', title: 'A calendar you move with your fingers', text: 'Move a guest with one gesture, stretch a stay by dragging its edge.' },
        { icon: 'channels', title: 'Channels in one place', text: 'Booking, Airbnb, Expedia and Agoda sync with your calendar.' },
        { icon: 'inbox', title: 'Inbox with AI', text: 'WhatsApp, Instagram and Messenger on one screen, with replies ready.' },
        { icon: 'pos', title: 'Bar, restaurant, spa', text: 'Order at the table and bill to the room or directly.' },
        { icon: 'fiscal', title: 'Fiscalized invoice', text: 'NIVF, NSLF and QR code, ready for every sale.' },
        { icon: 'ask', title: 'Ask your hotel', text: '“How much did the bar make this week?” The answer comes with numbers and a chart.' },
      ],
      chat: {
        title: 'A guest writes at 9 in the morning',
        sub: 'AI checks availability, gives the price and only asks you to confirm.',
        guest: 'We are coming with two children. Do you have a family room and an airport transfer from Vlora?',
        ai: 'Yes. The family suite with sea view for 3 nights is €690. The transfer from Vlora airport is €45. Shall I book it for you?',
      },
      fit: { title: 'What it costs for a resort', rooms: '20 to 80 rooms', size: 'medium', plan: 'premium', why: 'The Signature plan includes real-time channel sync, which is what a resort with many bookings needs.' },
      seoTitle: 'Hotel software for coastal resorts in Albania | Iliria',
      seoDescription: 'One calendar for Booking, Airbnb and Expedia, AI that answers guests in Albanian and English, and fiscalized invoices. Built for Riviera resorts.',
    },
    heritage: {
      name: 'Heritage hotels',
      place: 'Gjirokastër · Berat · Voskopojë',
      cardText: 'Few rooms, guests from far away, every detail counts.',
      eyebrow: 'For heritage hotels',
      title: ['Few rooms.', 'Guests who travel far.'],
      sub: 'In a stone tower house with eight rooms there is no night receptionist. Iliria takes bookings, answers foreign guests while you sleep, and reminds you of every detail: breakfast, the transfer, the birthday.',
      stats: [
        { value: '24/7', label: 'replies even while you sleep' },
        { value: '360°', label: 'profile for every returning guest' },
        { value: '0%', label: 'commission on bookings from your site' },
      ],
      painsTitle: 'What tires a small hotel',
      pains: [
        { pain: 'Foreign guests write at odd hours.', fix: 'AI replies instantly in their language, at any hour, and only confirms what it should.' },
        { pain: 'You are owner, receptionist and guide at once.', fix: 'At 06:30 you get a briefing: who arrives, what to prepare, what changed.' },
        { pain: 'A guest’s preferences are forgotten by next year.', fix: 'The profile keeps what they like, birthdays and past stays. When they return, you know them.' },
      ],
      featuresTitle: 'What a small hotel needs',
      features: [
        { icon: 'profile', title: 'Guest profile', text: 'History, preferences and value of every guest on one page, like a social profile.' },
        { icon: 'ask', title: 'Ask your hotel', text: 'Write what you want to know or do, and the agent does it once you confirm.' },
        { icon: 'inbox', title: 'Inbox with AI', text: 'All messages in one place, with replies in the guest’s language.' },
        { icon: 'book', title: 'Direct booking page', text: 'Guests book from your own page, with no platform commission.' },
        { icon: 'voice', title: 'Voice assistant', text: 'Phone calls get answered even when you are with guests.' },
        { icon: 'alerts', title: 'Alerts that make sense', text: 'It only alerts you to what needs action, not to everything.' },
      ],
      chat: {
        title: 'An Italian guest writes late at night',
        sub: 'AI replies in Italian, checks the dates and books without waking anyone.',
        guest: 'Buongiorno, avete una camera per due notti a ottobre? Arriviamo in auto da Tirana.',
        ai: 'Buongiorno! Sì, per il 12 e 13 ottobre abbiamo la camera Kulla con vista sul castello a 95 €. Il parcheggio è a due minuti a piedi. La prenoto?',
      },
      fit: { title: 'What it costs for a small hotel', rooms: '5 to 15 rooms', size: 'small', plan: 'pro', why: 'Professional has the AI inbox, fiscalized invoices and bar-restaurant, without paying for what you do not need.' },
      seoTitle: 'Hotel software for heritage hotels and stone houses | Iliria',
      seoDescription: 'Direct bookings, AI that speaks the guest’s language and a 360° profile for every guest. For small hotels in Gjirokastër, Berat and Voskopojë.',
    },
    city: {
      name: 'City hotels',
      place: 'Tirana · Durrës · Shkodër',
      cardText: 'Business, tourism and events, with a small team.',
      eyebrow: 'For city hotels',
      title: ['Business, tourism, events.', 'A small team.'],
      sub: 'City hotels live on last-minute bookings, groups and late arrivals. Iliria keeps the front desk fast with a calendar, fiscalized invoices and housekeeping tracked room by room.',
      stats: [
        { value: 'Live', label: 'room status from housekeeping to the desk' },
        { value: 'QR', label: 'fiscalized invoice for every sale' },
        { value: '1 screen', label: 'to see where the money comes from' },
      ],
      painsTitle: 'What slows a city hotel',
      pains: [
        { pain: 'Late check-ins and rooms that are not ready.', fix: 'Housekeeping is tracked live. The moment a room is ready, the desk sees it.' },
        { pain: 'Company invoices and fiscalization take time.', fix: 'The invoice goes out with NIVF and a QR code, in one click, in the company’s name.' },
        { pain: 'Prices do not follow demand.', fix: 'Reports show occupancy and the channel that earns most, so you decide with numbers.' },
      ],
      featuresTitle: 'What a city hotel needs',
      features: [
        { icon: 'housekeeping', title: 'Live housekeeping', text: 'Who is cleaning what, and which rooms are ready for the next arrival.' },
        { icon: 'fiscal', title: 'Fiscalized invoice', text: 'NIVF, NSLF and QR code, with a PDF for companies.' },
        { icon: 'reports', title: 'Reports you can read', text: 'Revenue, occupancy and channels, no Excel and no waiting.' },
        { icon: 'calendar', title: 'Finger-friendly calendar', text: 'Swap rooms and extend stays without opening ten screens.' },
        { icon: 'channels', title: 'Channels in one place', text: 'Platform bookings flow into the calendar on their own.' },
        { icon: 'pos', title: 'Lobby bar', text: 'Bar sales join the room account.' },
      ],
      chat: {
        title: 'A business client writes on Monday morning',
        sub: 'AI checks availability for several nights and prepares the offer with a company invoice.',
        guest: 'I need two rooms for 5 nights from Monday, with an invoice for our company.',
        ai: 'We have two Superior rooms from Monday the 12th to Saturday the 17th at €82 a night. The invoice goes out in the company’s name. Could you send the name and tax ID?',
      },
      fit: { title: 'What it costs for a city hotel', rooms: '15 to 40 rooms', size: 'medium', plan: 'pro', why: 'Professional covers the front desk, housekeeping, fiscalized invoices and reports. Move to Signature when you want real-time channel sync.' },
      seoTitle: 'Hotel software for city hotels in Tirana and Durrës | Iliria',
      seoDescription: 'A fast front desk, live housekeeping, fiscalized invoices and reports for boutique city hotels.',
    },
    mountain: {
      name: 'Mountain guesthouses',
      place: 'Theth · Valbonë · Vermosh',
      cardText: 'A short season, weak signal, guests who want certainty.',
      eyebrow: 'For mountain guesthouses',
      title: ['Far from the city.', 'Close to every booking.'],
      sub: 'In Theth or Valbonë the internet drops, the season is short and guests want everything confirmed before they set off. Iliria works from your phone, confirms on its own and reminds you of every arrival: the hike, the meals, the transfer.',
      stats: [
        { value: '24/7', label: 'confirmations even while you are on the trail' },
        { value: '3', label: 'reply languages: Albanian, English, German' },
        { value: '€20', label: 'a month from, at the founding price' },
      ],
      painsTitle: 'What makes a mountain guesthouse hard',
      pains: [
        { pain: 'Confirmations slip when you are out with the animals or on the trail.', fix: 'AI confirms and replies while you are out, by the rules you set.' },
        { pain: 'Guests ask about the route, the food and the weather.', fix: 'The assistant knows your house rules and answers in Albanian, English and German.' },
        { pain: 'Deposits and expenses live in a notebook.', fix: 'Deposits by link, expenses on your phone and a clear view of the season.' },
      ],
      featuresTitle: 'What a guesthouse needs',
      features: [
        { icon: 'ask', title: 'Ask your hotel', text: 'From your phone, ask about the day’s bookings and get a short answer.' },
        { icon: 'inbox', title: 'Inbox with AI', text: 'WhatsApp and Messenger in one place, with replies ready.' },
        { icon: 'book', title: 'Direct booking', text: 'Guests book and pay the deposit online, with no commission.' },
        { icon: 'fiscal', title: 'Simple invoice', text: 'A fiscalized invoice in seconds when the guest leaves.' },
        { icon: 'expenses', title: 'Expenses on your phone', text: 'Photograph the supplier invoice and the system reads it.' },
        { icon: 'housekeeping', title: 'Room cleaning', text: 'A simple list of what to clean today.' },
      ],
      chat: {
        title: 'A German couple plans Valbona to Theth',
        sub: 'AI replies in German, quotes dinner and breakfast, and sends the deposit link.',
        guest: 'Hallo, wir wandern von Valbona nach Theth. Habt ihr am 3. September ein Zimmer für zwei Personen mit Abendessen?',
        ai: 'Hallo! Ja, ein Doppelzimmer mit Abendessen und Frühstück kostet 65 € pro Person. Ich reserviere es und sende den Link für die Anzahlung.',
      },
      fit: { title: 'What it costs for a guesthouse', rooms: '4 to 12 rooms', size: 'small', plan: 'basic', why: 'Essential is enough for bookings, invoices and reports. Add the AI inbox when the season gets busy.' },
      seoTitle: 'Hotel software for mountain guesthouses in Theth and Valbonë | Iliria',
      seoDescription: 'Direct bookings with deposits, automatic replies in Albanian, English and German, and simple invoices. For guesthouses in the Albanian Alps.',
    },
  },
};

export const isPropertyType = (v: string): v is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(v);
