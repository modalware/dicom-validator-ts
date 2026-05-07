import { describe, it, expect } from 'vitest';
import { TagDictionary } from './tag-dictionary.js';
import type { TagDefinition } from '../types/dicom-tag.js';

describe('TagDictionary', () => {
  const sampleTags: TagDefinition[] = [
    { tag: '(0008,0016)', name: 'SOP Class UID', keyword: 'SOPClassUID', vr: 'UI', vm: '1', retired: false },
    { tag: '(0010,0010)', name: "Patient's Name", keyword: 'PatientName', vr: 'PN', vm: '1', retired: false },
    { tag: '(0020,0032)', name: 'Image Position (Patient)', keyword: 'ImagePositionPatient', vr: 'DS', vm: '3', retired: false },
    { tag: '(0008,0040)', name: 'Data Set Type', keyword: 'DataSetType', vr: 'US', vm: '1', retired: true },
  ];

  describe('constructor', () => {
    it('should create a dictionary from an array of tag definitions', () => {
      const dict = new TagDictionary(sampleTags);
      expect(dict.size).toBe(4);
    });

    it('should create an empty dictionary from an empty array', () => {
      const dict = new TagDictionary([]);
      expect(dict.size).toBe(0);
    });
  });

  describe('fromStandard', () => {
    it('should create a dictionary from bundled standard data', () => {
      const dict = TagDictionary.fromStandard();
      expect(dict.size).toBeGreaterThan(0);
    });

    it('should contain well-known tags like SOP Class UID', () => {
      const dict = TagDictionary.fromStandard();
      const tag = dict.getTag('(0008,0016)');
      expect(tag).toBeDefined();
      expect(tag!.keyword).toBe('SOPClassUID');
    });
  });

  describe('getTag', () => {
    it('should return the tag definition for a known tag', () => {
      const dict = new TagDictionary(sampleTags);
      const tag = dict.getTag('(0008,0016)');
      expect(tag).toEqual(sampleTags[0]);
    });

    it('should return undefined for an unknown tag', () => {
      const dict = new TagDictionary(sampleTags);
      const tag = dict.getTag('(FFFF,FFFF)');
      expect(tag).toBeUndefined();
    });

    it('should perform case-insensitive lookup', () => {
      const dict = new TagDictionary(sampleTags);
      const tag = dict.getTag('(0008,0016)');
      const tagLower = dict.getTag('(0008,0016)');
      expect(tag).toEqual(tagLower);
    });

    it('should handle lowercase hex in tag ID', () => {
      const dict = new TagDictionary(sampleTags);
      const tag = dict.getTag('(0008,0040)');
      expect(tag).toBeDefined();
      expect(tag!.keyword).toBe('DataSetType');
    });

    it('should return retired tag definitions', () => {
      const dict = new TagDictionary(sampleTags);
      const tag = dict.getTag('(0008,0040)');
      expect(tag).toBeDefined();
      expect(tag!.retired).toBe(true);
    });
  });

  describe('isPrivateTag', () => {
    it('should return true for tags with odd group numbers', () => {
      const dict = new TagDictionary([]);
      expect(dict.isPrivateTag('(0009,0010)')).toBe(true);
      expect(dict.isPrivateTag('(0011,0001)')).toBe(true);
      expect(dict.isPrivateTag('(00FF,0010)')).toBe(true);
    });

    it('should return false for tags with even group numbers', () => {
      const dict = new TagDictionary([]);
      expect(dict.isPrivateTag('(0008,0016)')).toBe(false);
      expect(dict.isPrivateTag('(0010,0010)')).toBe(false);
      expect(dict.isPrivateTag('(0028,0010)')).toBe(false);
      expect(dict.isPrivateTag('(7FE0,0010)')).toBe(false);
    });

    it('should return false for invalid tag format', () => {
      const dict = new TagDictionary([]);
      expect(dict.isPrivateTag('invalid')).toBe(false);
      expect(dict.isPrivateTag('')).toBe(false);
    });

    it('should handle lowercase hex in group number', () => {
      const dict = new TagDictionary([]);
      expect(dict.isPrivateTag('(000f,0010)')).toBe(true);
      expect(dict.isPrivateTag('(000e,0010)')).toBe(false);
    });
  });
});
