/**
 * DictionaryLoader provides lazy singleton access to all DICOM standard
 * dictionary data. Data is loaded and cached on first access.
 *
 * Condition strings in module definitions are pre-parsed into AST nodes
 * during loading to avoid repeated parsing at evaluation time.
 */

import type { ConditionNode } from '../condition/types.js';
import type { IODDefinition, IODModuleRef } from './iod-registry.js';
import { IODRegistry } from './iod-registry.js';
import type { ModuleAttribute, ModuleDefinition } from './module-registry.js';
import { ModuleRegistry } from './module-registry.js';
import { TagDictionary } from './tag-dictionary.js';

import iodData from './data/iods.json' with { type: 'json' };
import moduleData from './data/modules.json' with { type: 'json' };

/**
 * Raw module attribute as stored in the JSON data file.
 * May include a conditionText string that needs to be parsed into an AST.
 */
interface RawModuleAttribute {
  tag: string;
  name: string;
  type: '1' | '1C' | '2' | '2C' | '3';
  conditionText?: string;
}

/**
 * Raw module definition as stored in the JSON data file.
 */
interface RawModuleDefinition {
  moduleId: string;
  moduleName: string;
  attributes: RawModuleAttribute[];
}

/**
 * Raw IOD module reference as stored in the JSON data file.
 */
interface RawIODModuleRef {
  moduleId: string;
  moduleName: string;
  usage: 'M' | 'C' | 'U';
  conditionText?: string;
}

/**
 * Raw IOD definition as stored in the JSON data file.
 */
interface RawIODDefinition {
  sopClassUID: string;
  sopClassName: string;
  modules: RawIODModuleRef[];
}

/**
 * Singleton loader for all DICOM standard dictionary data.
 * Uses lazy initialization — data is loaded and cached on first access.
 */
export class DictionaryLoader {
  private static instance: DictionaryLoader | null = null;

  private tagDictionary: TagDictionary | null = null;
  private iodRegistry: IODRegistry | null = null;
  private moduleRegistry: ModuleRegistry | null = null;

  private constructor() {}

  /**
   * Get the singleton DictionaryLoader instance.
   */
  static getInstance(): DictionaryLoader {
    if (!DictionaryLoader.instance) {
      DictionaryLoader.instance = new DictionaryLoader();
    }
    return DictionaryLoader.instance;
  }

  /**
   * Get the TagDictionary, loading it on first access.
   */
  getTagDictionary(): TagDictionary {
    if (!this.tagDictionary) {
      this.tagDictionary = TagDictionary.fromStandard();
    }
    return this.tagDictionary;
  }

  /**
   * Get the IODRegistry, loading it on first access.
   * Condition strings on conditional modules are pre-parsed into AST nodes.
   */
  getIODRegistry(): IODRegistry {
    if (!this.iodRegistry) {
      const definitions = (iodData as RawIODDefinition[]).map(
        (raw): IODDefinition => ({
          sopClassUID: raw.sopClassUID,
          sopClassName: raw.sopClassName,
          modules: raw.modules.map(
            (mod): IODModuleRef => ({
              moduleId: mod.moduleId,
              moduleName: mod.moduleName,
              usage: mod.usage,
              condition: mod.conditionText
                ? this.parseConditionText(mod.conditionText)
                : undefined,
            })
          ),
        })
      );
      this.iodRegistry = new IODRegistry(definitions);
    }
    return this.iodRegistry;
  }

  /**
   * Get the ModuleRegistry, loading it on first access.
   * Condition strings on Type 1C/2C attributes are pre-parsed into AST nodes.
   */
  getModuleRegistry(): ModuleRegistry {
    if (!this.moduleRegistry) {
      const definitions = (moduleData as RawModuleDefinition[]).map(
        (raw): ModuleDefinition => ({
          moduleId: raw.moduleId,
          moduleName: raw.moduleName,
          attributes: raw.attributes.map(
            (attr): ModuleAttribute => ({
              tag: attr.tag,
              name: attr.name,
              type: attr.type,
              condition: attr.conditionText
                ? this.parseConditionText(attr.conditionText)
                : undefined,
            })
          ),
        })
      );
      this.moduleRegistry = new ModuleRegistry(definitions);
    }
    return this.moduleRegistry;
  }

  /**
   * Parse a condition text string into a ConditionNode AST.
   *
   * Supports common DICOM condition patterns:
   * - "Required if <Tag Name> (<GGGG,EEEE>) is present"
   * - "Required if <Tag Name> (<GGGG,EEEE>) is <value>"
   *
   * Falls back to a tag_present node with a placeholder for unparseable conditions.
   */
  private parseConditionText(text: string): ConditionNode {
    // Pattern: "Required if <Name> (GGGG,EEEE) is present"
    const presentMatch = text.match(
      /\(([0-9A-Fa-f]{4},[0-9A-Fa-f]{4})\)\s+is\s+present/i
    );
    if (presentMatch) {
      return { type: 'tag_present', tag: `(${presentMatch[1].toUpperCase()})` };
    }

    // Pattern: "Required if <Name> (GGGG,EEEE) is <value>"
    const equalsMatch = text.match(
      /\(([0-9A-Fa-f]{4},[0-9A-Fa-f]{4})\)\s+is\s+(.+)/i
    );
    if (equalsMatch) {
      return {
        type: 'tag_equals',
        tag: `(${equalsMatch[1].toUpperCase()})`,
        value: equalsMatch[2].trim(),
      };
    }

    // Fallback: try to extract any tag reference for a basic presence check
    const tagMatch = text.match(/\(([0-9A-Fa-f]{4},[0-9A-Fa-f]{4})\)/);
    if (tagMatch) {
      return { type: 'tag_present', tag: `(${tagMatch[1].toUpperCase()})` };
    }

    // Ultimate fallback: return a condition that always evaluates to indeterminate
    // by referencing a non-existent tag
    return { type: 'tag_present', tag: '(FFFF,FFFF)' };
  }

  /**
   * Reset the singleton instance. Primarily for testing purposes.
   */
  static resetInstance(): void {
    DictionaryLoader.instance = null;
  }
}
