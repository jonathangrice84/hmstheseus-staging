#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const process = require('node:process');

const { chromium } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/';
const artifactsDir = process.argv[3] || 'browser-artifacts';

const pages = [
  {
    name: 'home',
    path: '/',
    titleIncludes: 'Home Page',
    bodyIncludes: 'HMS THESEUS',
  },
  {
    name: 'guestbook',
    path: '/my_guestbook.htm',
    titleIncludes: 'My Guestbook',
    bodyIncludes: 'SIGN THE GUESTBOOK',
  },
  {
    name: 'tour',
    path: '/1947_tour.htm',
    titleIncludes: '1947',
    bodyIncludes: 'FAR EASTERN TOUR',
  },
  {
    name: 'memoriam',
    path: '/memoriam.htm',
    titleIncludes: 'In Memoriam',
    bodyIncludes: 'IN MEMORIAM',
  },
  {
    name: 'faa',
    path: '/faa.htm',
    titleIncludes: 'FAA',
    bodyIncludes: 'Fleet Air Arm Association',
  },
];

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  await fs.mkdir(artifactsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  const issues = [];

  page.on('pageerror', (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  for (const entry of pages) {
    const targetUrl = new URL(entry.path, baseUrl).toString();
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response || !response.ok()) {
      throw new Error(`Failed to load ${targetUrl}: ${response ? response.status() : 'no response'}`);
    }

    if (entry.name === 'guestbook') {
      const historicEntries = await page.locator('#guestbook-entries').innerText();
      if (!historicEntries.includes('Adam Pode')) {
        throw new Error('Historic guestbook entries were not seeded on the page.');
      }

      await page.getByRole('button', { name: 'POST TO GUESTBOOK' }).click();
      await page.waitForFunction(
        () => document.getElementById('guestbook-status')?.textContent?.includes('Please enter your name.'),
        { timeout: 5000 }
      );

      await page.fill('#guestbook-name', 'Jonny Grice');
      await page.fill('#guestbook-location', 'London');
      await page.fill('#guestbook-message', 'A respectful smoke-test entry for the HMS Theseus guestbook.');
      await page.check('#guestbook-consent');
      await page.getByRole('button', { name: 'POST TO GUESTBOOK' }).click();

      await page.waitForFunction(
        () => document.getElementById('guestbook-status')?.textContent?.includes('Thank you. Your entry has been added to the logbook.'),
        { timeout: 5000 }
      );

      const entryText = await page.locator('#guestbook-entries .guestbook-entry').first().innerText();
      if (!entryText.includes('Jonny Grice')) {
        throw new Error('Guestbook entry did not render after submission.');
      }
    }

    await page.screenshot({
      path: path.join(artifactsDir, `${slugify(entry.name)}.png`),
      fullPage: true,
    });

    const title = await page.title();
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

    if (!title.toLowerCase().includes(entry.titleIncludes.toLowerCase())) {
      throw new Error(`Unexpected title for ${entry.path}: "${title}"`);
    }

    if (!bodyText.toLowerCase().includes(entry.bodyIncludes.toLowerCase())) {
      throw new Error(`Missing expected text on ${entry.path}: "${entry.bodyIncludes}"`);
    }

    const images = await page.locator('img').count();
    if (images === 0) {
      throw new Error(`No images found on ${entry.path}`);
    }
  }

  await browser.close();

  if (issues.length) {
    throw new Error(`Browser page errors detected:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
  }

  console.log(`Browser smoke test passed for ${pages.length} pages. Artifacts: ${artifactsDir}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
