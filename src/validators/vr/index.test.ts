import { describe, it, expect } from 'vitest';
import { vrValidatorRegistry, VRValidatorFn, getVRValidator } from './index.js';

describe('VR Validator Registry', () => {
  it('should have validators for all required VR types', () => {
    const expectedVRs = ['AE', 'AS', 'CS', 'DS', 'IS', 'LO', 'LT', 'SH', 'ST', 'UC', 'UR', 'UT', 'OB', 'OW'];
    for (const vr of expectedVRs) {
      expect(vrValidatorRegistry.has(vr)).toBe(true);
    }
  });

  it('should return a function for each registered VR', () => {
    for (const [, validator] of vrValidatorRegistry) {
      expect(typeof validator).toBe('function');
    }
  });
});

describe('getVRValidator', () => {
  it('should return the validator function for a registered VR', () => {
    const validator = getVRValidator('AE');
    expect(validator).toBeDefined();
    expect(typeof validator).toBe('function');
  });

  it('should return undefined for an unregistered VR', () => {
    const validator = getVRValidator('XX');
    expect(validator).toBeUndefined();
  });

  it('should return the same function as the registry for each VR', () => {
    const expectedVRs = ['AE', 'AS', 'CS', 'DS', 'IS', 'LO', 'LT', 'SH', 'ST', 'UC', 'UR', 'UT', 'OB', 'OW'];
    for (const vr of expectedVRs) {
      expect(getVRValidator(vr)).toBe(vrValidatorRegistry.get(vr));
    }
  });

  it('should return a function that produces findings for invalid values', () => {
    const validator = getVRValidator('AS')!;
    const findings = validator('INVALID', '(0010,1010)');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe('error');
  });

  it('should return a function that produces empty findings for valid values', () => {
    const validator = getVRValidator('AS')!;
    const findings = validator('045Y', '(0010,1010)');
    expect(findings).toEqual([]);
  });
});

describe('AE Validator', () => {
  const validate = vrValidatorRegistry.get('AE')!;
  const tag = '(0008,0054)';

  it('should accept valid AE values', () => {
    expect(validate('WORKSTATION1', tag)).toEqual([]);
    expect(validate('MY_AET', tag)).toEqual([]);
    expect(validate('A', tag)).toEqual([]);
    expect(validate('1234567890123456', tag)).toEqual([]); // exactly 16 chars
  });

  it('should reject values exceeding 16 characters', () => {
    const findings = validate('12345678901234567', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].rule).toBe('vr-format-AE');
    expect(findings[0].tag).toBe(tag);
  });

  it('should reject values containing backslash', () => {
    const findings = validate('AE\\VALUE', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('backslash');
  });

  it('should reject values with control characters', () => {
    const findings = validate('AE\x01VALUE', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('control characters');
  });
});

describe('AS Validator', () => {
  const validate = vrValidatorRegistry.get('AS')!;
  const tag = '(0010,1010)';

  it('should accept valid AS values', () => {
    expect(validate('045Y', tag)).toEqual([]);
    expect(validate('003M', tag)).toEqual([]);
    expect(validate('012W', tag)).toEqual([]);
    expect(validate('001D', tag)).toEqual([]);
  });

  it('should reject values not exactly 4 characters', () => {
    const findings = validate('45Y', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].rule).toBe('vr-format-AS');
  });

  it('should reject values with invalid format', () => {
    const findings = validate('45YY', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('NNNx');
  });

  it('should reject values with invalid suffix', () => {
    const findings = validate('045X', tag);
    expect(findings).toHaveLength(1);
  });
});

describe('CS Validator', () => {
  const validate = vrValidatorRegistry.get('CS')!;
  const tag = '(0008,0060)';

  it('should accept valid CS values', () => {
    expect(validate('CT', tag)).toEqual([]);
    expect(validate('MR', tag)).toEqual([]);
    expect(validate('ORIGINAL', tag)).toEqual([]);
    expect(validate('VALUE_1', tag)).toEqual([]);
    expect(validate('A B', tag)).toEqual([]);
  });

  it('should reject values exceeding 16 characters', () => {
    const findings = validate('12345678901234567', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-CS');
  });

  it('should reject lowercase letters', () => {
    const findings = validate('lowercase', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject special characters', () => {
    const findings = validate('VAL@UE', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DS Validator', () => {
  const validate = vrValidatorRegistry.get('DS')!;
  const tag = '(0018,0050)';

  it('should accept valid DS values', () => {
    expect(validate('1.5', tag)).toEqual([]);
    expect(validate('-3.14', tag)).toEqual([]);
    expect(validate('+42', tag)).toEqual([]);
    expect(validate('1.23e10', tag)).toEqual([]);
    expect(validate('1.23E-5', tag)).toEqual([]);
    expect(validate('0', tag)).toEqual([]);
    expect(validate(' 1.5 ', tag)).toEqual([]); // leading/trailing spaces allowed
  });

  it('should reject non-numeric values', () => {
    const findings = validate('abc', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-DS');
  });

  it('should reject values exceeding 16 characters (trimmed)', () => {
    const findings = validate('12345678901234567', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject empty decimal part with no digits', () => {
    const findings = validate('.', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('IS Validator', () => {
  const validate = vrValidatorRegistry.get('IS')!;
  const tag = '(0020,0013)';

  it('should accept valid IS values', () => {
    expect(validate('42', tag)).toEqual([]);
    expect(validate('-100', tag)).toEqual([]);
    expect(validate('+999', tag)).toEqual([]);
    expect(validate('0', tag)).toEqual([]);
    expect(validate(' 42 ', tag)).toEqual([]); // leading/trailing spaces allowed
  });

  it('should reject non-integer values', () => {
    const findings = validate('3.14', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-IS');
  });

  it('should reject values exceeding 12 characters (trimmed)', () => {
    const findings = validate('1234567890123', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject non-numeric values', () => {
    const findings = validate('abc', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('LO Validator', () => {
  const validate = vrValidatorRegistry.get('LO')!;
  const tag = '(0008,0070)';

  it('should accept valid LO values', () => {
    expect(validate('ACME Medical', tag)).toEqual([]);
    expect(validate('A'.repeat(64), tag)).toEqual([]);
  });

  it('should reject values exceeding 64 characters', () => {
    const findings = validate('A'.repeat(65), tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-LO');
  });

  it('should reject values containing backslash', () => {
    const findings = validate('path\\value', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject values with control characters', () => {
    const findings = validate('value\x01here', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('LT Validator', () => {
  const validate = vrValidatorRegistry.get('LT')!;
  const tag = '(0008,2110)';

  it('should accept valid LT values', () => {
    expect(validate('Some long text description', tag)).toEqual([]);
    expect(validate('A'.repeat(10240), tag)).toEqual([]);
  });

  it('should reject values exceeding 10240 characters', () => {
    const findings = validate('A'.repeat(10241), tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('vr-format-LT');
  });
});

describe('SH Validator', () => {
  const validate = vrValidatorRegistry.get('SH')!;
  const tag = '(0008,0050)';

  it('should accept valid SH values', () => {
    expect(validate('SHORT', tag)).toEqual([]);
    expect(validate('A'.repeat(16), tag)).toEqual([]);
  });

  it('should reject values exceeding 16 characters', () => {
    const findings = validate('A'.repeat(17), tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe('vr-format-SH');
  });

  it('should reject values containing backslash', () => {
    const findings = validate('SH\\VAL', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject values with control characters', () => {
    const findings = validate('SH\x02VAL', tag);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ST Validator', () => {
  const validate = vrValidatorRegistry.get('ST')!;
  const tag = '(0008,0081)';

  it('should accept valid ST values', () => {
    expect(validate('Some text', tag)).toEqual([]);
    expect(validate('A'.repeat(1024), tag)).toEqual([]);
  });

  it('should reject values exceeding 1024 characters', () => {
    const findings = validate('A'.repeat(1025), tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('vr-format-ST');
  });
});

describe('UC Validator', () => {
  const validate = vrValidatorRegistry.get('UC')!;
  const tag = '(0008,0120)';

  it('should accept any value (unlimited characters)', () => {
    expect(validate('anything goes here', tag)).toEqual([]);
    expect(validate('A'.repeat(10000), tag)).toEqual([]);
  });
});

describe('UR Validator', () => {
  const validate = vrValidatorRegistry.get('UR')!;
  const tag = '(0008,0120)';

  it('should accept valid UR values', () => {
    expect(validate('https://example.com/path', tag)).toEqual([]);
    expect(validate('urn:oid:1.2.3', tag)).toEqual([]);
  });

  it('should reject values with trailing spaces', () => {
    const findings = validate('https://example.com ', tag);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('vr-format-UR');
    expect(findings[0].message).toContain('trailing spaces');
  });
});

describe('UT Validator', () => {
  const validate = vrValidatorRegistry.get('UT')!;
  const tag = '(0008,0119)';

  it('should accept valid UT values', () => {
    expect(validate('Some unlimited text', tag)).toEqual([]);
    expect(validate('A'.repeat(10000), tag)).toEqual([]);
  });
});

describe('OB Validator', () => {
  const validate = vrValidatorRegistry.get('OB')!;
  const tag = '(7FE0,0010)';

  it('should return empty findings for any value (binary data)', () => {
    expect(validate('anything', tag)).toEqual([]);
    expect(validate('', tag)).toEqual([]);
  });
});

describe('OW Validator', () => {
  const validate = vrValidatorRegistry.get('OW')!;
  const tag = '(7FE0,0010)';

  it('should return empty findings for any value (binary data)', () => {
    expect(validate('anything', tag)).toEqual([]);
    expect(validate('', tag)).toEqual([]);
  });
});
