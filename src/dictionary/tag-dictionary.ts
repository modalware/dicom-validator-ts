/**
 * TagDictionary provides O(1) lookup of DICOM tag definitions by tag ID.
 *
 * Tag IDs are in the standard "(GGGG,EEEE)" format where GGGG is the group
 * number and EEEE is the element number, both in uppercase hexadecimal.
 */

import type { TagDefinition } from '../types/dicom-tag.js';

// Import the bundled tag data
import tagData from './data/tags.json' with { type: 'json' };

/**
 * A dictionary of DICOM standard tags indexed by tag ID for O(1) lookup.
 */
export class TagDictionary {
  private readonly tags: Map<string, TagDefinition>;

  /**
   * Create a TagDictionary from an array of tag definitions.
   * @param definitions - Array of TagDefinition objects to index
   */
  constructor(definitions: TagDefinition[]) {
    this.tags = new Map();
    for (const def of definitions) {
      // Normalize tag to uppercase for consistent lookup
      this.tags.set(def.tag.toUpperCase(), def);
    }
  }

  /**
   * Create a TagDictionary loaded with the bundled DICOM standard tag data.
   */
  static fromStandard(): TagDictionary {
    return new TagDictionary(tagData as TagDefinition[]);
  }

  /**
   * Look up a tag definition by its "(GGGG,EEEE)" string.
   * @param tagId - Tag identifier in "(GGGG,EEEE)" format
   * @returns The TagDefinition if found, or undefined if not in the dictionary
   */
  getTag(tagId: string): TagDefinition | undefined {
    return this.tags.get(tagId.toUpperCase());
  }

  /**
   * Check if a tag is a private tag (odd group number).
   *
   * Private tags have an odd group number. This is determined by parsing
   * the group portion of the tag ID and checking if it's odd.
   *
   * @param tagId - Tag identifier in "(GGGG,EEEE)" format
   * @returns true if the tag has an odd group number (private tag)
   */
  isPrivateTag(tagId: string): boolean {
    // Extract group number from "(GGGG,EEEE)" format
    const match = tagId.match(/^\(([0-9A-Fa-f]{4}),/);
    if (!match) {
      return false;
    }
    const group = parseInt(match[1], 16);
    return group % 2 !== 0;
  }

  /**
   * Get the total number of tags in the dictionary.
   */
  get size(): number {
    return this.tags.size;
  }
}
