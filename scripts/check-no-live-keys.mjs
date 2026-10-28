import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", ".next", ".git", "data", ".projects"]);
const liveKey = /(?:sk|rk|rkcs|pk)_live_[A-Za-z0-9]{8,}/;
const committedTestKey = /(?:sk|rk|rkcs|pk)_test_[A-Za-z0-9]{8,}/;
const webhookSecret = /whsec_[A-Za-z0-9]{8,}/;

const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|md|json|css|example|toml)$/.test(name)) continue;
    if (name === "package-lock.json") continue;
    const text = readFileSync(full, "utf8");
    if (liveKey.test(text) || committedTestKey.test(text) || webhookSecret.test(text)) {
      offenders.push(path.relative(root, full));
    }
  }
}

walk(root);

const forbiddenPaths = [
  ".env",
  ".env.local",
  ".projects/state.local.json",
];

try {
  const listed = execSync("git ls-files -z", { cwd: root, encoding: "utf8" });
  for (const rel of listed.split("\0").filter(Boolean)) {
    if (
      forbiddenPaths.includes(rel) ||
      rel.startsWith(".projects/") ||
      (rel.startsWith(".env") && rel !== ".env.example")
    ) {
      offenders.push(rel);
      continue;
    }
    const full = path.join(root, rel);
    const buf = readFileSync(full);
    if (buf.includes(0)) continue;
    const text = buf.toString("utf8");
    if (liveKey.test(text) || committedTestKey.test(text) || webhookSecret.test(text)) {
      offenders.push(rel);
    }
  }
} catch {
  // Not a git checkout yet.
}

if (offenders.length > 0) {
  console.error(`Refusing to keep Stripe keys in: ${offenders.join(", ")}`);
  process.exit(1);
}

console.log("No live or committed test Stripe keys in source.");
