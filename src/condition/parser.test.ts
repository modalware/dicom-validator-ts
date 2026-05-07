import { describe, it, expect } from 'vitest';
import { ConditionParser } from './parser.js';

describe('ConditionParser', () => {
  const parser = new ConditionParser();

  describe('tag_present pattern', () => {
    it('should parse "Required if <Name> (GGGG,EEEE) is present"', () => {
      const result = parser.parse('Required if Pixel Data (7FE0,0010) is present');
      expect(result).toEqual({ type: 'tag_present', tag: '(7FE0,0010)' });
    });

    it('should parse with different tag names and groups', () => {
      const result = parser.parse('Required if Modality (0008,0060) is present');
      expect(result).toEqual({ type: 'tag_present', tag: '(0008,0060)' });
    });

    it('should be case-insensitive for the keyword', () => {
      const result = parser.parse('Required if Modality (0008,0060) IS PRESENT');
      expect(result).toEqual({ type: 'tag_present', tag: '(0008,0060)' });
    });
  });

  describe('tag_absent pattern', () => {
    it('should parse "Required if <Name> (GGGG,EEEE) is absent"', () => {
      const result = parser.parse('Required if Pixel Data (7FE0,0010) is absent');
      expect(result).toEqual({ type: 'tag_absent', tag: '(7FE0,0010)' });
    });

    it('should parse with different tag names', () => {
      const result = parser.parse('Required if Image Type (0008,0008) is absent');
      expect(result).toEqual({ type: 'tag_absent', tag: '(0008,0008)' });
    });

    it('should be case-insensitive for the keyword', () => {
      const result = parser.parse('Required if Modality (0008,0060) IS ABSENT');
      expect(result).toEqual({ type: 'tag_absent', tag: '(0008,0060)' });
    });
  });

  describe('tag_equals pattern ("is <value>")', () => {
    it('should parse "Required if <Name> (GGGG,EEEE) is <value>"', () => {
      const result = parser.parse('Required if Modality (0008,0060) is CT');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0060)', value: 'CT' });
    });

    it('should parse with multi-word values', () => {
      const result = parser.parse('Required if Image Type (0008,0008) is ORIGINAL\\PRIMARY');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0008)', value: 'ORIGINAL\\PRIMARY' });
    });

    it('should trim trailing period from value', () => {
      const result = parser.parse('Required if Modality (0008,0060) is CT.');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0060)', value: 'CT' });
    });

    it('should handle numeric-looking values as strings', () => {
      const result = parser.parse('Required if Samples per Pixel (0028,0002) is 3');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0028,0002)', value: '3' });
    });
  });

  describe('tag_not_equals pattern ("is not <value>")', () => {
    it('should parse "Required if <Name> (GGGG,EEEE) is not <value>"', () => {
      const result = parser.parse('Required if Modality (0008,0060) is not CT');
      expect(result).toEqual({ type: 'tag_not_equals', tag: '(0008,0060)', value: 'CT' });
    });

    it('should parse with multi-word values', () => {
      const result = parser.parse('Required if Photometric Interpretation (0028,0004) is not MONOCHROME2');
      expect(result).toEqual({ type: 'tag_not_equals', tag: '(0028,0004)', value: 'MONOCHROME2' });
    });

    it('should trim trailing period from value', () => {
      const result = parser.parse('Required if Modality (0008,0060) is not MR.');
      expect(result).toEqual({ type: 'tag_not_equals', tag: '(0008,0060)', value: 'MR' });
    });
  });

  describe('tag_equals pattern ("has a value of <value>")', () => {
    it('should parse "Required if <Name> (GGGG,EEEE) has a value of <value>"', () => {
      const result = parser.parse('Required if Modality (0008,0060) has a value of CT');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0060)', value: 'CT' });
    });

    it('should parse with multi-word values', () => {
      const result = parser.parse('Required if Image Type (0008,0008) has a value of DERIVED\\SECONDARY');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0008)', value: 'DERIVED\\SECONDARY' });
    });

    it('should trim trailing period from value', () => {
      const result = parser.parse('Required if Modality (0008,0060) has a value of MR.');
      expect(result).toEqual({ type: 'tag_equals', tag: '(0008,0060)', value: 'MR' });
    });
  });

  describe('fallback for unparseable conditions', () => {
    it('should return indeterminate node for empty string', () => {
      const result = parser.parse('');
      expect(result).toEqual({ type: 'tag_present', tag: '(FFFF,FFFF)' });
    });

    it('should return indeterminate node for whitespace-only string', () => {
      const result = parser.parse('   ');
      expect(result).toEqual({ type: 'tag_present', tag: '(FFFF,FFFF)' });
    });

    it('should return indeterminate node for unrecognized pattern', () => {
      const result = parser.parse('Some complex condition that cannot be parsed');
      expect(result).toEqual({ type: 'tag_present', tag: '(FFFF,FFFF)' });
    });

    it('should return indeterminate node for condition without tag reference', () => {
      const result = parser.parse('Required if the image is a localizer');
      expect(result).toEqual({ type: 'tag_present', tag: '(FFFF,FFFF)' });
    });

    it('should return indeterminate node for condition with malformed tag', () => {
      const result = parser.parse('Required if Modality (ZZZZ,0060) is CT');
      expect(result).toEqual({ type: 'tag_present', tag: '(FFFF,FFFF)' });
    });
  });

  describe('edge cases', () => {
    it('should handle tag names with special characters', () => {
      const result = parser.parse("Required if Patient's Name (0010,0010) is present");
      expect(result).toEqual({ type: 'tag_present', tag: '(0010,0010)' });
    });

    it('should handle tag names with slashes', () => {
      const result = parser.parse('Required if Rows/Columns (0028,0010) is present');
      expect(result).toEqual({ type: 'tag_present', tag: '(0028,0010)' });
    });

    it('should handle lowercase hex in tag', () => {
      const result = parser.parse('Required if Pixel Data (7fe0,0010) is present');
      expect(result).toEqual({ type: 'tag_present', tag: '(7fe0,0010)' });
    });
  });
});
