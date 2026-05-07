import type { ConditionNode } from '../condition/types.js';

/**
 * Reference to a module within an IOD definition.
 * Describes which module is included, its usage type, and any condition
 * that determines whether the module applies.
 */
export interface IODModuleRef {
  /** Module identifier used for lookup in ModuleRegistry */
  moduleId: string;
  /** Human-readable module name */
  moduleName: string;
  /** Usage type: Mandatory, Conditional, or User Optional */
  usage: 'M' | 'C' | 'U';
  /** For usage 'C', the condition AST that determines applicability */
  condition?: ConditionNode;
}

/**
 * An IOD (Information Object Definition) maps a SOP Class to its
 * constituent modules and their usage types.
 */
export interface IODDefinition {
  /** SOP Class UID that identifies this IOD */
  sopClassUID: string;
  /** Human-readable SOP Class name */
  sopClassName: string;
  /** Ordered list of modules that compose this IOD */
  modules: IODModuleRef[];
}

/**
 * Registry of IOD definitions indexed by SOP Class UID.
 * Provides O(1) lookup of IOD definitions for validation.
 */
export class IODRegistry {
  private readonly iodMap: Map<string, IODDefinition>;

  /**
   * Create an IODRegistry from an array of IOD definitions.
   * All definitions are indexed by their SOP Class UID for fast lookup.
   */
  constructor(definitions: IODDefinition[]) {
    this.iodMap = new Map();
    for (const def of definitions) {
      this.iodMap.set(def.sopClassUID, def);
    }
  }

  /**
   * Get an IOD definition by SOP Class UID.
   * @param sopClassUID - The SOP Class UID to look up
   * @returns The IOD definition, or undefined if the SOP Class UID is not recognized
   */
  getIOD(sopClassUID: string): IODDefinition | undefined {
    return this.iodMap.get(sopClassUID);
  }
}
