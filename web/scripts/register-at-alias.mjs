// Registers the `@/` alias resolve hook for codegen scripts.
import { register } from "node:module";

register("./at-alias-hooks.mjs", import.meta.url);
