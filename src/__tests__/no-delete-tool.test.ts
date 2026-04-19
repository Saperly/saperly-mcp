import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import manifest from "../../manifest.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Safety regression (Phase 3D, CEO 2026-04-18 decision):
 *
 * `saperly_delete_line` was removed. An AI agent hallucinating a `lineId` could
 * release a real Twilio number. The capability is still available on the REST
 * API (+ portal UI) — just not through MCP where hallucination is most likely.
 *
 * Manifest + tool-source + tool-count all independently lock the removal.
 */
describe("saperly_delete_line removal", () => {
  it("manifest.tools contains no entry named saperly_delete_line", () => {
    const deletedEntry = manifest.tools.find(
      (t) => t.name === "saperly_delete_line",
    );
    expect(deletedEntry).toBeUndefined();
  });

  it("packages/mcp/src/tools/lines.ts source has zero saperly_delete_line references", () => {
    const linesTsPath = resolve(__dirname, "..", "tools", "lines.ts");
    const source = readFileSync(linesTsPath, "utf-8");
    expect(source).not.toContain("saperly_delete_line");
  });

  it("manifest.tools contains no tool whose name includes 'delete_line'", () => {
    const anyDeleteLineTool = manifest.tools.find((t) =>
      t.name.includes("delete_line"),
    );
    expect(anyDeleteLineTool).toBeUndefined();
  });

  it("manifest.version === 0.2.0 (breaking-removal minor bump)", () => {
    expect(manifest.version).toBe("0.2.0");
  });
});
