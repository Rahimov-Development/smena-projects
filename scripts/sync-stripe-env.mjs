import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const configPath = path.join(os.homedir(), ".config", "stripe", "config.toml");
const config = readFileSync(configPath, "utf8");

function readValue(key) {
  const match = config.match(
    new RegExp(`^${key}\\s*=\\s*['"]([^'"]+)['"]`, "m"),
  );
  return match?.[1] ?? "";
}

const live = readValue("live_mode_api_key");
if (live) {
  console.error(
    "Stripe CLI has a live key configured. Refusing to sync. Use a sandbox profile with no live key.",
  );
  process.exit(1);
}

const secret = readValue("test_mode_api_key");
if (!/^(?:sk_test_|rk_test_|rkcs_test_)/.test(secret) || secret.includes("_live_")) {
  console.error("Refusing to write a Stripe key that is not test mode.");
  process.exit(1);
}

const envPath = path.join(process.cwd(), ".env.local");
let body = "";
try {
  body = readFileSync(envPath, "utf8");
} catch {
  body = "";
}

function upsert(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  const suffix = source.length === 0 || source.endsWith("\n") ? "" : "\n";
  return `${source}${suffix}${line}\n`;
}

body = upsert(body, "STRIPE_SECRET_KEY", secret);
body = upsert(body, "NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3847");
if (!/^OPENROUTER_API_KEY=/m.test(body)) body = upsert(body, "OPENROUTER_API_KEY", "");
if (!/^OPENROUTER_MODEL=/m.test(body)) {
  body = upsert(body, "OPENROUTER_MODEL", "openai/gpt-4o-mini");
}
if (!/^STRIPE_WEBHOOK_SECRET=/m.test(body)) {
  body = upsert(body, "STRIPE_WEBHOOK_SECRET", "");
}

writeFileSync(envPath, body);
console.log("Wrote .env.local from the Stripe CLI test-mode profile. No live key was used.");
