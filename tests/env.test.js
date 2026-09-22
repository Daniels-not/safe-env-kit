import test from "node:test";
import assert from "node:assert/strict";
import { createEnv, defineEnv, mask, inspect, loadEnv, parseEnv, MissingEnvError, ValidationError } from "../src/index.js";
import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("get with default", () => {
  const env = createEnv({ A: "1" });
  assert.equal(env.get("A"), "1");
  assert.equal(env.get("B", "x"), "x");
});

test("require throws when missing", () => {
  assert.throws(() => createEnv({}).require("X"), MissingEnvError);
});

test("typed getters", () => {
  const env = createEnv({ N: "42", B: "true", U: "https://a.com", J: '{"a":1}', L: "a, b,c", S: "shh" });
  assert.equal(env.number("N"), 42);
  assert.equal(env.boolean("B"), true);
  assert.equal(env.url("U").hostname, "a.com");
  assert.deepEqual(env.json("J"), { a: 1 });
  assert.deepEqual(env.array("L"), ["a", "b", "c"]);
  assert.equal(env.secret("S"), "shh");
  assert.equal(env.number("MISSING", 3000), 3000);
});

test("invalid number throws", () => {
  assert.throws(() => createEnv({ N: "hello" }).number("N"));
});

test("mask", () => {
  assert.equal(mask("supersecret"), "********");
  assert.equal(mask("supersecret", 4), "supe********");
});

test("defineEnv: defaults, required, frozen", () => {
  const cfg = defineEnv(
    { PORT: { type: "number", default: 3000 }, DB: { type: "string", required: true } },
    { source: { DB: "x" } }
  );
  assert.equal(cfg.PORT, 3000);
  assert.equal(cfg.DB, "x");
  assert.ok(Object.isFrozen(cfg));
});

test("defineEnv: collects all errors", () => {
  try {
    defineEnv(
      { PORT: { type: "number" }, DB: { type: "string", required: true } },
      { source: { PORT: "hello" } }
    );
    assert.fail("should throw");
  } catch (e) {
    assert.ok(e instanceof ValidationError);
    assert.equal(e.errors.length, 2);
  }
});

test("enum, min/max, minLength, custom validate", () => {
  const src = { NODE_ENV: "hello", P: "5", K: "abc", U: "bad name" };
  assert.throws(() => defineEnv({ NODE_ENV: { type: "enum", values: ["development", "test", "production"] } }, { source: src }));
  assert.throws(() => defineEnv({ P: { type: "number", min: 1000 } }, { source: src }));
  assert.throws(() => defineEnv({ K: { type: "string", minLength: 20 } }, { source: src }));
  assert.throws(() => defineEnv({ U: { type: "string", validate: (v) => /^\w+$/.test(v) } }, { source: src }));
});

test("environment-specific required", () => {
  const schema = { DB: { type: "string", required: true, environments: ["production"] } };
  assert.doesNotThrow(() => defineEnv(schema, { source: { NODE_ENV: "development" } }));
  assert.throws(() => defineEnv(schema, { source: { NODE_ENV: "production" } }));
});

test("alias falls back to an alternate variable name", () => {
  const env = createEnv({ DB_URL: "postgres://x" });
  env.alias("DATABASE_URL", "DB_URL");
  assert.equal(env.require("DATABASE_URL"), "postgres://x");
});

test("inspect masks secret fields and leaves the rest readable", () => {
  const cfg = defineEnv(
    { PORT: { type: "number", default: 3000 }, JWT_SECRET: { type: "secret", required: true } },
    { source: { JWT_SECRET: "supersecretvalue" } }
  );
  const output = inspect(cfg, { log: false });
  assert.match(output, /PORT\s+3000/);
  assert.match(output, /JWT_SECRET\s+\*{8}/);
  assert.doesNotMatch(output, /supersecretvalue/);
});

test("pattern constraint rejects a non-matching string", () => {
  assert.throws(() =>
    defineEnv({ SLUG: { type: "string", pattern: /^[a-z0-9-]+$/ } }, { source: { SLUG: "Not A Slug!" } })
  );
  assert.doesNotThrow(() =>
    defineEnv({ SLUG: { type: "string", pattern: /^[a-z0-9-]+$/ } }, { source: { SLUG: "my-slug-1" } })
  );
});

test("nested path groups fields into a sub-object", () => {
  const cfg = defineEnv(
    {
      DB_HOST: { type: "string", path: "db.host", required: true },
      DB_PORT: { type: "number", path: "db.port", default: 5432 },
    },
    { source: { DB_HOST: "localhost" } }
  );
  assert.deepEqual(cfg.db, { host: "localhost", port: 5432 });
  assert.ok(Object.isFrozen(cfg.db));
});

test("parseEnv reads KEY=VALUE syntax, quotes, comments, export", () => {
  const parsed = parseEnv([
    "# a comment",
    "export PORT=3000",
    'NAME="My App"',
    "SINGLE='literal $value'",
    "WITH_COMMENT=5 # not part of the value",
    "",
  ].join("\n"));
  assert.deepEqual(parsed, { PORT: "3000", NAME: "My App", SINGLE: "literal $value", WITH_COMMENT: "5" });
});

test("loadEnv copies file values into target without overriding existing ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "safe-env-kit-"));
  const file = join(dir, ".env");
  writeFileSync(file, "A=from-file\nB=from-file\n");
  const target = { A: "already-set" };
  const result = loadEnv(file, { target });
  assert.equal(target.A, "already-set");
  assert.equal(target.B, "from-file");
  assert.deepEqual(result, { A: "from-file", B: "from-file" });
  unlinkSync(file);
});

test("inspect flattens nested path fields back to dotted keys", () => {
  const cfg = defineEnv(
    { DB_HOST: { type: "string", path: "db.host", required: true }, TOKEN: { type: "secret", required: true } },
    { source: { DB_HOST: "localhost", TOKEN: "supersecretvalue" } }
  );
  const output = inspect(cfg, { log: false });
  assert.match(output, /db\.host\s+localhost/);
  assert.match(output, /TOKEN\s+\*{8}/);
});
