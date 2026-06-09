import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { encrypt, decrypt, maskValue } from '../encryption.js';

describe('Encryption Utility', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  describe('encrypt', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':');
    });

    it('should return null for null input', () => {
      const result = encrypt(null);
      expect(result).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      const result = encrypt(undefined);
      expect(result).toBeUndefined();
    });

    it('should encrypt empty string', () => {
      const result = encrypt('');
      expect(result).toBe('');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should return null for null input', () => {
      const result = decrypt(null);
      expect(result).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      const result = decrypt(undefined);
      expect(result).toBeUndefined();
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid-format')).toThrow();
    });
  });

  describe('maskValue', () => {
    it('should mask value with default visible chars', () => {
      const value = 'sensitive-email@example.com';
      const masked = maskValue(value);
      
      expect(masked).toBe('sens****');
    });

    it('should mask value with custom visible chars', () => {
      const value = 'sensitive-email@example.com';
      const masked = maskValue(value, 10);
      
      expect(masked).toBe('sensitive****');
    });

    it('should return **** for short values', () => {
      const value = 'abc';
      const masked = maskValue(value);
      
      expect(masked).toBe('****');
    });

    it('should return **** for null', () => {
      const masked = maskValue(null);
      expect(masked).toBe('****');
    });

    it('should return **** for non-string', () => {
      const masked = maskValue(123);
      expect(masked).toBe('****');
    });
  });

  describe('round-trip encryption', () => {
    it('should maintain data integrity through encrypt-decrypt cycle', () => {
      const testData = [
        'simple text',
        'email@example.com',
        'special-chars!@#$%^&*()',
        'unicode-ñ-é-ü',
        'long-text-' + 'x'.repeat(1000),
      ];

      testData.forEach(data => {
        const encrypted = encrypt(data);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(data);
      });
    });
  });
});
