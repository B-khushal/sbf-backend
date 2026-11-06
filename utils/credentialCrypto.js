const crypto = require('crypto');

// Derives a 32-byte encryption key from environment variable or fallback secret
const getEncryptionKey = () => {
  const secret = process.env.DATABASE_ENCRYPTION_KEY || process.env.JWT_SECRET || 'sbf-florist-ultra-secure-key-32b-seed';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/**
 * Encrypts sensitive string using AES-256-GCM
 */
const encryptCredential = (text) => {
  if (!text || typeof text !== 'string') return '';
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('[Crypto] Failed to encrypt credential:', error.message);
    throw new Error('Credential encryption failed');
  }
};

/**
 * Decrypts AES-256-GCM encrypted string
 */
const decryptCredential = (encryptedPayload) => {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return '';
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      // In case plaintext or legacy, return empty or safe fallback
      return '';
    }
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Crypto] Failed to decrypt credential:', error.message);
    return '';
  }
};

/**
 * Masks database connection string to hide password
 * Example: postgresql://postgres:secret123@187.127.150.217:5432/sbflorist
 * Output: postgresql://postgres:••••••••@187.127.150.217:5432/sbflorist
 */
const maskConnectionString = (connUrl) => {
  if (!connUrl || typeof connUrl !== 'string') return '';
  try {
    // Handle standard PostgreSQL URL regex
    return connUrl.replace(
      /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/i,
      (match, prefix, password, suffix) => {
        return `${prefix}••••••••${suffix}`;
      }
    );
  } catch (e) {
    return 'postgresql://••••:••••@••••:••••/••••';
  }
};

/**
 * Sanitizes any string or error message by stripping potential passwords/connection strings
 */
const sanitizeError = (err) => {
  if (!err) return 'Unknown error';
  const msg = typeof err === 'string' ? err : err.message || String(err);
  return msg.replace(
    /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/gi,
    '$1••••••••$3'
  );
};

module.exports = {
  encryptCredential,
  decryptCredential,
  maskConnectionString,
  sanitizeError
};

