# safe-env-kit

Validate, manage, and safely access environment variables. Zero runtime dependencies, Node 18+, works from JavaScript and TypeScript.

> This does not encrypt anything. Keep `.env` out of Git, never log secrets, and use your host's secret manager in production.

## Install

```bash
npm install safe-env-kit
```

## Quick start

```js
import { defineEnv } from "safe-env-kit";

const config = defineEnv({
  PORT: { type: "number", default: 3000 },
  DATABASE_URL: { type: "string", required: true, environments: ["production"] },
  NODE_ENV: { type: "enum", values: ["development", "test", "production"], default: "development" },
  JWT_SECRET: { type: "secret", required: true },
});
```

Types: `string`, `number`, `boolean`, `url`, `json`, `array`, `secret`, `enum`.
Constraints: `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate(value)`.
All errors are reported together, and the result is deep-frozen.

## Loading a .env file

There's no dependency on `dotenv` — a tiny parser ships in the package:

```js
import { loadEnv } from "safe-env-kit";

loadEnv(); // reads .env into process.env, skipping keys already set
loadEnv(".env.local", { override: true });
```

Real environment variables always win unless you pass `override: true` — so a `.env` file is safe to keep around even in production, where you'd want the platform's real values to take priority.

## String constraints

```js
USERNAME: {
  type: "string",
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-z0-9_]+$/,
}
```

## Nested / namespaced config

Group related variables under a sub-object with `path`:

```js
const config = defineEnv({
  DB_HOST: { type: "string", path: "db.host", required: true },
  DB_PORT: { type: "number", path: "db.port", default: 5432 },
});

config.db.host; // instead of a flat config.DB_HOST
```

## Simple access

```js
import env from "safe-env-kit";

env.get("API_URL", "http://localhost");
env.number("PORT", 3000);
env.require("DATABASE_URL");
env.mask(env.secret("JWT_SECRET"), 4);

// fall back to an old variable name during a migration
env.alias("DATABASE_URL", "DB_URL");
```

## Inspecting a config safely

```js
import { inspect } from "safe-env-kit";

inspect(config);
// safe-env-kit configuration
// ────────────────────────────────
// PORT            3000
// DATABASE_URL    postgres://user:pass@host/db
// JWT_SECRET      ********
```

Any field typed `"secret"` is masked automatically, and nested `path` fields print back out as dotted keys (`db.host`). In an interactive terminal the output is colorized; piped to a file or another process, it's plain text.

## TypeScript

Type definitions ship with the package (no `@types` install needed). `defineEnv`'s return type is inferred from the schema you pass it:

```ts
import { defineEnv } from "safe-env-kit";

const config = defineEnv({
  PORT: { type: "number", default: 3000 },
  NODE_ENV: { type: "enum", values: ["development", "test", "production"] as const },
});

config.PORT;      // number
config.NODE_ENV;  // "development" | "test" | "production"
```

Fields using nested `path` still validate correctly but fall outside the per-field type inference — treat that part of the config as `unknown` and narrow it yourself if you need strict types there. See `examples/typescript.ts` for a fuller example.

## CLI

```bash
npx safe-env-kit init                # create .env.example and schema.json starters
npx safe-env-kit check                # check .env.example keys exist in process.env
npx safe-env-kit check schema.json    # validate process.env against a JSON schema
npx safe-env-kit scan                 # best-effort search for hard-coded secrets
npx safe-env-kit diff                 # compare .env.example against .env (or process.env)
```

`scan` exits with a non-zero status on any finding, so it works as a pre-commit hook:

```bash
# .git/hooks/pre-commit (or a husky hook)
npx safe-env-kit scan || exit 1
```

`diff` reports variables that are documented in `.env.example` but not set, and — when a `.env` file exists — variables that are set but undocumented, so your example file doesn't quietly drift out of sync with reality.

`scan` is a best-effort heuristic, not a guarantee — review anything it flags by hand.

## What's next

Ideas not yet built:
- A `--watch` mode for `scan` in CI, and a `.safeenvignore` file for excluding paths from it
- Structured JSON output (`--json`) for `check`/`diff`/`scan`, for piping into other tooling
- A bundler plugin (Vite/webpack) that fails the build on a missing required variable, instead of only failing at runtime

## Project structure

```
safe-env-kit/
├── src/             # library source (ESM) + index.d.ts type definitions
├── bin/cli.js        # check / init / scan / diff
├── tests/            # node --test
├── examples/
└── package.json
```

## License

MIT
