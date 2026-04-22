/**
 * Re-scrapes pages with < 200 chars of HTML and patches data/pages.json in place.
 * Uses the updated content selector logic from scrape.mjs.
 */
import puppeteer from 'puppeteer';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import https from 'https';
import http from 'http';
import { unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'public/images');
const PAGES_FILE = join(ROOT, 'data/pages.json');

const imgLimit = pLimit(4);
const imgCache = new Map();

const data = JSON.parse(readFileSync(PAGES_FILE, 'utf8'));
const thinPages = data.pages.filter(p => !p.html || p.html.length < 200);
console.log(`Re-scraping ${thinPages.length} thin pages...`);

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
      protocol.get(src, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if ([301,302,303].includes(res.statusCode) && res.headers.location) {
          file.close(); unlink(filePath).catch(()=>{});
          downloadImage(res.headers.location).then(p=>{imgCache.set(src,p);resolve();}).catch(reject); return;
        }
        if (res.statusCode!==200){file.close();unlink(filePath).catch(()=>{});reject(new Error(`HTTP ${res.statusCode}`));return;}
        res.pipe(file);
        file.on('finish', resolve);
        file.on('error', e=>{unlink(filePath).catch(()=>{});reject(e);});
      }).on('error',e=>{file.close();unlink(filePath).catch(()=>{});reject(e);});
    });
    imgCache.set(src, localPath); return localPath;
  } catch(err) {
    console.error(`  [img-fail] ${src.slice(0,60)}: ${err.message}`);
    imgCache.set(src, src); return src;
  }
}

async function extractAndDownload(page, url) {
  const result = await page.evaluate((baseUrl) => {
    const imgSrcs = [];
    document.querySelectorAll('img[src]').forEach(img => {
      const s = img.getAttribute('src') || '';
      if (s.startsWith('http')) imgSrcs.push(s);
    });

    const h1 = document.querySelector('h1');
    let title = h1?.textContent?.trim();
    if (!title) { const t = document.title||''; title = t.split(/[|\-–]/)[0].trim(); }

    const contentSelectors = ['.QZ3zWd','.hJDwNd','.IZ65Hb','#sites-canvas-main-content','#sites-canvas-main','article','main'];
    let contentEl = null;
    for (const sel of contentSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 50) { contentEl = el; break; }
    }
    if (!contentEl) {
      const bodyDivs = [...document.querySelectorAll('div')]
        .filter(d => !d.closest('nav') && !d.closest('header') && !d.closest('footer'))
        .sort((a,b) => (b.innerText?.length||0) - (a.innerText?.length||0));
      contentEl = bodyDivs[0] || document.body;
    }
    const titleHeading = document.querySelector('[role="main"] h1, [role="main"] h2');
    if (titleHeading && contentEl && !contentEl.contains(titleHeading)) {
      contentEl.insertBefore(titleHeading.cloneNode(true), contentEl.firstChild);
    }

    ['script','style','noscript','nav','header','footer',
     '[aria-label="Site navigation"]','[aria-label="Site pages"]'].forEach(sel => {
      contentEl?.querySelectorAll(sel).forEach(el=>el.remove());
    });

    contentEl?.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href')||'';
      if (href.includes('/site/ukrainetour2011')) {
        let s = href.split('?')[0].split('#')[0].replace(/\/$/,'');
        s = s.replace(/https?:\/\/sites\.google\.com\/site\/ukrainetour2011/,'').replace(/^\//,'').replace(/\/$/,'');
        a.setAttribute('href', s&&s!=='home'?`/${s}`:'/');
      } else if (/^https?:\/\//.test(href)) {
        a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer');
      }
    });
    contentEl?.querySelectorAll('[style]').forEach(el=>el.removeAttribute('style'));

    let html = (contentEl?.innerHTML||'')
      .replace(/<script[\s\S]*?<\/script>/gi,'')
      .replace(/<style[\s\S]*?<\/style>/gi,'').trim();

    return { title, html, imgSrcs };
  }, url);

  const imgResults = await Promise.all(result.imgSrcs.map(src => imgLimit(()=>downloadImage(src))));
  let html = result.html;
  result.imgSrcs.forEach((src,i)=>{
    const local = imgResults[i];
    if (local!==src) html = html.split(src).join(local);
  });
  html = html.replace(/<img\b(?![^>]*\bloading=)/gi,'<img loading="lazy" ');
  return { title: result.title, html };
}

const browser = await puppeteer.launch({ headless:true, args:['--no-sandbox','--disable-setuid-sandbox'] });
let improved = 0;
let failed = 0;

for (const pageData of thinPages) {
  const url = pageData.url;
  const slug = pageData.slug;
  console.log(`[re-scrape] ${slug}`);

  let pg;
  try {
    pg = await browser.newPage();
    await pg.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
    await pg.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
    await new Promise(r=>setTimeout(r,5000)); // wait longer for content

    let result;
    try { result = await extractAndDownload(pg, url); }
    catch(e) {
      await pg.close().catch(()=>{});
      pg = await browser.newPage();
      await pg.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36');
      await pg.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
      await new Promise(r=>setTimeout(r,6000));
      result = await extractAndDownload(pg, url);
    }

    if (result.html.length > pageData.html.length) {
      const idx = data.pages.findIndex(p=>p.slug===slug);
      if (idx>=0) {
        data.pages[idx].html = result.html;
        if (result.title && result.title.length > 3) data.pages[idx].title = result.title;
        improved++;
        console.log(`  improved: ${pageData.html.length} → ${result.html.length} chars`);
      }
    } else {
      console.log(`  no improvement: ${result.html.length} chars (was ${pageData.html.length})`);
    }
  } catch(err) {
    console.error(`  [fail] ${url}: ${err.message}`);
    failed++;
  }
  await pg?.close().catch(()=>{});
}

await browser.close();

// Rebuild nav
function buildNav(pageList) {
  const map = {}, roots = [];
  const sorted = [...pageList].sort((a,b)=>a.slug.split('/').length-b.slug.split('/').length||a.slug.localeCompare(b.slug));
  for (const p of sorted) {
    const node = { title: p.title, slug: p.slug, children: [] };
    map[p.slug] = node;
    const parts = p.slug.split('/');
    if (parts.length===1) roots.push(node);
    else { const ps = parts.slice(0,-1).join('/'); if(map[ps]) map[ps].children.push(node); else roots.push(node); }
  }
  return roots;
}
data.nav = buildNav(data.pages);
writeFileSync(PAGES_FILE, JSON.stringify(data, null, 2));

const newImgs = [...imgCache.values()].filter(v=>v.startsWith('/images/')).length;
console.log(`\n=== Re-scrape done ===`);
console.log(`Improved: ${improved}/${thinPages.length} pages`);
console.log(`New images: ${newImgs}`);
console.log(`Failed: ${failed}`);
