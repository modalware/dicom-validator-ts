import { describe, it, expect } from 'vitest';
import { validateUI } from './ui.js';

describe('UI Validator', () => {
  const tag = '(0008,0016)';

  it('should accept valid UI values', () => {
    expect(validateUI('1.2.840.10008.1.2', tag)).toEqual([]);
    expect(validateUI('1.2.3', tag)).toEqual([]);
    expect(validateUI('0', tag)).toEqual([]);
    expect(validateUI('1.2.840.10008.5.1.4.1.1.2', tag)).toEqual([]);
  });

  it('should accept values with trailing null padding', () => {
    expect(validateUI('1.2.3\0', tag)).toEqual([]);
    expect(validateUI('1.2.840.10008.1.2\0\0', tag)).toEqual([]);
  });

  it('should skip validation for empty values', () => {
    expect(validateUI('', tag)).toEqual([]);
    expect(validateUI('\0', tag)).toEqual([]);
  });

  it('should reject values exceeding 64 characters', () => {
    const longUID = '1.2.' + '3'.repeat(61); // > 64 chars total
    const findings = validateUI(longUID, tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].rule).toBe('vr-format-UI');
    expect(findings[0].tag).toBe(tag);
    expect(findings[0].message).toContain('64');
  });

  it('should accept values at exactly 64 characters', () => {
    // 64 chars: "1.2." + 60 digits
    const uid = '1.2.' + '3'.repeat(60);
    expect(uid.length).toBe(64);
    expect(validateUI(uid, tag)).toEqual([]);
  });

  it('should reject values with non-digit/period characters', () => {
    const findings = validateUI('1.2.abc', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-UI');
    expect(findings[0].message).toContain('digits');
  });

  it('should reject values starting with a period', () => {
    const findings = validateUI('.1.2.3', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.message.includes('start'))).toBe(true);
  });

  it('should reject values ending with a period', () => {
    const findings = validateUI('1.2.3.', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.message.includes('end'))).toBe(true);
  });

  it('should reject values with empty components (consecutive periods)', () => {
    const findings = validateUI('1.2..3', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some(f => f.message.includes('empty components'))).toBe(true);
  });

  it('should reject values with spaces', () => {
    const findings = validateUI('1.2. 3', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-UI');
  });

  it('should reject values with letters', () => {
    const findings = validateUI('1.2.3.A', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});
