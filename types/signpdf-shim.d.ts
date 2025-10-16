// types/signpdf-shim.d.ts
declare module "@signpdf/placeholder-plain" {
  // Keep it simple: accept a real Node Buffer and return a Buffer.
  export const plainAddPlaceholder: (input: {
    pdfBuffer: Buffer;              // real Node Buffer at runtime
    reason?: string;
    location?: string;
    name?: string;
    contactInfo?: string;
    signatureLength?: number;
  }) => Buffer;
}
