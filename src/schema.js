import { parsers, isEmpty } from "./parser.js";
import { MissingEnvError, InvalidEnvError, UnknownEnvTypeError, ValidationError } from "./errors.js";

// Hidden key used to attach the original schema to a resolved config object,
// so inspect() can tell which fields are secrets (and where nested fields
// live) without changing the public (frozen, enumerable) shape of the
// config itself.
export const SCHEMA = Symbol("safe-env-kit.schema");

function resolveOne(key, rule, source) {
  const type = rule.type ?? "string";
  const raw = source[key];

  if (isEmpty(raw)) {
    if ("default" in rule) return rule.default;
    if (rule.required) throw new MissingEnvError(key);
    return undefined;
  }

  let value;
  if (type === "enum") {
    if (!Array.isArray(rule.values)) throw new UnknownEnvTypeError(key, "enum without values");
    if (!rule.values.includes(raw)) {
      throw new InvalidEnvError(key, `one of ${rule.values.join(", ")}`, raw);
    }
    value = raw;
  } else {
    const parser = parsers[type];
    if (!parser) throw new UnknownEnvTypeError(key, type);
    value = parser(key, raw);
  }

  if (type === "number") {
    if (rule.min !== undefined && value < rule.min) throw new InvalidEnvError(key, `number >= ${rule.min}`, raw);
    if (rule.max !== undefined && value > rule.max) throw new InvalidEnvError(key, `number <= ${rule.max}`, raw);
  }
  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength)
      throw new InvalidEnvError(key, `string with at least ${rule.minLength} characters`, "(too short)");
    if (rule.maxLength !== undefined && value.length > rule.maxLength)
      throw new InvalidEnvError(key, `string with at most ${rule.maxLength} characters`, "(too long)");
    if (rule.pattern !== undefined) {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
      if (!re.test(value)) throw new InvalidEnvError(key, `string matching ${re}`, raw);
    }
  }
  if (rule.validate && rule.validate(value) === false) {
    throw new InvalidEnvError(key, "value passing custom validation", raw);
  }
  return value;
}

// Writes a value into a (possibly nested) location on an object, creating
// intermediate objects as needed. "db.host" -> obj.db.host
function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cur[part] !== "object" || cur[part] === null) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

// Freezes an object and every plain-object value nested inside it, without
// touching non-plain values (URL instances, arrays) that don't need it.
function deepFreeze(obj) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof URL)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export function defineEnv(schema, { source = process.env, environment } = {}) {
  const current = environment ?? source.NODE_ENV ?? "development";
  const result = {};
  const errors = [];

  for (const [key, rule] of Object.entries(schema)) {
    const active = !rule.environments || rule.environments.includes(current);
    const effective = active ? rule : { ...rule, required: false };
    try {
      const v = resolveOne(key, effective, source);
      if (v !== undefined) {
        if (rule.path) setPath(result, rule.path, v);
        else result[key] = v;
      }
    } catch (e) {
      if (e.key) errors.push({ key, detail: e.message });
      else throw e;
    }
  }

  if (errors.length) throw new ValidationError(errors);

  Object.defineProperty(result, SCHEMA, { value: schema, enumerable: false });
  return deepFreeze(result);
}
