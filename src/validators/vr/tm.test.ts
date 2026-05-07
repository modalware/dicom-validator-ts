import { describe, it, expect } from 'vitest';
import { validateTM } from './tm.js';

describe('TM (Time) Validator', () => {
  const tag = '(0008,0030)';

  describe('valid values', () => {
    it('should accept HH format (2 digits)', () => {
      expect(validateTM('00', tag)).toEqual([]);
      expect(validateTM('12', tag)).toEqual([]);
      expect(validateTM('23', tag)).toEqual([]);
    });

    it('should accept HHMM format (4 digits)', () => {
      expect(validateTM('0000', tag)).toEqual([]);
      expect(validateTM('1230', tag)).toEqual([]);
      expect(validateTM('2359', tag)).toEqual([]);
    });

    it('should accept HHMMSS format (6 digits)', () => {
      expect(validateTM('000000', tag)).toEqual([]);
      expect(validateTM('123045', tag)).toEqual([]);
      expect(validateTM('235959', tag)).toEqual([]);
    });

    it('should accept HHMMSS.FFFFFF format with fractional seconds', () => {
      expect(validateTM('120000.1', tag)).toEqual([]);
      expect(validateTM('120000.12', tag)).toEqual([]);
      expect(validateTM('120000.123', tag)).toEqual([]);
      expect(validateTM('120000.1234', tag)).toEqual([]);
      expect(validateTM('120000.12345', tag)).toEqual([]);
      expect(validateTM('120000.123456', tag)).toEqual([]);
    });

    it('should accept values with trailing spaces', () => {
      expect(validateTM('12  ', tag)).toEqual([]);
      expect(validateTM('1230 ', tag)).toEqual([]);
      expect(validateTM('123045   ', tag)).toEqual([]);
    });
  });

  describe('invalid values', () => {
    it('should reject hour > 23', () => {
      const findings = validateTM('24', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vr-format-TM');
      expect(findings[0].tag).toBe(tag);
      expect(findings[0].message).toContain('hour');
    });

    it('should reject minute > 59', () => {
      const findings = validateTM('1260', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].message).toContain('minute');
    });

    it('should reject second > 59', () => {
      const findings = validateTM('123060', tag);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].message).toContain('second');
    });

    it('should reject odd-length digit strings (1, 3, 5 digits)', () => {
      expect(validateTM('1', tag)).toHaveLength(1);
      expect(validateTM('123', tag)).toHaveLength(1);
      expect(validateTM('12345', tag)).toHaveLength(1);
    });

    it('should reject more than 6 digits without a dot', () => {
      const findings = validateTM('1234567', tag);
      expect(findings).toHaveLength(1);
    });

    it('should reject fractional seconds with more than 6 digits', () => {
      const findings = validateTM('120000.1234567', tag);
      expect(findings).toHaveLength(1);
    });

    it('should reject fractional seconds without full HHMMSS', () => {
      const findings = validateTM('12.5', tag);
      expect(findings).toHaveLength(1);

      const findings2 = validateTM('1230.5', tag);
      expect(findings2).toHaveLength(1);
    });

    it('should reject non-digit characters', () => {
      const findings = validateTM('12:30:00', tag);
      expect(findings).toHaveLength(1);
    });

    it('should reject empty string after trimming', () => {
      const findings = validateTM('   ', tag);
      expect(findings).toHaveLength(1);
    });
  });
});
