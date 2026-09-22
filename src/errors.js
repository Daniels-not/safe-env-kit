export class EnvError extends Error {
  constructor(message) { super(message); this.name = this.constructor.name; }
}
export class MissingEnvError extends EnvError {
  constructor(key) { super(`Required environment variable "${key}" is missing.`); this.key = key; }
}
export class InvalidEnvError extends EnvError {
  constructor(key, expected, received) {
    super(`Invalid environment variable "${key}". Expected ${expected}, received ${JSON.stringify(received)}.`);
    this.key = key; this.expected = expected; this.received = received;
  }
}
export class UnknownEnvTypeError extends EnvError {
  constructor(key, type) { super(`Unknown type "${type}" for "${key}".`); this.key = key; }
}
export class ValidationError extends EnvError {
  constructor(errors) {
    const lines = errors.map((e) => `✗ ${e.key}\n  ${e.detail}`).join("\n\n");
    super(`safe-env validation failed\n\n${lines}\n\n${errors.length} configuration error${errors.length === 1 ? "" : "s"} found.`);
    this.errors = errors;
  }
}
