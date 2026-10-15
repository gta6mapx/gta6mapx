// web/scripts/ts-resolve-hooks.mjs
// Module customization hooks so plain `node` can run our TS sources in
// acceptance scripts: resolves TS-style extensionless relative imports and
// adds the missing import attributes for JSON imports (TS resolveJsonModule).
// Not type-checked (plain .mjs); loaded via module.register().

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export async function resolve(specifier, context, next) {
  // JSON imported without attributes (TS source) — supply them.
  if (specifier.endsWith(".json")) {
    return {
      url: new URL(specifier, context.parentURL).href,
      importAttributes: { type: "json" },
      shortCircuit: true,
    };
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    const isRelative =
      specifier.startsWith(".") ||
      specifier.startsWith("file:") ||
      path.isAbsolute(specifier);
    if (!isRelative || /\.[a-z0-9]+$/i.test(specifier)) throw err;
    const base = specifier.startsWith("file:")
      ? fileURLToPath(specifier)
      : path.resolve(
          path.dirname(fileURLToPath(context.parentURL)),
          specifier
        );
    for (const suffix of [".ts", ".tsx", ".mts", "/index.ts"]) {
      const cand = base + suffix;
      if (existsSync(cand) && !cand.endsWith(".d.ts")) {
        return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
    }
    throw err;
  }
}
