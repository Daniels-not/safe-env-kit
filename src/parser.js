import { InvalidEnvError } from "./errors.js";

export const isEmpty = (v) => v === undefined || v === null || v === "";

export function parseString(key, raw) { return raw; }

export function parseNumber(key, raw) {
  const n = Number(raw);
  if (raw.trim() === "" || Number.isNaN(n)) throw new InvalidEnvError(key, "number", raw);
  return n;
}

export function parseBoolean(key, raw) {
  const v = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  throw new InvalidEnvError(key, "boolean (true/false/1/0/yes/no/on/off)", raw);
}

export function parseUrl(key, raw) {
  try { return new URL(raw); } catch { throw new InvalidEnvError(key, "valid URL", raw); }
}

export function parseJson(key, raw) {
  try { return JSON.parse(raw); } catch { throw new InvalidEnvError(key, "valid JSON", raw); }
}

export function parseArray(key, raw) {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseSecret(key, raw) {
  if (raw.trim() === "") throw new InvalidEnvError(key, "non-empty secret", "");
  return raw;
}

export const parsers = {
  string: parseString, number: parseNumber, boolean: parseBoolean,
  url: parseUrl, json: parseJson, array: parseArray, secret: parseSecret,
};
