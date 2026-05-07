import { describe, it, expect } from 'vitest';
import { IODRegistry, type IODDefinition } from './iod-registry.js';

describe('IODRegistry', () => {
  const sampleDefinitions: IODDefinition[] = [
    {
      sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
      sopClassName: 'CT Image Storage',
      modules: [
        { moduleId: 'patient', moduleName: 'Patient', usage: 'M' },
        { moduleId: 'general-study', moduleName: 'General Study', usage: 'M' },
        {
          moduleId: 'contrast-bolus',
          moduleName: 'Contrast/Bolus',
          usage: 'C',
          condition: { type: 'tag_present', tag: '(0018,0010)' },
        },
        { moduleId: 'clinical-trial-subject', moduleName: 'Clinical Trial Subject', usage: 'U' },
      ],
    },
    {
      sopClassUID: '1.2.840.10008.5.1.4.1.1.4',
      sopClassName: 'MR Image Storage',
      modules: [
        { moduleId: 'patient', moduleName: 'Patient', usage: 'M' },
        { moduleId: 'general-study', moduleName: 'General Study', usage: 'M' },
        { moduleId: 'mr-image', moduleName: 'MR Image', usage: 'M' },
      ],
    },
  ];

  it('should return IOD definition for a known SOP Class UID', () => {
    const registry = new IODRegistry(sampleDefinitions);
    const iod = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');

    expect(iod).toBeDefined();
    expect(iod!.sopClassName).toBe('CT Image Storage');
    expect(iod!.modules).toHaveLength(4);
  });

  it('should return undefined for an unknown SOP Class UID', () => {
    const registry = new IODRegistry(sampleDefinitions);
    const iod = registry.getIOD('1.2.840.99999.99.99');

    expect(iod).toBeUndefined();
  });

  it('should index multiple IOD definitions', () => {
    const registry = new IODRegistry(sampleDefinitions);

    const ct = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');
    const mr = registry.getIOD('1.2.840.10008.5.1.4.1.1.4');

    expect(ct).toBeDefined();
    expect(mr).toBeDefined();
    expect(ct!.sopClassName).toBe('CT Image Storage');
    expect(mr!.sopClassName).toBe('MR Image Storage');
  });

  it('should preserve module details including conditions', () => {
    const registry = new IODRegistry(sampleDefinitions);
    const iod = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');

    const conditionalModule = iod!.modules.find((m) => m.usage === 'C');
    expect(conditionalModule).toBeDefined();
    expect(conditionalModule!.moduleId).toBe('contrast-bolus');
    expect(conditionalModule!.condition).toEqual({ type: 'tag_present', tag: '(0018,0010)' });
  });

  it('should handle an empty definitions array', () => {
    const registry = new IODRegistry([]);
    const iod = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');

    expect(iod).toBeUndefined();
  });

  it('should use the last definition when duplicate SOP Class UIDs are provided', () => {
    const duplicates: IODDefinition[] = [
      {
        sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
        sopClassName: 'CT Image Storage (old)',
        modules: [],
      },
      {
        sopClassUID: '1.2.840.10008.5.1.4.1.1.2',
        sopClassName: 'CT Image Storage (new)',
        modules: [{ moduleId: 'patient', moduleName: 'Patient', usage: 'M' }],
      },
    ];

    const registry = new IODRegistry(duplicates);
    const iod = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');

    expect(iod!.sopClassName).toBe('CT Image Storage (new)');
    expect(iod!.modules).toHaveLength(1);
  });
});
