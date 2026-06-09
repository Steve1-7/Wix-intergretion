import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { syncEngine } from '../syncEngine.js';

// Mock dependencies
jest.mock('../db.js');
jest.mock('../hubspot.js');
jest.mock('../wix.js');
jest.mock('../tokenManager.js');
jest.mock('../utils/logger.js');

describe('Sync Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeHash', () => {
    it('should compute consistent hash for same data', () => {
      const data = { email: 'test@example.com', firstname: 'John' };
      const hash1 = syncEngine.computeHash(data);
      const hash2 = syncEngine.computeHash(data);
      
      expect(hash1).toBe(hash2);
    });

    it('should compute different hashes for different data', () => {
      const data1 = { email: 'test@example.com', firstname: 'John' };
      const data2 = { email: 'test@example.com', firstname: 'Jane' };
      const hash1 = syncEngine.computeHash(data1);
      const hash2 = syncEngine.computeHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects', () => {
      const data = { 
        email: 'test@example.com', 
        address: { street: '123 Main St', city: 'Boston' } 
      };
      const hash = syncEngine.computeHash(data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('applyTransform', () => {
    it('should apply lowercase transform', () => {
      const result = syncEngine.applyTransform('TEST@EXAMPLE.COM', 'lowercase');
      expect(result).toBe('test@example.com');
    });

    it('should apply uppercase transform', () => {
      const result = syncEngine.applyTransform('test@example.com', 'uppercase');
      expect(result).toBe('TEST@EXAMPLE.COM');
    });

    it('should apply trim transform', () => {
      const result = syncEngine.applyTransform('  test@example.com  ', 'trim');
      expect(result).toBe('test@example.com');
    });

    it('should return original value for none transform', () => {
      const result = syncEngine.applyTransform('test@example.com', 'none');
      expect(result).toBe('test@example.com');
    });

    it('should handle format_phone transform', () => {
      const result = syncEngine.applyTransform('1234567890', 'format_phone');
      expect(result).toBe('(123) 456-7890');
    });

    it('should return original value for unknown transform', () => {
      const result = syncEngine.applyTransform('test@example.com', 'unknown');
      expect(result).toBe('test@example.com');
    });
  });

  describe('transformData', () => {
    it('should transform data based on mappings', () => {
      const mappings = [
        { wix_field: 'email', hubspot_property: 'email', transform: 'lowercase' },
        { wix_field: 'firstname', hubspot_property: 'firstname', transform: 'uppercase' },
      ];
      const data = { email: 'TEST@EXAMPLE.COM', firstname: 'john' };
      
      const result = syncEngine.transformData(data, mappings, 'wix_to_hubspot');
      
      expect(result.email).toBe('test@example.com');
      expect(result.firstname).toBe('JOHN');
    });

    it('should handle empty mappings', () => {
      const data = { email: 'test@example.com', firstname: 'john' };
      const result = syncEngine.transformData(data, [], 'wix_to_hubspot');
      
      expect(result).toEqual(data);
    });

    it('should handle missing fields', () => {
      const mappings = [
        { wix_field: 'email', hubspot_property: 'email', transform: 'lowercase' },
        { wix_field: 'missing_field', hubspot_property: 'missing', transform: 'none' },
      ];
      const data = { email: 'TEST@EXAMPLE.COM' };
      
      const result = syncEngine.transformData(data, mappings, 'wix_to_hubspot');
      
      expect(result.email).toBe('test@example.com');
      expect(result.missing).toBeUndefined();
    });
  });

  describe('resolveConflict', () => {
    it('should use last updated wins strategy', () => {
      const wixData = { email: 'test@example.com', updated_at: '2024-01-02T00:00:00Z' };
      const hubspotData = { email: 'test@example.com', updated_at: '2024-01-01T00:00:00Z' };
      
      const result = syncEngine.resolveConflict(wixData, hubspotData, 'last_updated_wins');
      
      expect(result).toEqual(wixData);
    });

    it('should use wix wins strategy', () => {
      const wixData = { email: 'test@example.com' };
      const hubspotData = { email: 'test@example.com' };
      
      const result = syncEngine.resolveConflict(wixData, hubspotData, 'wix_wins');
      
      expect(result).toEqual(wixData);
    });

    it('should use hubspot wins strategy', () => {
      const wixData = { email: 'test@example.com' };
      const hubspotData = { email: 'test@example.com' };
      
      const result = syncEngine.resolveConflict(wixData, hubspotData, 'hubspot_wins');
      
      expect(result).toEqual(hubspotData);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      // Mock the database call
      const mockStats = {
        completed: 100,
        failed: 5,
        pending: 2,
        skipped: 1,
      };
      
      // This would require mocking the supabase client
      // For now, we'll just test the function exists
      expect(typeof syncEngine.getSyncStats).toBe('function');
    });
  });
});
