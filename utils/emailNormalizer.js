/**
 * Utility to fix common email domain and TLD typos automatically.
 * Handles cases like:
 * - gmail.con -> gmail.com
 * - gmai.com / gamil.com / gmial.com -> gmail.com
 * - any domain ending in .con -> .com (since .con is not a valid TLD)
 * - yahoo.con -> yahoo.com, outlook.con -> outlook.com, hotmail.con -> hotmail.com
 * - whitespace trimming and lowercase domain normalization
 */

/**
 * Fixes typos in a single email string or list of emails.
 * @param {string} input 
 * @returns {string} Cleaned email
 */
function fixEmailTypo(input) {
  if (!input || typeof input !== 'string') return input;

  // Handle comma-separated list of emails (e.g. for CC or batch recipients)
  if (input.includes(',')) {
    return input
      .split(',')
      .map(part => fixEmailTypo(part.trim()))
      .join(', ');
  }

  // Handle angle bracket format: "Full Name <user@gmail.con>"
  const angleMatch = input.match(/^(.*)<([^>]+)>(.*)$/);
  if (angleMatch) {
    const prefix = angleMatch[1];
    const emailInside = fixEmailTypo(angleMatch[2].trim());
    const suffix = angleMatch[3];
    return `${prefix}<${emailInside}>${suffix}`.trim();
  }

  let cleaned = input.trim();
  if (!cleaned) return cleaned;

  // Split on the last '@'
  const atIndex = cleaned.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === cleaned.length - 1) {
    return cleaned;
  }

  let local = cleaned.substring(0, atIndex).trim().replace(/@+$/, '');
  let domain = cleaned.substring(atIndex + 1).trim().toLowerCase();

  // Normalize consecutive dots and trailing dots in domain
  domain = domain.replace(/\.{2,}/g, '.').replace(/\.+$/, '');

  // 1. Generic .con (and common .com typos) at the end of domain
  // Since .con is never a valid ICANN TLD, any domain ending in .con is safely fixed to .com
  domain = domain
    .replace(/\.con$/i, '.com')
    .replace(/\.cmo$/i, '.com')
    .replace(/\.comm$/i, '.com')
    .replace(/\.coom$/i, '.com')
    .replace(/\.cpm$/i, '.com')
    .replace(/\.ocm$/i, '.com')
    .replace(/\.xom$/i, '.com')
    .replace(/\.vom$/i, '.com');

  // 2. Specific major provider domain and TLD misspellings
  // Gmail typos: gmail.con, gmai.com, gamil.com, gmial.com, gmaill.com, gmail.co, gmailcom, etc.
  const gmailTypoRegex = /^(gmail|gmai|gamil|gmial|gmaill|gmal|gmaiil|gmaul|gnail)(\.com|\.con|\.co|\.cmo|\.comm|\.coom|com)$/i;
  if (gmailTypoRegex.test(domain)) {
    domain = 'gmail.com';
  }

  // Googlemail typos
  if (/^googlemail\.(con|cmo|comm|coom)$/i.test(domain)) {
    domain = 'googlemail.com';
  }

  // Yahoo typos: yahoo.con, yaho.com, etc.
  if (/^(yahoo|yaho|yahooo|ymai|ymail)(\.com|\.con|\.cmo|\.comm|\.coom|com)$/i.test(domain)) {
    domain = 'yahoo.com';
  }

  // Hotmail typos: hotmail.con, hotmial.com, etc.
  if (/^(hotmail|hotmial|hotmaill|hotmaildot)(\.com|\.con|\.cmo|\.comm|\.coom|com)$/i.test(domain)) {
    domain = 'hotmail.com';
  }

  // Outlook typos: outlook.con, outlok.com, etc.
  if (/^(outlook|outlok|outloo)(\.com|\.con|\.cmo|\.comm|\.coom|com)$/i.test(domain)) {
    domain = 'outlook.com';
  }

  // iCloud typos: icloud.con, icoud.com, etc.
  if (/^(icloud|icoud)(\.com|\.con|\.cmo|\.comm|\.coom|com)$/i.test(domain)) {
    domain = 'icloud.com';
  }

  return `${local}@${domain}`;
}

/**
 * Standard email normalization function.
 * @param {string} email 
 * @returns {string}
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return email;
  return fixEmailTypo(email).toLowerCase();
}

/**
 * Validates if an email is a valid format (ignoring placeholder strings like 'n/a').
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = normalizeEmail(email);
  if (['n/a', 'na', 'null', 'undefined', 'none', ''].includes(clean)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

const EMAIL_KEY_REGEX = /email/i;

/**
 * Recursively walks an object and fixes any email strings.
 * @param {any} obj 
 * @returns {any}
 */
function recursivelyNormalizeEmails(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (typeof obj[i] === 'string' && (obj[i].includes('@') && (obj[i].includes('.con') || obj[i].includes('.cmo')))) {
        obj[i] = normalizeEmail(obj[i]);
      } else if (obj[i] && typeof obj[i] === 'object') {
        recursivelyNormalizeEmails(obj[i]);
      }
    }
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      if (EMAIL_KEY_REGEX.test(key) || (val.includes('@') && (val.includes('.con') || val.includes('.cmo')))) {
        obj[key] = normalizeEmail(val);
      }
    } else if (val && typeof val === 'object') {
      recursivelyNormalizeEmails(val);
    }
  }

  return obj;
}

/**
 * Express middleware to automatically normalize and fix typos in email fields in req.body and req.query.
 */
function emailNormalizerMiddleware(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    recursivelyNormalizeEmails(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    recursivelyNormalizeEmails(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    recursivelyNormalizeEmails(req.params);
  }
  next();
}

module.exports = {
  fixEmailTypo,
  normalizeEmail,
  isValidEmail,
  recursivelyNormalizeEmails,
  emailNormalizerMiddleware,
};
