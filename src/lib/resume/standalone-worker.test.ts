// @vitest-environment node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("standalone runtime preparation", () => {
  it("places the PDF worker and static assets in the standalone runtime", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "offerlens-worker-"));
    const source = path.join(directory, "source", "pdf.worker.mjs");
    const chunks = path.join(directory, ".next", "standalone", ".next", "server", "chunks");
    const staticSource = path.join(directory, ".next", "static");
    const staticTarget = path.join(
      directory,
      ".next",
      "standalone",
      ".next",
      "static",
    );
    await mkdir(path.dirname(source), { recursive: true });
    await mkdir(path.join(staticSource, "chunks"), { recursive: true });
    await writeFile(source, "export const worker = true;");
    await writeFile(path.join(staticSource, "chunks", "app.js"), "client runtime");

    await execFileAsync(process.execPath, [
      path.resolve("scripts/prepare-standalone.mjs"),
      source,
      chunks,
      staticSource,
      staticTarget,
    ]);

    await expect(readFile(path.join(chunks, "pdf.worker.mjs"), "utf8")).resolves.toBe(
      "export const worker = true;",
    );
    await expect(
      readFile(path.join(staticTarget, "chunks", "app.js"), "utf8"),
    ).resolves.toBe("client runtime");
  });
});
