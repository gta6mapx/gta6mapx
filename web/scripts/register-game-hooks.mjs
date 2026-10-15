// Registers the game test hooks (extensionless TS resolution + JSON load).
import { register } from "node:module";

register("./game-hooks-impl.mjs", import.meta.url);
