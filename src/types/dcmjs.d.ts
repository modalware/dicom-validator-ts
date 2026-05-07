/**
 * Type declarations for dcmjs.
 *
 * dcmjs does not ship its own TypeScript declarations.
 * This provides minimal typings for the APIs we use.
 */
declare module 'dcmjs' {
  interface DicomMetaDictionaryEntry {
    tag: string;
    vr: string;
    name: string;
    vm: string;
    version: string;
  }

  interface DicomMetaDictionaryStatic {
    dictionary: Record<string, DicomMetaDictionaryEntry>;
    punctuateTag(tag: string): string;
    unpunctuateTag(tag: string): string;
    nameMap: Record<string, DicomMetaDictionaryEntry>;
  }

  interface DicomDict {
    meta: Record<string, { vr?: string; Value?: unknown[]; InlineBinary?: string; BulkDataURI?: string }>;
    dict: Record<string, { vr?: string; Value?: unknown[]; InlineBinary?: string; BulkDataURI?: string }>;
  }

  interface ReadFileOptions {
    ignoreErrors?: boolean;
  }

  interface DicomMessageStatic {
    readFile(arrayBuffer: ArrayBuffer, options?: ReadFileOptions): DicomDict;
  }

  interface DcmjsData {
    DicomMessage: DicomMessageStatic;
    DicomMetaDictionary: DicomMetaDictionaryStatic;
  }

  interface Dcmjs {
    data: DcmjsData;
  }

  const dcmjs: Dcmjs;
  export default dcmjs;
}
