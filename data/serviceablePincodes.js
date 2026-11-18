const DEFAULT_CITY = 'Hyderabad';
const CITY_SECUNDERABAD = 'Secunderabad';
const DEFAULT_STATE = 'Telangana';

const SERVICEABLE_PINCODES = [
  { code: '500001', area: 'Gandhi Bhavan / GPO / Moazzampura', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500002', area: 'Moghalpura', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500003', area: 'Begumpet Policelines / Secunderabad HO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500004', area: 'Bazarghat / Khairatabad HQ', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500005', area: 'CRP Camp / Masab Tank BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500006', area: 'Karwan Sahu / Mangalhat SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500007', area: 'Administrative Buildings / IICT', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500008', area: 'Golconda / Hyder Shah Kote', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500009', area: 'Manovikasnagar / Napier Lines SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500010', area: 'Bolaram SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500011', area: 'Bowenpally SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500012', area: 'Begumbazar SO / Osmania Gen. Hospital', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500013', area: 'Amberpet SO / Seminary BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500015', area: 'Jagannandas / EME Records BO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500016', area: 'Begumpet SO / Prakashnagar SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500017', area: 'Lallaguda / Lallapet SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500018', area: 'Sanath Nagar / Erragadda SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500019', area: 'Lingampalli SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500022', area: 'Central Secretariat SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500023', area: 'Yakutpura SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500024', area: 'Chandanagar / Sahifa SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500025', area: 'Himmatnagar SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500026', area: 'Mehrunagar SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500027', area: 'Barkatpura SO / Nimboliadda SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500028', area: 'Humayunnagar / Shantinagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500029', area: 'Himayathnagar / Ramakrishna Mutt SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500030', area: 'Rajendranagar SO / Kamatpur BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500031', area: 'Ibrahim Bagh Lines SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500033', area: 'Jubilee Hills SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500034', area: 'Banjara Hills SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500035', area: 'Saroornagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500036', area: 'Malakpet Colony SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500037', area: 'Ramreddynagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500038', area: 'Sanjeev Reddy Nagar SO / Vengal Rao Nagar', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500039', area: 'Bodupal SO / Peerzadiguda BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500040', area: 'Moula Ali SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500041', area: 'Raj Bhavan SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500042', area: 'Ferozguda SO / New Bowenpally', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500043', area: 'Osmangunj / Sitarambagh / Chudi Bazar', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500044', area: 'Ambernagar / Vidyanagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500045', area: 'Yousufguda SO / AGS Staff Quarters', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500046', area: 'University of Hyderabad (HCU) / Gachibowli', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500047', area: 'Malakpet SO / Moosarambagh', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500048', area: 'Attapur SO / Hyderguda SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500049', area: 'Miyapur SO / Hafeezpet / Huda Colony', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500050', area: 'Chandanagar SO / Beeramguda / Lingampally', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500052', area: 'Hasannagar / SVPMTA SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500053', area: 'Falaknuma / Uppuguda SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500054', area: 'HMT Township SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500055', area: 'IDA Jeedimetla SO / Quthbullapur BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500056', area: 'Neredmet SO / Ramakrishna Puram SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500057', area: 'Vijay Nagar Colony SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500058', area: 'Kanchanbagh SO / Badangpet BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500059', area: 'Saidabad SO / Colony', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500060', area: 'Dilsukhnagar Colony / P&T Colony', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500061', area: 'Sitaphalmandi SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500062', area: 'ECIL / Dr A S Rao Nagar SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500063', area: 'LIC Division SO / New MLA Quarters', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500064', area: 'Bahadurpura SO / Hussainsalam', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500065', area: 'Shahalinanda SO / Fatehdarwaza', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500066', area: 'High Court SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500067', area: 'Suchitra Junction SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500068', area: 'GSI Bandlaguda SO / Mansoorabad', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500069', area: 'R.C. Imar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500070', area: 'Vanasthalipuram SO / Vaidehinagar', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500071', area: 'Rail Nilayam SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500072', area: 'Kukatpally SO / Vivekanandanagar', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500073', area: 'Srinagar Colony SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500074', area: 'LB Nagar SO / Rangareddy District Court', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500076', area: 'I.E. Nacharam SO / Snehapuri Colony', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500077', area: 'Kattedan I.E. SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500079', area: 'Jillellaguda / Karmanghat / Vaishalinagar / Hasthinapuram', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500080', area: 'Gandhinagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500081', area: 'Cyberabad SO / Madhapur BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500082', area: 'I.M. Colony / Somajiguda SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500083', area: 'Nagaram SO (K.V. Rangareddy)', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500084', area: 'Kothaguda SO / Kondapur BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500085', area: 'JNTU Kukatpally SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500086', area: 'Don Bosco Nagar SO (Rajendranagar)', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500087', area: 'JJ Nagar Colony / Jawahar Nagar', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500089', area: 'Manikonda / Manchirevula / Narsingi', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500090', area: 'Nizampet SO / Miyapur BO / Mallampet BO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500091', area: 'Hydershakote / AV Enclave / AP Police Academy', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500092', area: 'Boduppal SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500093', area: 'Vikasnagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500094', area: 'Sainikpuri SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500095', area: 'Putlibowli SO / SBI SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500096', area: 'Film Nagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500097', area: 'Meerpet SO / Gayathrinagar SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500098', area: 'Medipalli SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500100', area: 'Kompally SO / Doolapalli / Pochampally', city: DEFAULT_CITY, state: DEFAULT_STATE },
  { code: '500102', area: 'Rama Krishnapuram SO', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500103', area: 'Saket / Sainikpuri', city: CITY_SECUNDERABAD, state: DEFAULT_STATE },
  { code: '500104', area: 'Chitrapuri Colony SO', city: DEFAULT_CITY, state: DEFAULT_STATE },
];

const PINCODE_MAP = new Map(SERVICEABLE_PINCODES.map((entry) => [entry.code, entry]));

const normalizePincode = (raw) => {
  if (raw === undefined || raw === null) return '';
  return String(raw).replace(/\D/g, '').slice(0, 6);
};

const lookupPincode = (raw) => {
  const code = normalizePincode(raw);
  if (code.length !== 6) return null;
  return PINCODE_MAP.get(code) || null;
};

const normalizeIndianPhone = (raw) => {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
};

const isValidIndianMobile = (raw) => {
  const digits = normalizeIndianPhone(raw);
  return /^[6-9]\d{9}$/.test(digits);
};

const sanitizeText = (value, maxLength = 300) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const ALT_PHONE_TAG_REGEX = /\s*\[ALT_PHONE:([0-9+\-\s]{7,20})\]\s*$/;

const unpackNotesAndAltPhone = (notesRaw = '', explicitAltPhone = '') => {
  const raw = typeof notesRaw === 'string' ? notesRaw : '';
  const match = raw.match(ALT_PHONE_TAG_REGEX);
  const extractedAlt = match ? match[1].trim() : '';
  const cleanNotes = match ? raw.replace(ALT_PHONE_TAG_REGEX, '').trim() : raw.trim();
  return {
    notes: cleanNotes,
    alternatePhone: (explicitAltPhone || extractedAlt || '').trim(),
  };
};

const packNotesAndAltPhone = (notesRaw = '', alternatePhone = '') => {
  const cleanNotes = sanitizeText(String(notesRaw || '').replace(ALT_PHONE_TAG_REGEX, ''), 250);
  const cleanAlt = normalizeIndianPhone(alternatePhone);
  if (!cleanAlt) return cleanNotes;
  return cleanNotes ? `${cleanNotes} [ALT_PHONE:${cleanAlt}]` : `[ALT_PHONE:${cleanAlt}]`;
};

module.exports = {
  SERVICEABLE_PINCODES,
  normalizePincode,
  lookupPincode,
  normalizeIndianPhone,
  isValidIndianMobile,
  sanitizeText,
  unpackNotesAndAltPhone,
  packNotesAndAltPhone,
};
