import { describe, it, expect } from 'vitest';
import { ModuleRegistry, type ModuleDefinition } from './module-registry.js';

describe('ModuleRegistry', () => {
  const sampleModules: ModuleDefinition[] = [
    {
      moduleId: 'patient',
      moduleName: 'Patient Module',
      attributes: [
        { tag: '(0010,0010)', name: "Patient's Name", type: '2' },
        { tag: '(0010,0020)', name: 'Patient ID', type: '2' },
        { tag: '(0010,0030)', name: "Patient's Birth Date", type: '2' },
        { tag: '(0010,0040)', name: "Patient's Sex", type: '2' },
      ],
    },
    {
      moduleId: 'general-study',
      moduleName: 'General Study Module',
      attributes: [
        { tag: '(0008,0020)', name: 'Study Date', type: '2' },
        { tag: '(0008,0030)', name: 'Study Time', type: '2' },
        { tag: '(0008,0050)', name: 'Accession Number', type: '2' },
        { tag: '(0020,000D)', name: 'Study Instance UID', type: '1' },
      ],
    },
    {
      moduleId: 'ct-image',
      moduleName: 'CT Image Module',
      attributes: [
        { tag: '(0018,0050)', name: 'Slice Thickness', type: '2' },
        {
          tag: '(0018,0088)',
          name: 'Spacing Between Slices',
          type: '1C',
          condition: { type: 'tag_present', tag: '(0020,0013)' },
        },
      ],
    },
  ];

  it('should return a module definition by its ID', () => {
    const registry = new ModuleRegistry(sampleModules);
    const result = registry.getModule('patient');

    expect(result).toBeDefined();
    expect(result!.moduleId).toBe('patient');
    expect(result!.moduleName).toBe('Patient Module');
    expect(result!.attributes).toHaveLength(4);
  });

  it('should return undefined for an unknown module ID', () => {
    const registry = new ModuleRegistry(sampleModules);
    const result = registry.getModule('nonexistent-module');

    expect(result).toBeUndefined();
  });

  it('should index all provided modules for O(1) lookup', () => {
    const registry = new ModuleRegistry(sampleModules);

    expect(registry.getModule('patient')).toBeDefined();
    expect(registry.getModule('general-study')).toBeDefined();
    expect(registry.getModule('ct-image')).toBeDefined();
  });

  it('should preserve module attributes including conditions', () => {
    const registry = new ModuleRegistry(sampleModules);
    const ctModule = registry.getModule('ct-image');

    expect(ctModule).toBeDefined();
    expect(ctModule!.attributes).toHaveLength(2);

    const conditionalAttr = ctModule!.attributes[1];
    expect(conditionalAttr.type).toBe('1C');
    expect(conditionalAttr.condition).toEqual({
      type: 'tag_present',
      tag: '(0020,0013)',
    });
  });

  it('should handle an empty module data array', () => {
    const registry = new ModuleRegistry([]);
    const result = registry.getModule('patient');

    expect(result).toBeUndefined();
  });

  it('should handle modules with no attributes', () => {
    const emptyModule: ModuleDefinition = {
      moduleId: 'empty-module',
      moduleName: 'Empty Module',
      attributes: [],
    };
    const registry = new ModuleRegistry([emptyModule]);
    const result = registry.getModule('empty-module');

    expect(result).toBeDefined();
    expect(result!.attributes).toHaveLength(0);
  });

  it('should use the last definition when duplicate module IDs are provided', () => {
    const duplicateModules: ModuleDefinition[] = [
      {
        moduleId: 'duplicate',
        moduleName: 'First',
        attributes: [{ tag: '(0010,0010)', name: 'First Attr', type: '1' }],
      },
      {
        moduleId: 'duplicate',
        moduleName: 'Second',
        attributes: [{ tag: '(0010,0020)', name: 'Second Attr', type: '2' }],
      },
    ];
    const registry = new ModuleRegistry(duplicateModules);
    const result = registry.getModule('duplicate');

    expect(result).toBeDefined();
    expect(result!.moduleName).toBe('Second');
  });
});
