#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173/';

const htmlFiles = [];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
    } else if (/\.(html?|xhtml)$/i.test(entry.name)) {
      htmlFiles.push(fullPath);
    }
  }
}

function normalizeInternalRef(ref) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^(mailto:|javascript:|tel:)/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function getAttributeValues(html, attrName) {
  const values = [];
  const regex = new RegExp(`\\b${attrName}\\s*=\\s*([\"'])(.*?)\\1`, 'gi');
  let match;
  while ((match = regex.exec(html))) {
    values.push(match[2]);
  }
  return values;
}

async function checkLocalLinks() {
  const broken = [];

  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    const refs = [
      ...getAttributeValues(html, 'href'),
      ...getAttributeValues(html, 'src'),
    ];

    for (const ref of refs) {
      const normalized = normalizeInternalRef(ref);
      if (!normalized) continue;

      const [rawPath] = normalized.split('#');
      const [withoutQuery] = rawPath.split('?');
      const decodedPath = decodeURI(withoutQuery);
      const targetPath = decodedPath.startsWith('/')
        ? path.join(rootDir, decodedPath.slice(1))
        : path.resolve(path.dirname(file), decodedPath);

      const candidates = [targetPath];
      if (!path.extname(targetPath)) {
        candidates.push(`${targetPath}.html`);
        candidates.push(`${targetPath}.htm`);
        candidates.push(path.join(targetPath, 'index.html'));
        candidates.push(path.join(targetPath, 'index.htm'));
      }

      let found = false;
      for (const candidate of candidates) {
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            found = true;
            break;
          }
        } catch {
          // keep checking candidates
        }
      }

      if (!found) {
        broken.push({
          file: path.relative(rootDir, file),
          ref,
        });
      }
    }
  }

  return broken;
}

async function waitForBaseUrl() {
  const startedAt = Date.now();
  const timeoutMs = 20_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // keep trying
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function smokeTestPages() {
  const urls = [
    '/',
    '/index.html',
    '/my_guestbook.htm',
    '/1947_tour.htm',
  ];

  for (const url of urls) {
    const res = await fetch(new URL(url, baseUrl));
    if (!res.ok) {
      throw new Error(`Smoke test failed for ${url}: ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(`Smoke test returned empty content for ${url}`);
    }
  }
}

await walk(rootDir);

if (!htmlFiles.length) {
  throw new Error('No HTML files found to test.');
}

const broken = await checkLocalLinks();
if (broken.length) {
  const sample = broken
    .slice(0, 25)
    .map((item) => `- ${item.file} -> ${item.ref}`)
    .join('\n');
  throw new Error(`Broken internal links found:\n${sample}${broken.length > 25 ? '\n…' : ''}`);
}

await waitForBaseUrl();
await smokeTestPages();

console.log(`Checked ${htmlFiles.length} HTML files, no broken internal links found, and smoke tests passed at ${baseUrl}`);
