import { readFileSync, existsSync } from "node:fs";

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
  const eq = withoutExport.indexOf("=");
  if (eq === -1) return null;

  const key = withoutExport.slice(0, eq).trim();
  let value = withoutExport.slice(eq + 1).trim();

  const doubleQuoted = /^"([\s\S]*)"$/.exec(value);
  const singleQuoted = /^'([\s\S]*)'$/.exec(value);
  if (doubleQuoted) {
    value = doubleQuoted[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  } else if (singleQuoted) {
    value = singleQuoted[1];
  } else {
    // strip an unquoted trailing comment, e.g. PORT=3000 # default port
    const hashIdx = value.indexOf(" #");
    if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
  }

  return [key, value];
}

/** Parse .env-file syntax from a string into a plain object. */
export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const pair = parseLine(line);
    if (pair) result[pair[0]] = pair[1];
  }
  return result;
}

/**
 * Load a .env-style file and copy its values into `target` (process.env by
 * default). Existing values in `target` win unless `override` is set, so a
 * real environment variable always beats one loaded from a file. Silently
 * does nothing if the file doesn't exist — loading a .env file is always
 * optional, since production usually sets real environment variables.
 */
export function loadEnv(path = ".env", { override = false, target = process.env } = {}) {
  if (!existsSync(path)) return {};
  const parsed = parseEnv(readFileSync(path, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || target[key] === undefined) target[key] = value;
  }
  return parsed;
}
