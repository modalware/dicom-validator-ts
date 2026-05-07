import { describe, it, expect } from 'vitest';
import { IODValidator } from './iod-validator.js';
import { IODRegistry } from '../dictionary/iod-registry.js';
import { ModuleRegistry } from '../dictionary/module-registry.js';
import { ConditionEvaluator } from '../condition/evaluator.js';
import { DicomDataset } from '../types/dataset.js';
import type { IODDefinition, IODModuleRef } from '../dictionary/iod-registry.js';
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

const CT_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.2';

function makeIODRegistry(definitions: IODDefinition[]): IODRegistry {
  return new IODRegistry(definitions);
}

function makeModuleRegistry(modules: ModuleDefinition[]): ModuleRegistry {
  return new ModuleRegistry(modules);
}

describe('IODValidator', () => {
  const validator = new IODValidator();
  const conditionEvaluator = new ConditionEvaluator();

  describe('SOP Class UID handling', () => {
    it('should return error when SOP Class UID is not present', () => {
      const dataset = makeDataset({});
      const iodRegistry = makeIODRegistry([]);
      const moduleRegistry = makeModuleRegistry([]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0008,0016)');
      expect(findings[0].message).toBe('SOP Class UID not found');
      expect(findings[0].rule).toBe('iod-sop-class-missing');
    });

    it('should return error when SOP Class UID is not recognized', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: '1.2.3.4.5.6.7.8.9', vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([]);
      const moduleRegistry = makeModuleRegistry([]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0008,0016)');
      expect(findings[0].message).toContain('SOP Class UID not recognized');
      expect(findings[0].message).toContain('1.2.3.4.5.6.7.8.9');
      expect(findings[0].rule).toBe('iod-sop-class-unknown');
    });

    it('should return error when SOP Class UID tag has null value', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: null, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([]);
      const moduleRegistry = makeModuleRegistry([]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].rule).toBe('iod-sop-class-missing');
    });
  });

  describe('Mandatory module validation', () => {
    const patientModule: ModuleDefinition = {
      moduleId: 'patient',
      moduleName: 'Patient',
      attributes: [
        { tag: '(0010,0010)', name: 'Patient Name', type: '1' },
        { tag: '(0010,0020)', name: 'Patient ID', type: '2' },
      ],
    };

    const iodDef: IODDefinition = {
      sopClassUID: CT_SOP_CLASS_UID,
      sopClassName: 'CT Image Storage',
      modules: [
        { moduleId: 'patient', moduleName: 'Patient', usage: 'M' },
      ],
    };

    it('should validate Mandatory modules and report missing Type 1 attributes', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([patientModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      // Type 1 missing → error, Type 2 missing → warning
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0010,0010)');
      expect(findings[0].module).toBe('Patient');
      expect(findings[1].severity).toBe('warning');
      expect(findings[1].tag).toBe('(0010,0020)');
    });

    it('should produce no findings when all Mandatory module attributes are present', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
        '(0010,0010)': { value: 'Doe^John', vr: 'PN' },
        '(0010,0020)': { value: 'PAT001', vr: 'LO' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([patientModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce warning when module definition is not found', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([]); // No modules registered

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].module).toBe('Patient');
      expect(findings[0].message).toContain('Module definition not found');
      expect(findings[0].rule).toBe('iod-module-not-found');
    });
  });

  describe('Conditional module validation', () => {
    const contrastModule: ModuleDefinition = {
      moduleId: 'contrast-bolus',
      moduleName: 'Contrast/Bolus',
      attributes: [
        { tag: '(0018,0010)', name: 'Contrast/Bolus Agent', type: '1' },
      ],
    };

    it('should validate Conditional module when condition is true', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          {
            moduleId: 'contrast-bolus',
            moduleName: 'Contrast/Bolus',
            usage: 'C',
            condition: { type: 'tag_present', tag: '(0018,0010)' },
          },
        ],
      };

      // Condition tag is present → condition true → validate module
      // But the attribute itself is present, so no error
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
        '(0018,0010)': { value: 'Iodine', vr: 'LO' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([contrastModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should report errors for Conditional module when condition is true and attributes missing', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          {
            moduleId: 'contrast-bolus',
            moduleName: 'Contrast/Bolus',
            usage: 'C',
            condition: { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          },
        ],
      };

      // Modality is CT → condition true → validate module → attribute missing → error
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
        '(0008,0060)': { value: 'CT', vr: 'CS' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([contrastModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0018,0010)');
      expect(findings[0].module).toBe('Contrast/Bolus');
      expect(findings[0].rule).toBe('type1-missing');
    });

    it('should skip Conditional module when condition is false', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          {
            moduleId: 'contrast-bolus',
            moduleName: 'Contrast/Bolus',
            usage: 'C',
            condition: { type: 'tag_equals', tag: '(0008,0060)', value: 'MR' },
          },
        ],
      };

      // Modality is CT, condition expects MR → false → skip
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
        '(0008,0060)': { value: 'CT', vr: 'CS' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([contrastModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should produce info finding when Conditional module condition is indeterminate', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          {
            moduleId: 'contrast-bolus',
            moduleName: 'Contrast/Bolus',
            usage: 'C',
            condition: { type: 'tag_equals', tag: '(0008,0060)', value: 'CT' },
          },
        ],
      };

      // Tag (0008,0060) not present → indeterminate
      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([contrastModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].module).toBe('Contrast/Bolus');
      expect(findings[0].rule).toBe('iod-module-condition-indeterminate');
    });

    it('should produce info finding when Conditional module has no condition defined', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          {
            moduleId: 'contrast-bolus',
            moduleName: 'Contrast/Bolus',
            usage: 'C',
            // no condition
          },
        ],
      };

      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([contrastModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].module).toBe('Contrast/Bolus');
      expect(findings[0].rule).toBe('iod-module-condition-indeterminate');
    });
  });

  describe('User Optional module handling', () => {
    it('should skip User Optional modules entirely', () => {
      const optionalModule: ModuleDefinition = {
        moduleId: 'clinical-trial',
        moduleName: 'Clinical Trial Subject',
        attributes: [
          { tag: '(0012,0010)', name: 'Clinical Trial Sponsor Name', type: '1' },
        ],
      };

      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          { moduleId: 'clinical-trial', moduleName: 'Clinical Trial Subject', usage: 'U' },
        ],
      };

      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([optionalModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      // No findings — U modules are skipped
      expect(findings).toHaveLength(0);
    });
  });

  describe('Multiple modules in IOD', () => {
    it('should validate all modules and collect findings from each', () => {
      const patientModule: ModuleDefinition = {
        moduleId: 'patient',
        moduleName: 'Patient',
        attributes: [
          { tag: '(0010,0010)', name: 'Patient Name', type: '1' },
        ],
      };

      const studyModule: ModuleDefinition = {
        moduleId: 'general-study',
        moduleName: 'General Study',
        attributes: [
          { tag: '(0008,0020)', name: 'Study Date', type: '2' },
        ],
      };

      const optionalModule: ModuleDefinition = {
        moduleId: 'clinical-trial',
        moduleName: 'Clinical Trial Subject',
        attributes: [
          { tag: '(0012,0010)', name: 'Clinical Trial Sponsor Name', type: '1' },
        ],
      };

      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [
          { moduleId: 'patient', moduleName: 'Patient', usage: 'M' },
          { moduleId: 'general-study', moduleName: 'General Study', usage: 'M' },
          { moduleId: 'clinical-trial', moduleName: 'Clinical Trial Subject', usage: 'U' },
        ],
      };

      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([patientModule, studyModule, optionalModule]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      // Patient Name (Type 1) missing → error
      // Study Date (Type 2) missing → warning
      // Clinical Trial (U) → skipped
      expect(findings).toHaveLength(2);
      expect(findings[0].severity).toBe('error');
      expect(findings[0].tag).toBe('(0010,0010)');
      expect(findings[0].module).toBe('Patient');
      expect(findings[1].severity).toBe('warning');
      expect(findings[1].tag).toBe('(0008,0020)');
      expect(findings[1].module).toBe('General Study');
    });
  });

  describe('Edge cases', () => {
    it('should handle IOD with no modules', () => {
      const iodDef: IODDefinition = {
        sopClassUID: CT_SOP_CLASS_UID,
        sopClassName: 'CT Image Storage',
        modules: [],
      };

      const dataset = makeDataset({
        '(0008,0016)': { value: CT_SOP_CLASS_UID, vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([iodDef]);
      const moduleRegistry = makeModuleRegistry([]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      expect(findings).toHaveLength(0);
    });

    it('should handle empty string SOP Class UID as missing', () => {
      const dataset = makeDataset({
        '(0008,0016)': { value: '', vr: 'UI' },
      });
      const iodRegistry = makeIODRegistry([]);
      const moduleRegistry = makeModuleRegistry([]);

      const findings = validator.validate(dataset, iodRegistry, moduleRegistry, conditionEvaluator);

      // Empty string from getString returns '' which is falsy → treated as missing
      // Actually, '' is falsy in JS, so it should trigger the "not found" path
      expect(findings).toHaveLength(1);
      expect(findings[0].rule).toBe('iod-sop-class-missing');
    });
  });
});
