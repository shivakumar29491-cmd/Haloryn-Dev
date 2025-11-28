/**
 * Quick pre-packaging size report to see what's inflating the app bundle.
 * Run: npm run analyze:bundle
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const targets = [
  path.join(root, "electron"),
  path.join(root, "node_modules")
];

function human(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(1)} ${units[i]}`;
}

function dirSize(startPath) {
  let total = 0;
  const stack = [startPath];
  while (stack.length) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(current);
      for (const e of entries) stack.push(path.join(current, e));
    } else {
      total += stat.size;
    }
  }
  return total;
}

function listTop(dir, limit = 20) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir);
  const rows = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
    rows.push({ name: entry, size: dirSize(full) });
  }
  return rows.sort((a, b) => b.size - a.size).slice(0, limit);
}

for (const target of targets) {
  if (!fs.existsSync(target)) {
    console.log(`Skip ${target} (missing)`);
    continue;
  }
  const total = dirSize(target);
  console.log(`\n${path.basename(target)} total: ${human(total)}`);
  const top = listTop(target);
  for (const { name, size } of top) {
    console.log(`  ${name.padEnd(25)} ${human(size)}`);
  }
}
