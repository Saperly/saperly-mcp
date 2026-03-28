import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("SKILL.md", () => {
  it("exists and has required frontmatter fields", () => {
    const skillPath = resolve(__dirname, "../../SKILL.md");
    const content = readFileSync(skillPath, "utf-8");

    expect(content).toContain("name: saperly");
    expect(content).toContain("description:");
  });
});
