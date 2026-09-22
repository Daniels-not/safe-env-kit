import { mask } from "./mask.js";
import { SCHEMA } from "./schema.js";

function getPath(obj, path) {
  return path.split(".").reduce((cur, part) => (cur == null ? undefined : cur[part]), obj);
}

function displayValue(rule, raw) {
  if (rule?.type === "secret") return mask(String(raw));
  if (raw instanceof URL) return raw.toString();
  if (Array.isArray(raw)) return raw.join(", ");
  if (raw && typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

const ANSI = { reset: "\x1b[0m", dim: "\x1b[2m", key: "\x1b[36m", secret: "\x1b[33m" };

/**
 * Print a safe, human-readable view of a defineEnv() config, masking any
 * field whose schema type is "secret" and flattening any nested `path`
 * fields back into dotted keys for display. Works on plain objects too
 * (with no masking, since there's no schema to consult).
 *
 * Always returns a plain (uncolored) string, so it stays test-friendly and
 * safe to log elsewhere. When printing to an interactive terminal it also
 * prints a colorized version — keys in one color, secrets dimmed.
 */
export function inspect(config, { log = true } = {}) {
  const schema = config[SCHEMA];

  const rows = schema
    ? Object.entries(schema).map(([envKey, rule]) => {
        const displayKey = rule.path ?? envKey;
        const raw = rule.path ? getPath(config, rule.path) : config[envKey];
        return { displayKey, rule, raw };
      })
    : Object.keys(config).map((k) => ({ displayKey: k, rule: {}, raw: config[k] }));

  const visible = rows.filter((r) => r.raw !== undefined);
  const width = visible.reduce((max, r) => Math.max(max, r.displayKey.length), 0);

  const plainLines = ["safe-env-kit configuration", "─".repeat(32)];
  const colorLines = [`${ANSI.dim}safe-env-kit configuration${ANSI.reset}`, `${ANSI.dim}${"─".repeat(32)}${ANSI.reset}`];

  for (const { displayKey, rule, raw } of visible) {
    const value = displayValue(rule, raw);
    plainLines.push(`${displayKey.padEnd(width + 4)}${value}`);
    colorLines.push(
      `${ANSI.key}${displayKey.padEnd(width + 4)}${ANSI.reset}${rule.type === "secret" ? ANSI.dim : ""}${value}${ANSI.reset}`
    );
  }

  const plain = plainLines.join("\n");
  if (log) {
    const useColor = typeof process !== "undefined" && !!process.stdout && !!process.stdout.isTTY;
    console.log(useColor ? colorLines.join("\n") : plain);
  }
  return plain;
}
