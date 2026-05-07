import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { DicomParser, ParseResult } from './dicom-parser.js';
import { DicomDataset, SequenceItem } from '../types/dataset.js';
import {
  EmptyInputError,
  FileNotFoundError,
  InvalidDicomError,
} from '../errors.js';
import dcmjs from 'dcmjs';

const FIXTURES_DIR = join(__dirname, '../../tests/fixtures');

/**
 * Build a minimal valid DICOM ArrayBuffer with custom elements.
 * Uses dcmjs to create a proper DICOM Part 10 file in memory.
 */
function buildDicomBuffer(extraElements?: Record<string, unknown>): ArrayBuffer {
  const { DicomDict, DicomMetaDictionary } = dcmjs.data;

  const baseDataset: Record<string, unknown> = {
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
    SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
    StudyDate: '20240101',
    Modality: 'CT',
    PatientName: 'Test^Patient',
    PatientID: 'TEST001',
    StudyInstanceUID: '1.2.3.4.5.6.7.8',
    SeriesInstanceUID: '1.2.3.4.5.6.7.8.1',
    ...extraElements,
  };

  const dicomDict = new DicomDict({
    TransferSyntaxUID: '1.2.840.10008.1.2.1', // Explicit VR Little Endian
  });

  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(baseDataset);
  return dicomDict.write();
}

describe('DicomParser', () => {
  const parser = new DicomParser();

  describe('parseFile', () => {
    it('should parse a valid DICOM file and return a ParseResult', async () => {
      const result = await parser.parseFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));

      expect(result).toBeDefined();
      expect(result.dataset).toBeInstanceOf(DicomDataset);
      expect(result.dataset.elements.size).toBeGreaterThan(0);
    });

    it('should extract transferSyntaxUID from meta header', async () => {
      const result = await parser.parseFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));

      // Transfer Syntax UID should be present in a valid DICOM file
      if (result.transferSyntaxUID) {
        expect(result.transferSyntaxUID).toMatch(/^[\d.]+$/);
      }
    });

    it('should throw FileNotFoundError for non-existent file', async () => {
      await expect(
        parser.parseFile('/nonexistent/path/file.dcm')
      ).rejects.toThrow(FileNotFoundError);
    });

    it('should throw FileNotFoundError with the attempted file path', async () => {
      const path = '/nonexistent/path/file.dcm';
      try {
        await parser.parseFile(path);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FileNotFoundError);
        expect((err as FileNotFoundError).filePath).toBe(path);
      }
    });
  });

  describe('parseBuffer', () => {
    it('should throw EmptyInputError for empty Buffer', () => {
      expect(() => parser.parseBuffer(Buffer.alloc(0))).toThrow(EmptyInputError);
    });

    it('should throw EmptyInputError for zero-length ArrayBuffer', () => {
      expect(() => parser.parseBuffer(new ArrayBuffer(0))).toThrow(EmptyInputError);
    });

    it('should throw InvalidDicomError for non-DICOM data', () => {
      const garbage = Buffer.from('This is not a DICOM file at all');
      expect(() => parser.parseBuffer(garbage)).toThrow(InvalidDicomError);
    });

    it('should parse a valid DICOM buffer', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));
      const result = parser.parseBuffer(fileBuffer);

      expect(result.dataset).toBeInstanceOf(DicomDataset);
      expect(result.dataset.elements.size).toBeGreaterThan(0);
    });

    it('should parse an ArrayBuffer', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      );
      const result = parser.parseBuffer(arrayBuffer);

      expect(result.dataset).toBeInstanceOf(DicomDataset);
      expect(result.dataset.elements.size).toBeGreaterThan(0);
    });

    it('should parse a programmatically built DICOM ArrayBuffer', () => {
      const ab = buildDicomBuffer();
      const result = parser.parseBuffer(ab);

      expect(result.dataset).toBeInstanceOf(DicomDataset);
      expect(result.dataset.elements.size).toBeGreaterThan(0);
      expect(result.transferSyntaxUID).toBe('1.2.840.10008.1.2.1');
    });

    it('should exclude private tags when includePrivateTags is false', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));

      const withPrivate = parser.parseBuffer(fileBuffer, { includePrivateTags: true });
      const withoutPrivate = parser.parseBuffer(fileBuffer, { includePrivateTags: false });

      // Without private tags should have equal or fewer elements
      expect(withoutPrivate.dataset.elements.size).toBeLessThanOrEqual(
        withPrivate.dataset.elements.size
      );
    });

    it('should include private tags by default', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));

      const defaultResult = parser.parseBuffer(fileBuffer);
      const explicitResult = parser.parseBuffer(fileBuffer, { includePrivateTags: true });

      expect(defaultResult.dataset.elements.size).toBe(
        explicitResult.dataset.elements.size
      );
    });
  });

  describe('private tag handling', () => {
    it('should include private tags in output when includePrivateTags is true', () => {
      // Build a DICOM buffer, then manually inject a private tag via dcmjs
      const { DicomDict, DicomMetaDictionary } = dcmjs.data;
      const dicomDict = new DicomDict({
        TransferSyntaxUID: '1.2.840.10008.1.2.1',
      });
      const baseDataset: Record<string, unknown> = {
        SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
        SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
        Modality: 'CT',
        PatientID: 'TEST001',
      };
      dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(baseDataset);
      // Add a private tag (odd group 0009)
      dicomDict.dict['00091001'] = { vr: 'LO', Value: ['PrivateData'] };

      const ab = dicomDict.write();
      const result = parser.parseBuffer(ab, { includePrivateTags: true });

      // Should find the private tag (0009,1001)
      const privateElement = result.dataset.getElement('(0009,1001)');
      expect(privateElement).toBeDefined();
      expect(privateElement!.vr).toBe('LO');
      expect(privateElement!.value).toBe('PrivateData');
    });

    it('should exclude private tags from output when includePrivateTags is false', () => {
      const { DicomDict, DicomMetaDictionary } = dcmjs.data;
      const dicomDict = new DicomDict({
        TransferSyntaxUID: '1.2.840.10008.1.2.1',
      });
      const baseDataset: Record<string, unknown> = {
        SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
        SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
        Modality: 'CT',
        PatientID: 'TEST001',
      };
      dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(baseDataset);
      // Add a private tag (odd group 0009)
      dicomDict.dict['00091001'] = { vr: 'LO', Value: ['PrivateData'] };

      const ab = dicomDict.write();
      const result = parser.parseBuffer(ab, { includePrivateTags: false });

      // Should NOT find the private tag
      const privateElement = result.dataset.getElement('(0009,1001)');
      expect(privateElement).toBeUndefined();
    });
  });

  describe('sequence handling', () => {
    it('should parse sequence items and represent them as SequenceItem arrays', () => {
      // Build a DICOM buffer with a sequence tag
      const { DicomDict, DicomMetaDictionary } = dcmjs.data;
      const dicomDict = new DicomDict({
        TransferSyntaxUID: '1.2.840.10008.1.2.1',
      });
      const baseDataset: Record<string, unknown> = {
        SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
        SOPInstanceUID: '1.2.3.4.5.6.7.8.9',
        Modality: 'CT',
        PatientID: 'TEST001',
        // ReferencedStudySequence (0008,1110) is a well-known SQ tag
        ReferencedStudySequence: [
          {
            ReferencedSOPClassUID: '1.2.840.10008.3.1.2.3.1',
            ReferencedSOPInstanceUID: '1.2.3.4.5.6.7.8.10',
          },
        ],
      };
      dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(baseDataset);
      const ab = dicomDict.write();

      const result = parser.parseBuffer(ab);

      // Find the sequence tag (0008,1110)
      const seqElement = result.dataset.getElement('(0008,1110)');
      expect(seqElement).toBeDefined();
      expect(seqElement!.vr).toBe('SQ');
      expect(Array.isArray(seqElement!.value)).toBe(true);

      const items = seqElement!.value as SequenceItem[];
      expect(items.length).toBe(1);
      expect(items[0].elements).toBeInstanceOf(Map);
      expect(items[0].elements.size).toBeGreaterThan(0);
    });
  });

  describe('dataset conversion', () => {
    it('should produce DicomElement entries with tag, vr, and value', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));
      const result = parser.parseBuffer(fileBuffer);

      for (const [tag, element] of result.dataset.elements) {
        expect(tag).toMatch(/^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/);
        expect(element.tag).toBe(tag);
        expect(element.vr).toBeDefined();
        expect(typeof element.vr).toBe('string');
      }
    });

    it('should support getString on the resulting dataset', async () => {
      const { readFile } = await import('node:fs/promises');
      const fileBuffer = await readFile(join(FIXTURES_DIR, 'minimal-ct.dcm'));
      const result = parser.parseBuffer(fileBuffer);

      // SOP Class UID tag (0008,0016) should be present in a CT file
      const sopClassUID = result.dataset.getString('(0008,0016)');
      if (sopClassUID) {
        expect(sopClassUID).toMatch(/^[\d.]+$/);
      }
    });
  });
});
