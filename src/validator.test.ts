import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validate, validateDataset } from './validator.js';
import { DicomDataset } from './types/dataset.js';
import { DictionaryLoader } from './dictionary/loader.js';
import type { DicomElement } from './types/dataset.js';
import path from 'node:path';

/**
 * Helper to create a minimal dataset with a SOP Class UID.
 */
function createMinimalDataset(sopClassUID?: string): DicomDataset {
  const elements = new Map<string, DicomElement>();

  if (sopClassUID) {
    elements.set('(0008,0016)', {
      tag: '(0008,0016)',
      vr: 'UI',
      value: sopClassUID,
    });
  }

  return new DicomDataset(elements);
}

describe('validate', () => {
  afterEach(() => {
    DictionaryLoader.resetInstance();
  });

  it('should reject with error for invalid input type', async () => {
    // @ts-expect-error Testing invalid input
    await expect(validate(12345)).rejects.toThrow(
      'Expected file path, Buffer, or ArrayBuffer'
    );
  });

  it('should reject with error for null input', async () => {
    // @ts-expect-error Testing invalid input
    await expect(validate(null)).rejects.toThrow(
      'Expected file path, Buffer, or ArrayBuffer'
    );
  });

  it('should reject with error for object input', async () => {
    // @ts-expect-error Testing invalid input
    await expect(validate({})).rejects.toThrow(
      'Expected file path, Buffer, or ArrayBuffer'
    );
  });

  it('should accept a file path string and return ValidationResult', async () => {
    const fixturePath = path.resolve(
      __dirname,
      '../tests/fixtures/minimal-ct.dcm'
    );
    const result = await validate(fixturePath);
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('should accept a Buffer and return ValidationResult', async () => {
    const fs = await import('node:fs/promises');
    const fixturePath = path.resolve(
      __dirname,
      '../tests/fixtures/minimal-ct.dcm'
    );
    const buffer = await fs.readFile(fixturePath);
    const result = await validate(buffer);
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
  });

  it('should accept an ArrayBuffer and return ValidationResult', async () => {
    const fs = await import('node:fs/promises');
    const fixturePath = path.resolve(
      __dirname,
      '../tests/fixtures/minimal-ct.dcm'
    );
    const buffer = await fs.readFile(fixturePath);
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    const result = await validate(arrayBuffer);
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
  });

  it('should reject when file does not exist', async () => {
    await expect(validate('/nonexistent/path.dcm')).rejects.toThrow();
  });
});

describe('validateDataset', () => {
  afterEach(() => {
    DictionaryLoader.resetInstance();
  });

  it('should return a ValidationResult for a minimal dataset', async () => {
    // CT Image Storage SOP Class UID
    const dataset = createMinimalDataset('1.2.840.10008.5.1.4.1.1.2');
    const result = await validateDataset(dataset);
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('should report error when SOP Class UID is missing and IOD check enabled', async () => {
    const dataset = createMinimalDataset();
    const result = await validateDataset(dataset);
    const errors = result.getFindings('error');
    expect(errors.some((f) => f.rule === 'iod-sop-class-missing')).toBe(true);
  });

  it('should skip IOD validation when checks.iod is false', async () => {
    const dataset = createMinimalDataset();
    const result = await validateDataset(dataset, { checks: { iod: false } });
    const iodFindings = result.findings.filter(
      (f) =>
        f.rule === 'iod-sop-class-missing' ||
        f.rule === 'iod-sop-class-unknown'
    );
    expect(iodFindings).toHaveLength(0);
  });

  it('should skip VR validation when checks.vr is false', async () => {
    const elements = new Map<string, DicomElement>();
    elements.set('(0008,0016)', {
      tag: '(0008,0016)',
      vr: 'UI',
      value: '1.2.840.10008.5.1.4.1.1.2',
    });
    // Add a tag with an invalid DA value to trigger VR error
    elements.set('(0008,0020)', {
      tag: '(0008,0020)',
      vr: 'DA',
      value: 'INVALID_DATE',
    });
    const dataset = new DicomDataset(elements);

    const result = await validateDataset(dataset, { checks: { vr: false } });
    const vrFindings = result.findings.filter((f) => f.rule.startsWith('vr-'));
    expect(vrFindings).toHaveLength(0);
  });

  it('should skip VM validation when checks.vm is false', async () => {
    const elements = new Map<string, DicomElement>();
    elements.set('(0008,0016)', {
      tag: '(0008,0016)',
      vr: 'UI',
      value: '1.2.840.10008.5.1.4.1.1.2',
    });
    const dataset = new DicomDataset(elements);

    const result = await validateDataset(dataset, { checks: { vm: false } });
    const vmFindings = result.findings.filter(
      (f) => f.rule === 'vm-constraint'
    );
    expect(vmFindings).toHaveLength(0);
  });

  it('should override SOP Class UID when sopClassUID option is provided', async () => {
    // Start with no SOP Class UID
    const dataset = createMinimalDataset();
    // Override with CT Image Storage
    const result = await validateDataset(dataset, {
      sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
    });
    // Should NOT have "SOP Class UID not found" error
    const sopMissing = result.findings.filter(
      (f) => f.rule === 'iod-sop-class-missing'
    );
    expect(sopMissing).toHaveLength(0);
  });

  it('should override existing SOP Class UID when sopClassUID option is provided', async () => {
    // Start with an unknown SOP Class UID
    const dataset = createMinimalDataset('9.9.9.9.9');
    // Override with CT Image Storage
    const result = await validateDataset(dataset, {
      sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
    });
    // Should NOT have "SOP Class UID not recognized" error
    const sopUnknown = result.findings.filter(
      (f) => f.rule === 'iod-sop-class-unknown'
    );
    expect(sopUnknown).toHaveLength(0);
  });

  describe('verbosity filtering', () => {
    it('should include only errors when verbosity is errors-only', async () => {
      // CT Image Storage with missing mandatory attributes will produce errors and warnings
      const dataset = createMinimalDataset('1.2.840.10008.5.1.4.1.1.2');
      const result = await validateDataset(dataset, {
        verbosity: 'errors-only',
      });
      for (const finding of result.findings) {
        expect(finding.severity).toBe('error');
      }
    });

    it('should include errors and warnings when verbosity is normal', async () => {
      const dataset = createMinimalDataset('1.2.840.10008.5.1.4.1.1.2');
      const result = await validateDataset(dataset, { verbosity: 'normal' });
      for (const finding of result.findings) {
        expect(['error', 'warning']).toContain(finding.severity);
      }
    });

    it('should include all findings when verbosity is verbose', async () => {
      const dataset = createMinimalDataset('1.2.840.10008.5.1.4.1.1.2');
      const result = await validateDataset(dataset, { verbosity: 'verbose' });
      // verbose includes info findings too - just verify it returns a result
      expect(result).toBeDefined();
      expect(result.findings).toBeDefined();
    });

    it('should default to normal verbosity (no info findings)', async () => {
      const dataset = createMinimalDataset('1.2.840.10008.5.1.4.1.1.2');
      const result = await validateDataset(dataset);
      for (const finding of result.findings) {
        expect(['error', 'warning']).toContain(finding.severity);
      }
    });
  });

  describe('default options', () => {
    it('should enable all checks by default', async () => {
      const dataset = createMinimalDataset();
      const result = await validateDataset(dataset);
      // IOD check should be active - missing SOP Class UID should produce error
      const errors = result.getFindings('error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should apply partial options without affecting defaults', async () => {
      const dataset = createMinimalDataset();
      // Only specify verbosity, checks should still default to all enabled
      const result = await validateDataset(dataset, {
        verbosity: 'errors-only',
      });
      const errors = result.getFindings('error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
