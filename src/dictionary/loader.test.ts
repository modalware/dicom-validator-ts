import { describe, it, expect, beforeEach } from 'vitest';
import { DictionaryLoader } from './loader.js';

describe('DictionaryLoader', () => {
  beforeEach(() => {
    DictionaryLoader.resetInstance();
  });

  it('returns the same instance on repeated calls', () => {
    const a = DictionaryLoader.getInstance();
    const b = DictionaryLoader.getInstance();
    expect(a).toBe(b);
  });

  it('returns a fresh instance after reset', () => {
    const a = DictionaryLoader.getInstance();
    DictionaryLoader.resetInstance();
    const b = DictionaryLoader.getInstance();
    expect(a).not.toBe(b);
  });

  describe('getTagDictionary', () => {
    it('returns a TagDictionary with loaded tags', () => {
      const loader = DictionaryLoader.getInstance();
      const dict = loader.getTagDictionary();
      expect(dict.size).toBeGreaterThan(0);
    });

    it('caches the TagDictionary on subsequent calls', () => {
      const loader = DictionaryLoader.getInstance();
      const a = loader.getTagDictionary();
      const b = loader.getTagDictionary();
      expect(a).toBe(b);
    });

    it('can look up a known tag', () => {
      const loader = DictionaryLoader.getInstance();
      const dict = loader.getTagDictionary();
      const tag = dict.getTag('(0008,0016)');
      expect(tag).toBeDefined();
      expect(tag!.keyword).toBe('SOPClassUID');
    });
  });

  describe('getIODRegistry', () => {
    it('returns an IODRegistry with loaded IODs', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getIODRegistry();
      // CT Image Storage
      const ctIOD = registry.getIOD('1.2.840.10008.5.1.4.1.1.2');
      expect(ctIOD).toBeDefined();
      expect(ctIOD!.sopClassName).toBe('CT Image Storage');
    });

    it('caches the IODRegistry on subsequent calls', () => {
      const loader = DictionaryLoader.getInstance();
      const a = loader.getIODRegistry();
      const b = loader.getIODRegistry();
      expect(a).toBe(b);
    });

    it('returns undefined for unknown SOP Class UID', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getIODRegistry();
      expect(registry.getIOD('9.9.9.9.9')).toBeUndefined();
    });

    it('includes MR Image Storage', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getIODRegistry();
      const mrIOD = registry.getIOD('1.2.840.10008.5.1.4.1.1.4');
      expect(mrIOD).toBeDefined();
      expect(mrIOD!.sopClassName).toBe('MR Image Storage');
    });
  });

  describe('getModuleRegistry', () => {
    it('returns a ModuleRegistry with loaded modules', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getModuleRegistry();
      const patient = registry.getModule('patient');
      expect(patient).toBeDefined();
      expect(patient!.moduleName).toBe('Patient');
    });

    it('caches the ModuleRegistry on subsequent calls', () => {
      const loader = DictionaryLoader.getInstance();
      const a = loader.getModuleRegistry();
      const b = loader.getModuleRegistry();
      expect(a).toBe(b);
    });

    it('returns undefined for unknown module ID', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getModuleRegistry();
      expect(registry.getModule('nonexistent')).toBeUndefined();
    });

    it('loads general-study module', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getModuleRegistry();
      const mod = registry.getModule('general-study');
      expect(mod).toBeDefined();
      expect(mod!.attributes.length).toBeGreaterThan(0);
    });

    it('loads general-series module', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getModuleRegistry();
      const mod = registry.getModule('general-series');
      expect(mod).toBeDefined();
      expect(mod!.attributes.some((a) => a.tag === '(0008,0060)')).toBe(true);
    });

    it('loads ct-image module with pre-parsed conditions', () => {
      const loader = DictionaryLoader.getInstance();
      const registry = loader.getModuleRegistry();
      const mod = registry.getModule('ct-image');
      expect(mod).toBeDefined();

      // Window Center has a condition referencing Window Width
      const windowCenter = mod!.attributes.find(
        (a) => a.tag === '(0028,1050)'
      );
      expect(windowCenter).toBeDefined();
      expect(windowCenter!.type).toBe('1C');
      expect(windowCenter!.condition).toBeDefined();
      expect(windowCenter!.condition!.type).toBe('tag_present');
      if (windowCenter!.condition!.type === 'tag_present') {
        expect(windowCenter!.condition!.tag).toBe('(0028,1051)');
      }
    });
  });
});
