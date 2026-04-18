#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const toolsDir = join(packageRoot, "src", "tools");
const manifestPath = join(packageRoot, "manifest.json");

const TOOL_REGEX = /server\.tool\(\s*"(?<name>saperly_[a-z_]+)"/g;

type Manifest = {
  tools: Array<{ name: string; group: string; description: string }>;
};

function collectSourceToolNames(): Set<string> {
  const names = new Set<string>();
  const files = readdirSync(toolsDir).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const content = readFileSync(join(toolsDir, file), "utf-8");
    for (const match of content.matchAll(TOOL_REGEX)) {
      const name = match.groups?.name;
      if (name) names.add(name);
    }
  }
  return names;
}

function collectManifestToolNames(): Set<string> {
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  return new Set(manifest.tools.map((t) => t.name));
}

const source = collectSourceToolNames();
const manifest = collectManifestToolNames();

const inSourceNotManifest = [...source].filter((n) => !manifest.has(n)).sort();
const inManifestNotSource = [...manifest].filter((n) => !source.has(n)).sort();

if (inSourceNotManifest.length === 0 && inManifestNotSource.length === 0) {
  console.log(
    `✓ manifest.json is in sync with packages/mcp/src/tools/*.ts (${source.size} tools)`,
  );
  process.exit(0);
}

console.error("✗ manifest.json is out of sync with packages/mcp/src/tools/*.ts");
if (inSourceNotManifest.length > 0) {
  console.error("\nTools in source but MISSING from manifest.json:");
  for (const name of inSourceNotManifest) console.error(`  + ${name}`);
}
if (inManifestNotSource.length > 0) {
  console.error("\nTools in manifest.json but NOT in source (orphaned):");
  for (const name of inManifestNotSource) console.error(`  - ${name}`);
}
console.error(
  `\nSource tools: ${source.size}    Manifest tools: ${manifest.size}`,
);
console.error(
  `Fix: update packages/mcp/manifest.json to match the server.tool("saperly_...") calls in packages/mcp/src/tools/*.ts`,
);
process.exit(1);
