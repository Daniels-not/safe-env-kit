import { parsers, isEmpty } from "./parser.js";
import { MissingEnvError } from "./errors.js";
import { mask } from "./mask.js";

export function createEnv(source = process.env) {
  // canonicalKey -> [alternateName, ...]. Lets a project migrate a variable
  // name without breaking whichever name is still set in the environment.
  const aliases = Object.create(null);

  const alias = (key, aliasKey) => {
    if (!aliases[key]) aliases[key] = [];
    aliases[key].push(aliasKey);
  };

  const resolveRaw = (key) => {
    if (!isEmpty(source[key])) return source[key];
    for (const alt of aliases[key] ?? []) {
      if (!isEmpty(source[alt])) return source[alt];
    }
    return undefined;
  };

  const get = (key, fallback) => {
    const raw = resolveRaw(key);
    return isEmpty(raw) ? fallback : raw;
  };

  const require = (key) => {
    const raw = resolveRaw(key);
    if (isEmpty(raw)) throw new MissingEnvError(key);
    return raw;
  };

  const typed = (type) => (key, fallback) => {
    const raw = resolveRaw(key);
    if (isEmpty(raw)) {
      if (fallback !== undefined) return fallback;
      throw new MissingEnvError(key);
    }
    return parsers[type](key, raw);
  };

  const environment = () => source.NODE_ENV ?? "development";

  return {
    get, require, alias,
    string: typed("string"), number: typed("number"), boolean: typed("boolean"),
    url: typed("url"), json: typed("json"), array: typed("array"), secret: typed("secret"),
    mask,
    environment,
    isDevelopment: () => environment() === "development",
    isProduction: () => environment() === "production",
    isTest: () => environment() === "test",
  };
}

export default createEnv();
