import CryptoJS from 'crypto-js';
import { logger } from './logger.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} plaintext - The data to encrypt
 * @returns {string} Encrypted data in format: iv:authTag:ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  
  try {
    const iv = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
    
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    // Combine IV and ciphertext
    const ivHex = CryptoJS.enc.Hex.stringify(iv);
    const ciphertext = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    
    return `${ivHex}:${ciphertext}`;
  } catch (error) {
    logger.error('encryption', 'Encryption failed', { error: error.message });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param {string} encrypted - The encrypted data in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encrypted) {
  if (!encrypted) return encrypted;
  
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, ciphertext] = parts;
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
    
    const ciphertextWordArray = CryptoJS.enc.Base64.parse(ciphertext);
    
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertextWordArray },
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('encryption', 'Decryption failed', { error: error.message });
    throw new Error('Decryption failed');
  }
}

/**
 * Mask sensitive data for logging
 * @param {string} value - The value to mask
 * @param {number} visibleChars - Number of characters to show at start
 * @returns {string} Masked value
 */
export function maskValue(value, visibleChars = 4) {
  if (!value || typeof value !== 'string') return '****';
  if (value.length <= visibleChars) return '****';
  return value.slice(0, visibleChars) + '****';
}

export default { encrypt, decrypt, maskValue };
