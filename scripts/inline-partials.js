#!/usr/bin/env node
/**
 * Injects partials/site-nav.html into every pages/*.html block marked with
 * <!-- SITE_NAV_PARTIAL_BEGIN --> ... <!-- SITE_NAV_PARTIAL_END -->.
 * Run after editing the partial: npm run partials
 * Vercel build runs this before webpack (see package.json).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const partialPath = path.join(ROOT, "partials", "site-nav.html");
const partialRaw = fs.readFileSync(partialPath, "utf8").replace(/\s+$/, "");
const partial = `${partialRaw}\n`;

const markerBegin = "<!-- SITE_NAV_PARTIAL_BEGIN -->";
const markerEnd = "<!-- SITE_NAV_PARTIAL_END -->";
const pattern = new RegExp(
    `${escapeRe(markerBegin)}[\\s\\S]*?${escapeRe(markerEnd)}`,
    "g",
);

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const pagesDir = path.join(ROOT, "pages");
let updated = 0;
let skipped = 0;

for (const file of fs.readdirSync(pagesDir)) {
    if (!file.endsWith(".html")) continue;
    const fp = path.join(pagesDir, file);
    let html = fs.readFileSync(fp, "utf8");
    if (!html.includes(markerBegin)) {
        skipped += 1;
        continue;
    }
    const next = html.replace(pattern, `${markerBegin}\n${partial}    ${markerEnd}\n`);
    if (next === html) {
        console.warn(`[inline-partials] no replacement made (check markers): ${file}`);
        skipped += 1;
        continue;
    }
    fs.writeFileSync(fp, next, "utf8");
    updated += 1;
    console.log(`[inline-partials] updated ${file}`);
}

console.log(`[inline-partials] done: ${updated} updated, ${skipped} skipped`);
