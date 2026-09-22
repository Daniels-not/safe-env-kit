#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { defineEnv } from "../src/index.js";
import { parseEnv } from "../src/dotenv.js";
import { ValidationError } from "../src/errors.js";

const [cmd = "help", arg] = process.argv.slice(2);

// ---------- check ----------

function check() {
  if (arg) {
    const schema = JSON.parse(readFileSync(arg, "utf8"));
    try {
      defineEnv(schema);
      console.log("✓ All variables valid");
    } catch (e) {
      if (e instanceof ValidationError) {
        console.error(e.message);
        process.exit(1);
      }
      throw e;
    }
    return;
  }

  if (!existsSync(".env.example")) {
    console.error("No .env.example found.");
    process.exit(1);
  }

  const keys = readFileSync(".env.example", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim());

  let missing = 0;
  console.log("safe-env check\n");
  for (const key of keys) {
    const ok = process.env[key] !== undefined && process.env[key] !== "";
    if (!ok) missing++;
    console.log(`${ok ? "✓" : "✗"} ${key}`);
  }
  console.log(missing ? `\n${missing} variable${missing === 1 ? " is" : "s are"} missing.` : "\nAll variables present.");
  process.exit(missing ? 1 : 0);
}

// ---------- init ----------

function init() {
  if (existsSync(".env.example")) {
    console.log("⚠ .env.example already exists — leaving it as is.");
  } else {
    const lines = ["# Copy this file to .env and fill in real values.", ""];

    if (existsSync("schema.json")) {
      const schema = JSON.parse(readFileSync("schema.json", "utf8"));
      for (const [key, rule] of Object.entries(schema)) {
        const hint = rule.default !== undefined ? ` # default: ${rule.default}` : rule.required ? " # required" : "";
        lines.push(`${key}=${hint}`);
      }
    } else {
      lines.push("PORT=3000", "DATABASE_URL=", "JWT_SECRET=");
    }

    writeFileSync(".env.example", lines.join("\n") + "\n");
    console.log("✓ Created .env.example");
  }

  if (existsSync("schema.json")) {
    console.log("⚠ schema.json already exists — leaving it as is.");
  } else {
    const starter = {
      PORT: { type: "number", default: 3000 },
      NODE_ENV: { type: "enum", values: ["development", "test", "production"], default: "development" },
    };
    writeFileSync("schema.json", JSON.stringify(starter, null, 2) + "\n");
    console.log("✓ Created schema.json");
  }
}

// ---------- scan ----------

const SECRET_NAME = /(SECRET|TOKEN|API[_-]?KEY|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)/i;
const ASSIGNMENT = /([A-Za-z_$][\w]*)\s*[:=]\s*["']([^"']{8,})["']/g;
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);

function collectFiles(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (CODE_EXT.has(extname(entry))) out.push(full);
  }
}

function scan() {
  console.log("safe-env-kit security scan\n");

  const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
  const envIgnored = /(^|\n)\s*\.env\s*(\n|$)/.test(gitignore) || /(^|\n)\s*\.env\*/.test(gitignore);
  console.log(envIgnored ? "✓ .env is ignored by Git" : "✗ .env is not listed in .gitignore");

  const files = [];
  try {
    collectFiles(".", files);
  } catch {
    // unreadable directory — skip rather than crash the scan
  }

  const findings = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("process.env")) return;
      ASSIGNMENT.lastIndex = 0;
      let match;
      while ((match = ASSIGNMENT.exec(line))) {
        if (SECRET_NAME.test(match[1])) findings.push(`${file}:${idx + 1}`);
      }
    });
  }

  if (findings.length === 0) {
    console.log("✓ No obvious hard-coded secrets detected");
  } else {
    findings.slice(0, 20).forEach((loc) => console.log(`⚠ Possible secret:\n  ${loc}`));
    if (findings.length > 20) console.log(`  ...and ${findings.length - 20} more`);
  }

  console.log("\nThis is a best-effort scan, not a guarantee every secret will be caught — review matches by hand.");

  // Non-zero on any finding so `scan` can be dropped into a pre-commit hook
  // or CI step and actually block on trouble, not just print it.
  process.exit(envIgnored && findings.length === 0 ? 0 : 1);
}

// ---------- diff ----------

function diff() {
  if (!existsSync(".env.example")) {
    console.error("No .env.example found.");
    process.exit(1);
  }

  const exampleKeys = readFileSync(".env.example", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim());

  const hasEnvFile = existsSync(".env");
  const actual = hasEnvFile ? parseEnv(readFileSync(".env", "utf8")) : process.env;
  const source = hasEnvFile ? ".env" : "process.env";

  console.log(`safe-env-kit diff — .env.example vs ${source}\n`);

  const missing = exampleKeys.filter((k) => !actual[k]);
  if (missing.length) {
    console.log("Missing (documented, not set):");
    missing.forEach((k) => console.log(`  ✗ ${k}`));
  } else {
    console.log("✓ Nothing missing from .env.example");
  }

  if (hasEnvFile) {
    console.log("");
    const extra = Object.keys(actual).filter((k) => !exampleKeys.includes(k));
    if (extra.length) {
      console.log("Undocumented (set in .env, not in .env.example):");
      extra.forEach((k) => console.log(`  ⚠ ${k}`));
    } else {
      console.log("✓ Nothing undocumented");
    }
  }

  process.exit(missing.length ? 1 : 0);
}

// ---------- dispatch ----------

const USAGE = `Usage: safe-env-kit <command> [args]

  check [schema.json]  validate against .env.example or a schema file
  init                 create .env.example and schema.json starter files
  scan                 best-effort search for hard-coded secrets (exits 1 on findings)
  diff                 compare .env.example against .env or process.env`;

if (cmd === "check") check();
else if (cmd === "init") init();
else if (cmd === "scan") scan();
else if (cmd === "diff") diff();
else console.log(USAGE);
