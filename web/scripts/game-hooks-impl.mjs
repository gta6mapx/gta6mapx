// Self-contained register file for scripts/game-acceptance.mts.
// Same @/ alias resolution as scripts/at-alias-hooks.mjs, plus a JSON load
// hook: Node's native type-stripping requires an import attribute
// (`with { type: "json" }`) for JSON modules, but project sources import
// ./gtadb-approved.json plainly (the Next.js bundler handles it). This hook
// serves .json sources directly so acceptance tests can import entity data
// without the bundler. The shared scripts/register-at-alias.mjs is untouched.
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src") + path.sep;

function tryCandidates(base, isFileUrl) {
  const p = isFileUrl ? fileURLToPath(base) : base;
  for (const cand of [p, `${p}.ts`, `${p}.tsx`, path.join(p, "index.ts")]) {
    if (existsSync(cand) && statSync(cand).isFile()) {
      return { url: pathToFileURL(cand).href, shortCircuit: true };
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let target = specifier;
  if (specifier.startsWith("@/")) {
    target = pathToFileURL(path.join(SRC, specifier.slice(2))).href;
  }
  if (target.startsWith("file:") || target.startsWith(".") || target.startsWith("@/")) {
    try {
      const abs = target.startsWith("file:")
        ? target
        : pathToFileURL(path.resolve(path.dirname(fileURLToPath(context.parentURL)), target)).href;
      const hit = tryCandidates(abs, true);
      if (hit) return hit;
    } catch {
      /* fall through to default resolution */
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    try {
      const source = await readFile(fileURLToPath(url), "utf8");
      return { format: "json", source, shortCircuit: true };
    } catch {
      /* fall through to default */
    }
  }
  return next(url, context);
}
