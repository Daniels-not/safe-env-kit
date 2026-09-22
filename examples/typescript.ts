// Usage from TypeScript. The .d.ts ships with the package (no @types
// install needed), and infers each field's resolved type from the schema.
import { defineEnv, inspect } from "safe-env-kit";

const config = defineEnv({
  PORT: { type: "number", default: 3000 },
  NODE_ENV: {
    type: "enum",
    values: ["development", "test", "production"] as const,
    default: "development",
  },
  DATABASE_URL: { type: "string", required: true, environments: ["production"] },
  JWT_SECRET: { type: "secret", required: true, minLength: 20 },
});

// config.PORT: number
// config.NODE_ENV: "development" | "test" | "production"
// config.DATABASE_URL: string
// config.JWT_SECRET: string
console.log(`starting on port ${config.PORT} in ${config.NODE_ENV} mode`);

inspect(config); // JWT_SECRET prints masked, everything else prints plainly
