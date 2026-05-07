/**
 * Tag-related type definitions for DICOM tags.
 */

/** A DICOM tag identifier in "(GGGG,EEEE)" format */
export type DicomTagId = string;

/** Definition of a DICOM tag from the standard dictionary */
export interface TagDefinition {
  /** Tag number in "(GGGG,EEEE)" format */
  tag: string;
  /** Human-readable name */
  name: string;
  /** CamelCase keyword */
  keyword: string;
  /** Value Representation (e.g., "DA", "UI") */
  vr: string;
  /** Value Multiplicity (e.g., "1", "1-n", "2-2n") */
  vm: string;
  /** Whether the tag is retired */
  retired: boolean;
}
