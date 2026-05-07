import { describe, it, expect } from 'vitest';
import { validatePN } from './pn.js';

describe('PN Validator', () => {
  const tag = '(0010,0010)';

  describe('valid values', () => {
    it('should accept a simple name', () => {
      expect(validatePN('Doe^John', tag)).toEqual([]);
    });

    it('should accept a name with all 5 components', () => {
      expect(validatePN('Doe^John^M^Dr^Jr', tag)).toEqual([]);
    });

    it('should accept a name with multiple component groups', () => {
      expect(validatePN('Doe^John=Ideographic=Phonetic', tag)).toEqual([]);
    });

    it('should accept a name with 3 groups and 5 components each', () => {
      expect(validatePN('A^B^C^D^E=F^G^H^I^J=K^L^M^N^O', tag)).toEqual([]);
    });

    it('should accept a single family name', () => {
      expect(validatePN('Smith', tag)).toEqual([]);
    });

    it('should accept empty component groups', () => {
      expect(validatePN('==', tag)).toEqual([]);
    });

    it('should accept a name at exactly 64 chars per group', () => {
      const group = 'A'.repeat(64);
      expect(validatePN(group, tag)).toEqual([]);
    });
  });

  describe('component group count', () => {
    it('should reject more than 3 component groups', () => {
      const findings = validatePN('A=B=C=D', tag);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-PN');
      expect(findings[0].tag).toBe(tag);
      expect(findings[0].message).toContain('component groups');
    });
  });

  describe('component group length', () => {
    it('should reject a component group exceeding 64 characters', () => {
      const longGroup = 'A'.repeat(65);
      const findings = validatePN(longGroup, tag);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-PN');
      expect(findings[0].message).toContain('64');
    });

    it('should reject when second group exceeds 64 characters', () => {
      const findings = validatePN('Doe^John=' + 'B'.repeat(65), tag);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some(f => f.message.includes('group 2'))).toBe(true);
    });
  });

  describe('component count per group', () => {
    it('should reject more than 5 components in a group', () => {
      const findings = validatePN('A^B^C^D^E^F', tag);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-PN');
      expect(findings[0].message).toContain('components');
    });

    it('should reject more than 5 components in the second group', () => {
      const findings = validatePN('Doe^John=A^B^C^D^E^F', tag);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some(f => f.message.includes('group 2'))).toBe(true);
    });
  });

  describe('multiple errors', () => {
    it('should report multiple errors for multiple violations', () => {
      // 4 groups (too many) + first group too long
      const findings = validatePN('A'.repeat(65) + '=B=C=D', tag);
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
