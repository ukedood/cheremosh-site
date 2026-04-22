import puppeteer from 'puppeteer';
import { createHash } from 'crypto';
import { writeFileSync, readFileSync, mkdirSync, existsSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import https from 'https';
import http from 'http';
import { unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'https://sites.google.com/site/ukrainetour2011';
const START = `${BASE}/home`;
const IMG_DIR = join(ROOT, 'public/images');
const DATA_DIR = join(ROOT, 'data');
const PAGES_FILE = join(DATA_DIR, 'pages.json');

mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

const imgLimit = pLimit(4);
const imgCache = new Map();

function urlToSlug(rawUrl) {
  let u = rawUrl.split('?')[0].split('#')[0];
  u = u.replace(/https?:\/\/sites\.google\.com\/site\/ukrainetour2011/, '');
  u = u.replace(/^\//, '').replace(/\/$/, '');
  if (!u || u === 'home') return 'home';
  return u;
}

function prettify(slug) {
  return slug.split(/[-_\/]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function canonicalize(url) {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, '');
  } catch {
    return url.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}

function saveProgress(pages) {
  const nav = buildNav(pages);
  writeFileSync(PAGES_FILE, JSON.stringify({ pages, nav }, null, 2));
}

async function downloadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  if (!src.startsWith('http')) { imgCache.set(src, src); return src; }

  const hash = createHash('sha1').update(src).digest('hex').slice(0, 12);
  const filename = `${hash}.jpg`;
  const localPath = `/images/${filename}`;
  const filePath = join(IMG_DIR, filename);

  if (existsSync(filePath)) { imgCache.set(src, localPath); return localPath; }

  try {
    await new Promise((resolve, reject) => {
      const protocol = src.startsWith('https') ? https : http;
      const file = createWriteStream(filePath);
      const req = protocol.get(src, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
          file.close(); unlink(filePath).catch(() => {});
          downloadImage(res.headers.location).then(p => { imgCache.set(src, p); resolve(); }).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close(); unlink(filePath).catch(() => {});
          reject(new Error(`HTTP ${res.statusCode}`)); return;
        }
        res.pipe(file);
        file.on('finish', resolve);
        file.on('error', e => { unlink(filePath).catch(() => {}); reject(e); });
      });
      req.on('error', e => { file.close(); unlink(filePath).catch(() => {}); reject(e); });
      req.setTimeout(30000, () => req.destroy(new Error('img timeout')));
    });
    imgCache.set(src, localPath);
    return localPath;
  } catch (err) {
    console.error(`  [img-fail] ${src.slice(0, 80)}: ${err.message}`);
    imgCache.set(src, src);
    return src;
  }
}

async function extractContent(page, url) {
  return await page.evaluate((baseUrl) => {
    const links = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('/site/ukrainetour2011')) {
        try {
          const abs = new URL(href, baseUrl).href.split('?')[0].split('#')[0].replace(/\/$/, '');
          links.push(abs);
        } catch {}
      }
    });

    const imgSrcs = [];
    document.querySelectorAll('img[src]').forEach(img => {
      const s = img.getAttribute('src') || '';
      if (s.startsWith('http')) imgSrcs.push(s);
    });

    const h1 = document.querySelector('h1');
    let title = h1?.textContent?.trim();
    if (!title) {
      const docTitle = document.title || '';
      title = docTitle.split(/[|\-–]/)[0].trim();
    }

    // New Google Sites puts the page heading in [role=main] but body content
    // in .QZ3zWd (a sibling). Try to find the largest content container.
    const contentSelectors = [
      '.QZ3zWd',                      // New Google Sites body content
      '.hJDwNd', '.IZ65Hb',
      '#sites-canvas-main-content', '#sites-canvas-main',
      'article', 'main',
    ];
    let contentEl = null;
    for (const sel of contentSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 50) { contentEl = el; break; }
    }
    // If still nothing, grab the div with the most text (excluding nav/header)
    if (!contentEl) {
      const bodyDivs = [...document.querySelectorAll('div')]
        .filter(d => !d.closest('nav') && !d.closest('header') && !d.closest('footer'))
        .sort((a, b) => (b.innerText?.length || 0) - (a.innerText?.length || 0));
      contentEl = bodyDivs[0] || document.body;
    }
    // Also grab the title heading separately if it's not in contentEl
    const titleHeading = document.querySelector('[role="main"] h1, [role="main"] h2');
    if (titleHeading && contentEl && !contentEl.contains(titleHeading)) {
      const h1Clone = titleHeading.cloneNode(true);
      contentEl.insertBefore(h1Clone, contentEl.firstChild);
    }

    ['script','style','noscript','nav','header','footer',
     '[aria-label="Site navigation"]','[aria-label="Site pages"]',
     '.VfPpkd-ksKsZd','[data-is-nav]'].forEach(sel => {
      contentEl?.querySelectorAll(sel).forEach(el => el.remove());
    });

    contentEl?.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('/site/ukrainetour2011')) {
        let s = href.split('?')[0].split('#')[0].replace(/\/$/, '');
        s = s.replace(/https?:\/\/sites\.google\.com\/site\/ukrainetour2011/, '').replace(/^\//, '').replace(/\/$/, '');
        a.setAttribute('href', s && s !== 'home' ? `/${s}` : '/');
      } else if (/^https?:\/\//.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    contentEl?.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
    contentEl?.querySelectorAll('[onclick],[onload],[onerror]').forEach(el => {
      ['onclick','onload','onerror'].forEach(attr => el.removeAttribute(attr));
    });

    let html = (contentEl?.innerHTML || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim();

    return { title, html, links, imgSrcs };
  }, url);
}

async function scrapePage(browser, url) {
  const slug = urlToSlug(url);
  console.log(`[scrape] ${slug}`);

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    let result;
    try {
      result = await extractContent(page, url);
    } catch (evalErr) {
      // Frame detached — reload and retry once
      console.log(`  [retry] ${slug}: ${evalErr.message}`);
      await page.close().catch(() => {});
      page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 4000));
      result = await extractContent(page, url);
    }

    await page.close().catch(() => {});

    // Download images
    const imgResults = await Promise.all(
      result.imgSrcs.map(src => imgLimit(() => downloadImage(src)))
    );

    let html = result.html;
    result.imgSrcs.forEach((src, i) => {
      const local = imgResults[i];
      if (local !== src) html = html.split(src).join(local);
    });
    html = html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" ');

    return {
      url, slug,
      title: result.title || prettify(slug),
      html,
      newLinks: result.links,
    };
  } catch (err) {
    console.error(`  [page-fail] ${url}: ${err.message}`);
    await page?.close().catch(() => {});
    return null;
  }
}

function buildNav(pageList) {
  const map = {};
  const roots = [];
  const sorted = [...pageList].sort((a, b) =>
    a.slug.split('/').length - b.slug.split('/').length || a.slug.localeCompare(b.slug)
  );
  for (const p of sorted) {
    const node = { title: p.title, slug: p.slug, children: [] };
    map[p.slug] = node;
    const parts = p.slug.split('/');
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentSlug = parts.slice(0, -1).join('/');
      if (map[parentSlug]) map[parentSlug].children.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

// Main
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const visited = new Set();
const queue = [START];
const pages = [];
const failedSlugs = [];

while (queue.length > 0) {
  const url = canonicalize(queue.shift());
  if (visited.has(url)) continue;
  visited.add(url);

  const result = await scrapePage(browser, url);
  if (!result) {
    failedSlugs.push(urlToSlug(url));
    continue;
  }

  pages.push({ url: result.url, slug: result.slug, title: result.title, html: result.html });
  saveProgress(pages);

  for (const link of result.newLinks) {
    const canon = canonicalize(link);
    if (!visited.has(canon) && canon.includes('/site/ukrainetour2011')) {
      queue.push(canon);
    }
  }
}

await browser.close();

saveProgress(pages);

const imgDownloaded = [...imgCache.values()].filter(v => v.startsWith('/images/')).length;
console.log('\n=== Scrape complete ===');
console.log(`Pages: ${pages.length}`);
console.log(`Images downloaded: ${imgDownloaded}`);
console.log(`Failed pages: ${failedSlugs.length > 0 ? failedSlugs.join(', ') : 'none'}`);
if (failedSlugs.length) console.log('Failed slugs:', failedSlugs);
