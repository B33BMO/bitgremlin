// types/signpdf-shim.d.ts
declare module "@signpdf/placeholder-plain" {
  // Override the bad type definitions with sane ones.
  export interface PlainAddPlaceholderInput {
    pdfBuffer: Buffer | Uint8Array | ArrayBuffer;
    reason?: string;
    location?: string;
    name?: string;
    contactInfo?: string;
    signatureLength?: number;
  }

  export function plainAddPlaceholder(input: PlainAddPlaceholderInput): Buffer;
}
