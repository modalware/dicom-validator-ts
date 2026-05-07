import type { ConditionNode } from '../condition/types.js';

/**
 * Represents a single attribute within a DICOM module definition.
 */
export interface ModuleAttribute {
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  /** Human-readable attribute name */
  name: string;
  /** Attribute type per DICOM standard */
  type: '1' | '1C' | '2' | '2C' | '3';
  /** Condition AST for Type 1C/2C attributes */
  condition?: ConditionNode;
}

/**
 * Represents a DICOM module definition containing its attributes.
 */
export interface ModuleDefinition {
  /** Unique module identifier */
  moduleId: string;
  /** Human-readable module name */
  moduleName: string;
  /** List of attributes belonging to this module */
  attributes: ModuleAttribute[];
}

/**
 * Registry for DICOM module definitions.
 * Provides O(1) lookup of module definitions by module ID.
 */
export class ModuleRegistry {
  private modules: Map<string, ModuleDefinition>;

  /**
   * Create a ModuleRegistry from an array of module definitions.
   * @param moduleData Array of ModuleDefinition objects to index
   */
  constructor(moduleData: ModuleDefinition[]) {
    this.modules = new Map();
    for (const module of moduleData) {
      this.modules.set(module.moduleId, module);
    }
  }

  /**
   * Get a module definition by its module ID.
   * @param moduleId The unique identifier of the module
   * @returns The ModuleDefinition if found, undefined otherwise
   */
  getModule(moduleId: string): ModuleDefinition | undefined {
    return this.modules.get(moduleId);
  }
}
