import type { TCreatedPdf } from "pdfmake";
import type {
  BufferOptions,
  TDocumentDefinitions,
  TFontDictionary,
} from "pdfmake/interfaces";

declare module "pdfmake" {
  const pdfmake: {
    createPdf(
      documentDefinitions: TDocumentDefinitions,
      options?: BufferOptions,
    ): TCreatedPdf;
    setFonts(fonts: TFontDictionary): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    setLocalAccessPolicy(callback: (path: string) => boolean): void;
    virtualfs: { storage: Record<string, string | Buffer> };
  };
  export default pdfmake;
}
