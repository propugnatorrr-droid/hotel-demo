import { makeCopy } from '@/lib/copy';

const sq = {
  eyebrow: 'Cilësimet',
  title: 'Hoteli yt, siç e do.',
  subtitle: 'Profili, personaliteti i AI-së, dhomat dhe ekipi. Çdo ndryshim hyn në fuqi menjëherë.',
  tabs: { hotel: 'Hoteli', ai: 'Asistenti AI', rooms: 'Dhomat', team: 'Ekipi' },
  saved: 'U ruajt.',
  save: 'Ruaj',
  siteLink: 'Faqja publike e hotelit',
  hotel: {
    name: 'Emri i hotelit', legalName: 'Emri ligjor', nipt: 'NIPT', address: 'Adresa', city: 'Qyteti', phone: 'Telefoni', email: 'Email', website: 'Faqja e internetit', cover: 'Foto kryesore (URL https)',
    currency: 'Monedha', locale: 'Gjuha e paracaktuar', checkIn: 'Ora e check-in', checkOut: 'Ora e check-out', review: 'Lidhja e vlerësimit (Google/Booking)', fx: '1 € = ? lekë (për raportet)', ownerWhatsapp: 'WhatsApp i pronarit (raporti i mëngjesit)', telegram: 'Telegram chat ID (raporti i mëngjesit)',
  },
  ai: { name: 'Emri i asistentit', tone: 'Toni', toneHint: 'p.sh. i ngrohtë, elegant, i shkurtër', instructions: 'Faktet e hotelit që AI duhet t’i dijë', instructionsHint: 'Ora e mëngjesit, check-in/out, Wi-Fi, parkimi, transferta, rregullat e kafshëve…' },
  rooms: {
    types: 'Llojet e dhomave', addType: 'Lloj i ri', rooms: 'Dhomat', addRoom: 'Shto dhomë', number: 'Numri', floor: 'Kati', type: 'Lloji', active: 'Aktive', code: 'Kodi', nameSq: 'Emri (shqip)', nameEn: 'Emri (anglisht)', descSq: 'Përshkrimi (shqip)', descEn: 'Përshkrimi (anglisht)',
    price: 'Çmimi bazë / natë', baseOcc: 'Persona standard', maxOcc: 'Persona maksimum', size: 'm²', bed: 'Shtrati', view: 'Pamja', amenities: 'Pajisjet (me presje)', images: 'Foto (URL https, një për rresht)', deactivate: 'Çaktivizo', activate: 'Aktivizo', perNight: 'për natë', roomsCount: (n: number) => `${n} dhoma`,
  },
  team: { invite: 'Fto anëtar', email: 'Email', fullName: 'Emri i plotë', role: 'Roli', send: 'Dërgo ftesën', invited: 'Ftesa u dërgua.', you: 'Ti', active: 'Aktiv', disabled: 'I çaktivizuar', disable: 'Çaktivizo', enable: 'Aktivizo' },
  roles: { owner: 'Pronar', manager: 'Menaxher', receptionist: 'Recepsion', housekeeping: 'Pastrim', pos: 'Bar & restorant', spa: 'Spa', accountant: 'Financa' } as Record<string, string>,
  errors: { invalid: 'Kontrollo fushat.', forbidden: 'Nuk ke leje për këtë.', notFound: 'Nuk u gjet.', duplicate: 'Ekziston tashmë (kod ose numër i përsëritur).', inviteFailed: 'Ftesa dështoi. Kontrollo emailin dhe konfigurimin e Supabase.', selfChange: 'Nuk mund ta ndryshosh veten.', type: 'Lloji nuk u gjet.', unknown: 'Diçka shkoi keq.', module: 'Moduli është i çaktivizuar.' } as Record<string, string>,
};

const en: typeof sq = {
  eyebrow: 'Settings',
  title: 'Your hotel, your way.',
  subtitle: 'Profile, AI personality, rooms and team. Every change applies immediately.',
  tabs: { hotel: 'Hotel', ai: 'AI assistant', rooms: 'Rooms', team: 'Team' },
  saved: 'Saved.',
  save: 'Save',
  siteLink: 'Public hotel website',
  hotel: {
    name: 'Hotel name', legalName: 'Legal name', nipt: 'Tax ID (NIPT)', address: 'Address', city: 'City', phone: 'Phone', email: 'Email', website: 'Website', cover: 'Cover photo (https URL)',
    currency: 'Currency', locale: 'Default language', checkIn: 'Check-in time', checkOut: 'Check-out time', review: 'Review link (Google/Booking)', fx: '€1 = ? lek (for reports)', ownerWhatsapp: 'Owner WhatsApp (morning report)', telegram: 'Telegram chat ID (morning report)',
  },
  ai: { name: 'Assistant name', tone: 'Tone', toneHint: 'e.g. warm, elegant, concise', instructions: 'Hotel facts the AI must know', instructionsHint: 'Breakfast hours, check-in/out, Wi-Fi, parking, transfers, pet policy…' },
  rooms: {
    types: 'Room types', addType: 'New type', rooms: 'Rooms', addRoom: 'Add room', number: 'Number', floor: 'Floor', type: 'Type', active: 'Active', code: 'Code', nameSq: 'Name (Albanian)', nameEn: 'Name (English)', descSq: 'Description (Albanian)', descEn: 'Description (English)',
    price: 'Base price / night', baseOcc: 'Standard guests', maxOcc: 'Max guests', size: 'sqm', bed: 'Bed', view: 'View', amenities: 'Amenities (comma separated)', images: 'Photos (https URLs, one per line)', deactivate: 'Deactivate', activate: 'Activate', perNight: 'per night', roomsCount: (n) => `${n} rooms`,
  },
  team: { invite: 'Invite member', email: 'Email', fullName: 'Full name', role: 'Role', send: 'Send invite', invited: 'Invite sent.', you: 'You', active: 'Active', disabled: 'Disabled', disable: 'Disable', enable: 'Enable' },
  roles: { owner: 'Owner', manager: 'Manager', receptionist: 'Receptionist', housekeeping: 'Housekeeping', pos: 'Bar & restaurant', spa: 'Spa', accountant: 'Accountant' },
  errors: { invalid: 'Check the fields.', forbidden: 'Not allowed.', notFound: 'Not found.', duplicate: 'Already exists (duplicate code or number).', inviteFailed: 'Invite failed. Check the email and Supabase configuration.', selfChange: 'You cannot change yourself.', type: 'Type not found.', unknown: 'Something went wrong.', module: 'Module disabled.' },
};

export const pickSettingsCopy = makeCopy(sq, en);
