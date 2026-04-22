/**
 * Deploys the out/ directory to Vercel via REST API (no CLI needed).
 * Uses the vck_ token which works with the REST API.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'out');

const SECRETS_DIR = `${process.env.HOME}/Dev/_ORCH/secrets`;
let TOKEN = '';
if (existsSync(`${SECRETS_DIR}/vercel.env`)) {
  const env = readFileSync(`${SECRETS_DIR}/vercel.env`, 'utf8');
  TOKEN = env.match(/VERCEL_TOKEN=([^\s]+)/)?.[1] || '';
} else if (existsSync(`${SECRETS_DIR}/.env`)) {
  const env = readFileSync(`${SECRETS_DIR}/.env`, 'utf8');
  TOKEN = env.match(/VERCEL_TOKEN=([^\s]+)/)?.[1] || '';
} else if (existsSync(`${SECRETS_DIR}/vercel_token`)) {
  TOKEN = readFileSync(`${SECRETS_DIR}/vercel_token`, 'utf8').trim();
} else if (existsSync(`${SECRETS_DIR}/vercel.key`)) {
  TOKEN = readFileSync(`${SECRETS_DIR}/vercel.key`, 'utf8').trim();
}

if (!TOKEN) {
  console.error('ERROR: No Vercel token found in secrets directory.');
  process.exit(1);
}

function apiRequest(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body instanceof Buffer ? body : (body ? Buffer.from(JSON.stringify(body)) : null);
    const headers = {
      'Authorization': `Bearer ${TOKEN}`,
      ...extraHeaders,
    };
    if (bodyBuf) {
      headers['Content-Length'] = bodyBuf.length;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }

    const req = https.request({
      hostname: 'api.vercel.com',
      path,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, data: text }); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function walkDir(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full, base));
    } else {
      files.push({ full, rel: relative(base, full).replace(/\\/g, '/') });
    }
  }
  return files;
}

function getMimeType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    txt: 'text/plain',
    xml: 'application/xml',
  };
  return map[ext || ''] || 'application/octet-stream';
}

if (!existsSync(OUT_DIR)) {
  console.error('ERROR: out/ directory not found. Run `npm run build` first.');
  process.exit(1);
}

console.log('Collecting files from out/...');
const allFiles = walkDir(OUT_DIR);
console.log(`Found ${allFiles.length} files`);

// Prepare file metadata
const fileList = allFiles.map(({ full, rel }) => {
  const content = readFileSync(full);
  const sha = createHash('sha1').update(content).digest('hex');
  return { full, rel, content, sha, size: content.length };
});

// Upload files
console.log('Uploading files to Vercel...');
let uploaded = 0;
let skipped = 0;
for (const file of fileList) {
  const res = await apiRequest('POST', '/v2/files', file.content, {
    'Content-Type': getMimeType(file.rel),
    'x-vercel-digest': file.sha,
  });
  if (res.status === 200) skipped++;
  else if (res.status === 201) uploaded++;
  else {
    console.error(`  Upload failed for ${file.rel}: ${res.status}`, res.data);
    process.exit(1);
  }
  if ((uploaded + skipped) % 50 === 0) {
    console.log(`  ${uploaded + skipped}/${fileList.length} files processed`);
  }
}
console.log(`Uploaded: ${uploaded} new, ${skipped} already cached`);

// Create deployment
console.log('Creating Vercel deployment...');
const deployBody = {
  name: 'cheremosh-site',
  target: 'production',
  files: fileList.map(f => ({ file: f.rel, sha: f.sha, size: f.size })),
  projectSettings: {
    framework: null,
    buildCommand: null,
    outputDirectory: null,
    rootDirectory: null,
    installCommand: null,
  },
};

const deployRes = await apiRequest('POST', '/v13/deployments?forceNew=1', deployBody);

if (deployRes.status !== 200 && deployRes.status !== 201) {
  console.error('Deployment creation failed:', deployRes.status, JSON.stringify(deployRes.data, null, 2));
  process.exit(1);
}

const { id: deployId, url: deployUrl, readyState } = deployRes.data;
console.log(`Deployment created: ${deployId}`);
console.log(`URL: https://${deployUrl}`);
console.log(`State: ${readyState}`);

// Poll until ready
if (readyState !== 'READY') {
  console.log('Waiting for deployment to become READY...');
  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await apiRequest('GET', `/v13/deployments/${deployId}`);
    const state = statusRes.data.readyState;
    process.stdout.write(`\r  State: ${state}      `);
    if (state === 'READY') {
      console.log('\nDeployment READY!');
      break;
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      console.error(`\nDeployment failed with state: ${state}`);
      console.error(JSON.stringify(statusRes.data.errorStep || statusRes.data.error, null, 2));
      process.exit(1);
    }
    attempts++;
  }
}

// Get aliases (production URL)
const infoRes = await apiRequest('GET', `/v13/deployments/${deployId}`);
const aliases = infoRes.data.aliases || [];
const prodUrl = aliases.length > 0 ? `https://${aliases[0]}` : `https://${deployUrl}`;

console.log('\n=== Deploy complete ===');
console.log(`Production URL: ${prodUrl}`);
console.log(`Deploy URL: https://${deployUrl}`);
