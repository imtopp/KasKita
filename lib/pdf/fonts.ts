import { readFileSync } from "node:fs";

import pdfmake from "pdfmake";
import vfs from "pdfmake/build/vfs_fonts";

for (const [name, base64] of Object.entries(vfs)) {
  pdfmake.virtualfs.storage[`font/${name}`] = Buffer.from(base64, "base64");
}

export const LOGO_DATA_URL = `data:image/png;base64,${readFileSync(
  new URL("./logo.png", import.meta.url),
).toString("base64")}`;

pdfmake.setFonts({
  Roboto: {
    normal: "font/Roboto-Regular.ttf",
    bold: "font/Roboto-Medium.ttf",
    italics: "font/Roboto-Italic.ttf",
    bolditalics: "font/Roboto-MediumItalic.ttf",
  },
});

pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

export {};
