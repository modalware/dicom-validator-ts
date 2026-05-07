import { describe, it, expect } from 'vitest';
import { validateDA } from './da.js';

describe('DA (Date) Validator', () => {
  const tag = '(0008,0020)';

  describe('valid dates', () => {
    it('should accept a valid date', () => {
      expect(validateDA('20230115', tag)).toEqual([]);
    });

    it('should accept January 31', () => {
      expect(validateDA('20230131', tag)).toEqual([]);
    });

    it('should accept February 28 in a non-leap year', () => {
      expect(validateDA('20230228', tag)).toEqual([]);
    });

    it('should accept February 29 in a leap year (divisible by 4)', () => {
      expect(validateDA('20240229', tag)).toEqual([]);
    });

    it('should accept February 29 in a leap year (divisible by 400)', () => {
      expect(validateDA('20000229', tag)).toEqual([]);
    });

    it('should accept April 30', () => {
      expect(validateDA('20230430', tag)).toEqual([]);
    });

    it('should accept December 31', () => {
      expect(validateDA('20231231', tag)).toEqual([]);
    });

    it('should accept the first day of the year', () => {
      expect(validateDA('20230101', tag)).toEqual([]);
    });
  });

  describe('invalid format', () => {
    it('should reject a value that is not 8 digits', () => {
      const findings = validateDA('2023011', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-DA');
      expect(findings[0].tag).toBe(tag);
    });

    it('should reject a value with non-digit characters', () => {
      const findings = validateDA('2023-01-15', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].rule).toBe('vr-format-DA');
    });

    it('should reject a value that is too long', () => {
      const findings = validateDA('202301150', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].rule).toBe('vr-format-DA');
    });

    it('should skip validation for an empty string (per requirement 3.8)', () => {
      const findings = validateDA('', tag);
      expect(findings).toHaveLength(0);
    });

    it('should reject a value with spaces', () => {
      const findings = validateDA('2023 115', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].rule).toBe('vr-format-DA');
    });
  });

  describe('invalid month', () => {
    it('should reject month 00', () => {
      const findings = validateDA('20230015', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-DA');
      expect(findings[0].message).toContain('month');
    });

    it('should reject month 13', () => {
      const findings = validateDA('20231315', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('month');
    });
  });

  describe('invalid day', () => {
    it('should reject day 00', () => {
      const findings = validateDA('20230100', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-DA');
      expect(findings[0].message).toContain('day');
    });

    it('should reject day 32 in January', () => {
      const findings = validateDA('20230132', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('day');
    });

    it('should reject February 29 in a non-leap year', () => {
      const findings = validateDA('20230229', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('day');
    });

    it('should reject February 29 in a century year not divisible by 400', () => {
      const findings = validateDA('19000229', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('day');
    });

    it('should reject April 31', () => {
      const findings = validateDA('20230431', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('day');
    });

    it('should reject June 31', () => {
      const findings = validateDA('20230631', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('day');
    });
  });
});
