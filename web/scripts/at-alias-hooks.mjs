// ESM resolve hook: maps the `@/` tsconfig alias to `web/src/` and lets
// extensionless TS imports resolve, so Node's native type-stripping can load
// project sources directly for build-time codegen (no bundler needed).
import { pathToFileURL } from "node:url";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  // Extensionless relative/absolute TS imports (and @/ targets): try .ts/.tsx.
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
