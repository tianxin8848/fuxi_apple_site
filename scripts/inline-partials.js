#!/usr/bin/env node
/**
 * Injects shared partials into pages/*.html:
 * - partials/critical-head.html Å® <!-- CRITICAL_HEAD_PARTIAL_BEGIN/END -->
 * - partials/site-nav.html      Å® <!-- SITE_NAV_PARTIAL_BEGIN/END -->
 * Run after editing partials: npm run partials
 * Vercel build runs this before webpack (see package.json).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const partials = [
    {
        name: "critical-head",
        file: "critical-head.html",
        markerBegin: "<!-- CRITICAL_HEAD_PARTIAL_BEGIN -->",
        markerEnd: "<!-- CRITICAL_HEAD_PARTIAL_END -->",
    },
    {
        name: "site-nav",
        file: "site-nav.html",
        markerBegin: "<!-- SITE_NAV_PARTIAL_BEGIN -->",
        markerEnd: "<!-- SITE_NAV_PARTIAL_END -->",
    },
];

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadPartial(file) {
    const partialPath = path.join(ROOT, "partials", file);
    const partialRaw = fs.readFileSync(partialPath, "utf8").replace(/\s+$/, "");
    return `${partialRaw}\n`;
}

const pagesDir = path.join(ROOT, "pages");
let updatedFiles = 0;
let skippedFiles = 0;

for (const file of fs.readdirSync(pagesDir)) {
    if (!file.endsWith(".html")) continue;
    const fp = path.join(pagesDir, file);
    let html = fs.readFileSync(fp, "utf8");
    let next = html;
    let fileUpdated = false;

    for (const partial of partials) {
        if (!next.includes(partial.markerBegin)) {
            continue;
        }
        const content = loadPartial(partial.file);
        const pattern = new RegExp(
            `${escapeRe(partial.markerBegin)}[\\s\\S]*?${escapeRe(partial.markerEnd)}`,
            "g",
        );
        const replaced = next.replace(
            pattern,
            `${partial.markerBegin}\n${content}    ${partial.markerEnd}\n`,
        );
        if (replaced === next) {
            console.warn(`[inline-partials] no replacement made for ${partial.name}: ${file}`);
            continue;
        }
        next = replaced;
        fileUpdated = true;
    }

    if (!fileUpdated) {
        skippedFiles += 1;
        continue;
    }

    fs.writeFileSync(fp, next, "utf8");
    updatedFiles += 1;
    console.log(`[inline-partials] updated ${file}`);
}

console.log(`[inline-partials] done: ${updatedFiles} updated, ${skippedFiles} skipped`);
