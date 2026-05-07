import { describe, it, expect } from 'vitest';
import { TagValidator } from './tag-validator.js';
import { TagDictionary } from '../dictionary/tag-dictionary.js';
import { DicomDataset } from '../types/dataset.js';
import type { DicomElement } from '../types/dataset.js';
import type { TagDefinition } from '../types/dicom-tag.js';

describe('TagValidator', () => {
  const validator = new TagValidator();

  describe('validateVR', () => {
    it('should return no findings for a valid DA value', () => {
      const findings = validator.validateVR('(0008,0020)', '20230115', 'DA');
      expect(findings).toHaveLength(0);
    });

    it('should return error findings for an invalid DA value', () => {
      const findings = validator.validateVR('(0008,0020)', 'not-a-date', 'DA');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0008,0020)');
    });

    it('should return warning for unknown VR', () => {
      const findings = validator.validateVR('(0008,0020)', 'somevalue', 'ZZ');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].rule).toBe('vr-unknown');
      expect(findings[0].message).toContain('ZZ');
    });

    it('should validate UI values correctly', () => {
      const findings = validator.validateVR('(0008,0016)', '1.2.840.10008.1.1', 'UI');
      expect(findings).toHaveLength(0);
    });

    it('should return error for invalid UI value', () => {
      const findings = validator.validateVR('(0008,0016)', '1.2..3', 'UI');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('error');
    });
  });

  describe('validateVM', () => {
    it('should return no findings when value count satisfies fixed VM', () => {
      const findings = validator.validateVM('(0020,0013)', '42', '1');
      expect(findings).toHaveLength(0);
    });

    it('should return error when value count violates fixed VM', () => {
      const findings = validator.validateVM('(0020,0013)', '1\\2\\3', '1');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('vm-constraint');
      expect(findings[0].message).toContain('3');
    });

    it('should return no findings for value count within range', () => {
      const findings = validator.validateVM('(0020,0032)', '1\\2\\3', '1-3');
      expect(findings).toHaveLength(0);
    });

    it('should return error for value count exceeding range', () => {
      const findings = validator.validateVM('(0020,0032)', '1\\2\\3\\4', '1-3');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
    });

    it('should return no findings for unbounded VM with sufficient values', () => {
      const findings = validator.validateVM('(0008,0008)', '1\\2\\3\\4\\5', '1-n');
      expect(findings).toHaveLength(0);
    });

    it('should return error for unbounded VM with too few values', () => {
      // VM "2-n" requires at least 2 values
      const findings = validator.validateVM('(0008,0008)', 'single', '2-n');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
    });

    it('should handle multiplier notation correctly', () => {
      // VM "2-2n" requires multiples of 2
      const findings = validator.validateVM('(0020,0037)', '1\\2\\3\\4', '2-2n');
      expect(findings).toHaveLength(0);
    });

    it('should return error for non-multiple in multiplier notation', () => {
      // VM "2-2n" requires multiples of 2, 3 is not valid
      const findings = validator.validateVM('(0020,0037)', '1\\2\\3', '2-2n');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
    });
  });

  describe('validateAllTags', () => {
    function makeDictionary(defs: TagDefinition[]): TagDictionary {
      return new TagDictionary(defs);
    }

    function makeDataset(elements: DicomElement[]): DicomDataset {
      const map = new Map<string, DicomElement>();
      for (const el of elements) {
        map.set(el.tag, el);
      }
      return new DicomDataset(map);
    }

    it('should skip private tags and add info finding', () => {
      const dictionary = makeDictionary([]);
      const dataset = makeDataset([
        { tag: '(0009,0010)', vr: 'LO', value: 'PRIVATE_CREATOR' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].rule).toBe('private-tag-skipped');
      expect(findings[0].tag).toBe('(0009,0010)');
    });

    it('should skip empty values without findings', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: 'DA', value: '' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      expect(findings).toHaveLength(0);
    });

    it('should skip null values without findings', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: 'DA', value: null },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      expect(findings).toHaveLength(0);
    });

    it('should skip unknown tags (not in dictionary)', () => {
      const dictionary = makeDictionary([]);
      const dataset = makeDataset([
        { tag: '(0008,9999)', vr: 'LO', value: 'unknown' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      expect(findings).toHaveLength(0);
    });

    it('should add info finding for retired tags and still validate', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0041)', name: 'Data Set Subtype', keyword: 'DataSetSubtype', vr: 'LO', vm: '1', retired: true },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0041)', vr: 'LO', value: 'VALID' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      // Should have info about retired tag
      const infoFindings = findings.filter(f => f.severity === 'info');
      expect(infoFindings).toHaveLength(1);
      expect(infoFindings[0].rule).toBe('retired-tag');
      expect(infoFindings[0].message).toContain('retired');
    });

    it('should validate VR and VM for known tags', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: 'DA', value: 'not-a-date' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      const errors = findings.filter(f => f.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should add warning when VR cannot be determined', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: '', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: '', value: 'somevalue' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      const warnings = findings.filter(f => f.severity === 'warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0].rule).toBe('vr-undetermined');
    });

    it('should use element VR when available over dictionary VR', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: 'DA', value: '20230115' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      // Valid date, should have no errors
      const errors = findings.filter(f => f.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should validate VM constraint from dictionary', () => {
      const dictionary = makeDictionary([
        { tag: '(0020,0032)', name: 'Image Position', keyword: 'ImagePositionPatient', vr: 'DS', vm: '3', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0020,0032)', vr: 'DS', value: '1.0\\2.0' }, // Only 2 values, needs 3
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      const vmErrors = findings.filter(f => f.rule === 'vm-constraint');
      expect(vmErrors).toHaveLength(1);
      expect(vmErrors[0].severity).toBe('error');
    });

    it('should handle rawValue for VR validation', () => {
      const dictionary = makeDictionary([
        { tag: '(0008,0020)', name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0008,0020)', vr: 'DA', value: '20230115', rawValue: '20230115' },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      const errors = findings.filter(f => f.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('should handle array values by joining with backslash', () => {
      const dictionary = makeDictionary([
        { tag: '(0020,0032)', name: 'Image Position', keyword: 'ImagePositionPatient', vr: 'DS', vm: '3', retired: false },
      ]);
      const dataset = makeDataset([
        { tag: '(0020,0032)', vr: 'DS', value: ['1.0', '2.0', '3.0'] },
      ]);

      const findings = validator.validateAllTags(dataset, dictionary);
      const vmErrors = findings.filter(f => f.rule === 'vm-constraint');
      expect(vmErrors).toHaveLength(0);
    });
  });
});
