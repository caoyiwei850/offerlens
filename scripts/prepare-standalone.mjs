import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveDefaultSource() {
  const pdfParseEntry = fileURLToPath(import.meta.resolve("pdf-parse"));
  return path.join(path.dirname(pdfParseEntry), "pdf.worker.mjs");
}

const source = process.argv[2] ?? resolveDefaultSource();
const chunksDirectory =
  process.argv[3] ??
  path.join(process.cwd(), ".next", "standalone", ".next", "server", "chunks");
const target = path.join(chunksDirectory, "pdf.worker.mjs");
const staticSource =
  process.argv[4] ?? path.join(process.cwd(), ".next", "static");
const staticTarget =
  process.argv[5] ??
  path.join(process.cwd(), ".next", "standalone", ".next", "static");
const fontSourceDirectory = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "noto-sans-sc",
  "files",
);
const fontTargetDirectory = path.join(
  process.cwd(),
  ".next",
  "standalone",
  "assets",
  "fonts",
);
const fontFiles = [
  "noto-sans-sc-chinese-simplified-400-normal.woff",
  "noto-sans-sc-chinese-simplified-700-normal.woff",
];

await mkdir(chunksDirectory, { recursive: true });
await copyFile(source, target);
await rm(staticTarget, { recursive: true, force: true });
await cp(staticSource, staticTarget, { recursive: true });
await mkdir(fontTargetDirectory, { recursive: true });
await Promise.all(
  fontFiles.map((filename) =>
    copyFile(
      path.join(fontSourceDirectory, filename),
      path.join(fontTargetDirectory, filename),
    ),
  ),
);

console.log(`Prepared standalone PDF worker: ${target}`);
console.log(`Prepared standalone static assets: ${staticTarget}`);
console.log(`Prepared standalone Chinese fonts: ${fontTargetDirectory}`);
