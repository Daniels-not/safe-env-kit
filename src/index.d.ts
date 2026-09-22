// Type definitions for safe-env-kit
// The library ships as plain JS; these types are hand-written and kept in
// sync by hand rather than generated, to keep the package dependency-free.

export type EnvType =
  | "string"
  | "number"
  | "boolean"
  | "url"
  | "json"
  | "array"
  | "secret"
  | "enum";

export interface FieldRule {
  type?: EnvType;
  required?: boolean;
  default?: unknown;
  /** Only used when type is "enum". */
  values?: readonly string[];
  /** Only used when type is "number". */
  min?: number;
  max?: number;
  /** Only used when type is "string" (and "secret"). */
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  /**
   * Place this field at a dotted path in the resulting config instead of at
   * its env-var key, e.g. path: "db.host" nests it under config.db.host.
   * Note: nested fields fall outside InferConfig's per-field type inference
   * below — the top-level object is still typed, but a nested destination
   * isn't reconstructed in the type, so treat that shape as `unknown` and
   * narrow it yourself if needed.
   */
  path?: string;
  /** Restrict this rule to specific NODE_ENV values (e.g. ["production"]). */
  environments?: readonly string[];
  validate?: (value: unknown) => boolean;
}

export type Schema = Record<string, FieldRule>;

// Resolve the JS type produced for a single field rule.
type ResolvedType<R extends FieldRule> = R["type"] extends "number"
  ? number
  : R["type"] extends "boolean"
    ? boolean
    : R["type"] extends "url"
      ? URL
      : R["type"] extends "json"
        ? unknown
        : R["type"] extends "array"
          ? string[]
          : R["type"] extends "enum"
            ? R["values"] extends readonly (infer V)[]
              ? V
              : string
            : string;

export type InferConfig<S extends Schema> = {
  readonly [K in keyof S]: ResolvedType<S[K]>;
};

export interface DefineEnvOptions {
  source?: Record<string, string | undefined>;
  environment?: string;
}

/**
 * Validate process.env (or a custom source) against a schema in one pass.
 * Throws ValidationError listing every problem at once. The returned config
 * is frozen and typed according to each field's declared `type`.
 */
export function defineEnv<S extends Schema>(
  schema: S,
  options?: DefineEnvOptions
): InferConfig<S>;

/** Mask a secret for safe logging, e.g. mask("supersecret", 4) -> "supe********". */
export function mask(value: unknown, visible?: number): string;

/** Print (and return) a safe, secret-masked view of a defineEnv() config. */
export function inspect(config: object, options?: { log?: boolean }): string;

/** Parse .env-file syntax from a string into a plain object. */
export function parseEnv(text: string): Record<string, string>;

/**
 * Load a .env-style file into `target` (process.env by default). Existing
 * values win unless `override` is set. Does nothing if the file is missing.
 */
export function loadEnv(
  path?: string,
  options?: { override?: boolean; target?: Record<string, string | undefined> }
): Record<string, string>;

export class EnvError extends Error {}
export class MissingEnvError extends EnvError {
  key: string;
}
export class InvalidEnvError extends EnvError {
  key: string;
  expected: string;
  received: unknown;
}
export class UnknownEnvTypeError extends EnvError {
  key: string;
}
export class ValidationError extends EnvError {
  errors: { key: string; detail: string }[];
}

export interface Env {
  get(key: string, fallback?: string): string | undefined;
  require(key: string): string;
  string(key: string, fallback?: string): string;
  number(key: string, fallback?: number): number;
  boolean(key: string, fallback?: boolean): boolean;
  url(key: string, fallback?: string): URL;
  json<T = unknown>(key: string, fallback?: T): T;
  array(key: string, fallback?: string[]): string[];
  secret(key: string, fallback?: string): string;
  mask(value: unknown, visible?: number): string;
  /** Register an alternate variable name to fall back to (for renames/migrations). */
  alias(key: string, aliasKey: string): void;
  environment(): string;
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;
}

export function createEnv(source?: Record<string, string | undefined>): Env;

declare const env: Env;
export default env;
