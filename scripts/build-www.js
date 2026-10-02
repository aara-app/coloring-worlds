#!/usr/bin/env node
/* Copies the web app into www/ for Capacitor. Run: npm run build */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const www = path.join(root, "www");
const copy = ["index.html", "css", "js", "assets"];

if (fs.existsSync(www)) fs.rmSync(www, { recursive: true });
fs.mkdirSync(www, { recursive: true });

function cp(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) cp(path.join(src, f), path.join(dst, f));
  } else fs.copyFileSync(src, dst);
}
for (const e of copy) cp(path.join(root, e), path.join(www, e));
// drop raw sidecar json files from media generation
function clean(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) clean(p);
    else if (f.endsWith(".json") || f.startsWith("media-generation")) fs.unlinkSync(p);
  }
}
clean(www);
console.log("www/ built");
