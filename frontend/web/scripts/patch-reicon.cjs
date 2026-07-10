#!/usr/bin/env node
/**
 * reicon-react marks createIcon.js with "use client", but icon modules call
 * createIcon() at import time. Under Next.js App Router that turns createIcon
 * into a client reference and breaks SSR with:
 *   (0 , createIcon.default) is not a function
 * Strip the directive after install so icons work as plain React components.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "reicon-react",
  "createIcon.js"
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const src = fs.readFileSync(target, "utf8");
const next = src.replace(/^['"]use client['"];\r?\n/, "");
if (next !== src) {
  fs.writeFileSync(target, next);
  console.log("[patch-reicon] removed 'use client' from createIcon.js");
}
