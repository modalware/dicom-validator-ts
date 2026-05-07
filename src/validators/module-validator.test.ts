import { describe, it, expect } from 'vitest';
import { ModuleValidator } from './module-validator.js';
import { ConditionEvaluator } from '../condition/evaluator.js';
import { DicomDataset } from '../types/dataset.js';
import type { ModuleDefinition, ModuleAttribute } from '../dictionary/module-registry.js';
import type { DicomElement } from '../types/dataset.js';

function makeDataset(elements: Record<string, Partial<DicomElement>>): DicomDataset {
  const map = new Map<string, DicomElement>();
  for (const [tag, partial] of Object.entries(elements)) {
    map.set(tag, {
      tag,
      vr: partial.vr ?? 'LO',
      value: partial.value !== undefined ? partial.value : 'test',
      rawValue: partial.rawValue,
    });
  }
  return new DicomDataset(map);
}

function makeModuleDef(attributes: ModuleAttribute[]): ModuleDefinition {
  return {
    moduleId: 'test-module',
    moduleName: 'Test Module',
    attributes,
  };
}

describe('ModuleValidator', () => {
  const validator = new ModuleValidator();
  const conditionEvaluator = new ConditionEvaluator();

  describe('Type 1 attributes', () => {
    const attr: ModuleAttribute = {
      tag: '(0010,0010)',
      name: 'Patient Name',
      type: '1',
    };

    it('should produce error when Type 1 attribute is missing', () => {
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0010,0010)');
      expect(findings[0].module).toBe('Test Module');
      expect(findings[0].rule).toBe('type1-missing');
      expect(findings[0].message).toContain('Missing required attribute');
    });

    it('should produce error when Type 1 attribute is present but empty (null)', () => {
      const dataset = makeDataset({
        '(0010,0010)': { value: null },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-empty');
      expect(findings[0].message).toContain('must not be empty');
    });

    it('should produce error when Type 1 attribute is present but empty string', () => {
      const dataset = makeDataset({
        '(0010,0010)': { value: '' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-empty');
    });

    it('should produce error when Type 1 attribute is present but empty array', () => {
      const dataset = makeDataset({
        '(0010,0010)': { value: [] as string[] },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-empty');
    });

    it('should produce no findings when Type 1 attribute is present with value', () => {
      const dataset = makeDataset({
        '(0010,0010)': { value: 'Doe^John' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when Type 1 attribute has numeric value', () => {
      const dataset = makeDataset({
        '(0010,0010)': { value: 42 },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Type 2 attributes', () => {
    const attr: ModuleAttribute = {
      tag: '(0010,0020)',
      name: 'Patient ID',
      type: '2',
    };

    it('should produce warning when Type 2 attribute is missing', () => {
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].tag).toBe('(0010,0020)');
      expect(findings[0].module).toBe('Test Module');
      expect(findings[0].rule).toBe('type2-missing');
      expect(findings[0].message).toContain('Missing required-but-empty-allowed attribute');
    });

    it('should produce no findings when Type 2 attribute is present but empty', () => {
      const dataset = makeDataset({
        '(0010,0020)': { value: '' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when Type 2 attribute is present with null value', () => {
      const dataset = makeDataset({
        '(0010,0020)': { value: null },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when Type 2 attribute is present with value', () => {
      const dataset = makeDataset({
        '(0010,0020)': { value: 'PAT001' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Type 3 attributes', () => {
    const attr: ModuleAttribute = {
      tag: '(0010,1010)',
      name: 'Patient Age',
      type: '3',
    };

    it('should produce no findings when Type 3 attribute is missing', () => {
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when Type 3 attribute is present', () => {
      const dataset = makeDataset({
        '(0010,1010)': { value: '045Y' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });
  });

  describe('Type 1C attributes', () => {
    const attr: ModuleAttribute = {
      tag: '(0028,0010)',
      name: 'Rows',
      type: '1C',
      condition: {
        type: 'tag_present',
        tag: '(7FE0,0010)',
      },
    };

    it('should produce error when condition is true and attribute is missing', () => {
      const dataset = makeDataset({
        '(7FE0,0010)': { value: 'pixel data', vr: 'OW' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-missing');
    });

    it('should produce error when condition is true and attribute is empty', () => {
      const dataset = makeDataset({
        '(7FE0,0010)': { value: 'pixel data', vr: 'OW' },
        '(0028,0010)': { value: null },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-empty');
    });

    it('should produce no findings when condition is true and attribute is present with value', () => {
      const dataset = makeDataset({
        '(7FE0,0010)': { value: 'pixel data', vr: 'OW' },
        '(0028,0010)': { value: 512 },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when condition is false', () => {
      // Condition: tag_present (7FE0,0010) — tag is absent, so condition is false
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce info finding when condition is indeterminate', () => {
      const attrWithValueCondition: ModuleAttribute = {
        tag: '(0028,0010)',
        name: 'Rows',
        type: '1C',
        condition: {
          type: 'tag_equals',
          tag: '(0008,0060)',
          value: 'CT',
        },
      };
      // Tag (0008,0060) is not present → indeterminate
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attrWithValueCondition]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].rule).toBe('condition-indeterminate');
    });

    it('should produce info finding when Type 1C has no condition defined', () => {
      const attrNoCondition: ModuleAttribute = {
        tag: '(0028,0010)',
        name: 'Rows',
        type: '1C',
        // no condition
      };
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attrNoCondition]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].rule).toBe('condition-indeterminate');
    });
  });

  describe('Type 2C attributes', () => {
    const attr: ModuleAttribute = {
      tag: '(0008,0050)',
      name: 'Accession Number',
      type: '2C',
      condition: {
        type: 'tag_present',
        tag: '(0008,0020)',
      },
    };

    it('should produce warning when condition is true and attribute is missing', () => {
      const dataset = makeDataset({
        '(0008,0020)': { value: '20230101', vr: 'DA' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].rule).toBe('type2-missing');
    });

    it('should produce no findings when condition is true and attribute is present but empty', () => {
      const dataset = makeDataset({
        '(0008,0020)': { value: '20230101', vr: 'DA' },
        '(0008,0050)': { value: '' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when condition is true and attribute is present with value', () => {
      const dataset = makeDataset({
        '(0008,0020)': { value: '20230101', vr: 'DA' },
        '(0008,0050)': { value: 'ACC123' },
      });
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce no findings when condition is false', () => {
      // Condition: tag_present (0008,0020) — tag is absent, so condition is false
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce info finding when condition is indeterminate', () => {
      const attrWithValueCondition: ModuleAttribute = {
        tag: '(0008,0050)',
        name: 'Accession Number',
        type: '2C',
        condition: {
          type: 'tag_equals',
          tag: '(0008,0060)',
          value: 'MR',
        },
      };
      // Tag (0008,0060) is not present → indeterminate
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attrWithValueCondition]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].rule).toBe('condition-indeterminate');
    });

    it('should produce info finding when Type 2C has no condition defined', () => {
      const attrNoCondition: ModuleAttribute = {
        tag: '(0008,0050)',
        name: 'Accession Number',
        type: '2C',
        // no condition
      };
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([attrNoCondition]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].rule).toBe('condition-indeterminate');
    });
  });

  describe('Multiple attributes in a module', () => {
    it('should validate all attributes and collect findings', () => {
      const attrs: ModuleAttribute[] = [
        { tag: '(0010,0010)', name: 'Patient Name', type: '1' },
        { tag: '(0010,0020)', name: 'Patient ID', type: '2' },
        { tag: '(0010,1010)', name: 'Patient Age', type: '3' },
      ];
      // All missing
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef(attrs);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      // Type 1 missing → error, Type 2 missing → warning, Type 3 missing → nothing
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0010,0010)');
      expect(findings[1].severity).toBe('warning');
      expect(findings[1].tag).toBe('(0010,0020)');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty module (no attributes)', () => {
      const dataset = makeDataset({});
      const moduleDef = makeModuleDef([]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should handle Type 1 attribute with Buffer value (non-empty)', () => {
      const map = new Map<string, DicomElement>();
      map.set('(7FE0,0010)', {
        tag: '(7FE0,0010)',
        vr: 'OW',
        value: Buffer.from([0x01, 0x02]),
      });
      const dataset = new DicomDataset(map);
      const attr: ModuleAttribute = {
        tag: '(7FE0,0010)',
        name: 'Pixel Data',
        type: '1',
      };
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should handle Type 1 attribute with empty Buffer', () => {
      const map = new Map<string, DicomElement>();
      map.set('(7FE0,0010)', {
        tag: '(7FE0,0010)',
        vr: 'OW',
        value: Buffer.alloc(0),
      });
      const dataset = new DicomDataset(map);
      const attr: ModuleAttribute = {
        tag: '(7FE0,0010)',
        name: 'Pixel Data',
        type: '1',
      };
      const moduleDef = makeModuleDef([attr]);

      const findings = validator.validateModule(dataset, moduleDef, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('type1-empty');
    });
  });
});
