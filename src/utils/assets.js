/**
 * Built asset resolver.
 * Reads build/manifest.json to map logical assets to dist/public filenames.
 * Falls back to legacy source paths only if manifest is missing (dev convenience).
 */

const path = require('path');
const fs = require('fs');

/**
 * Locate the build manifest from either the source layout (`src/utils`) or the
 * bundled layout (`dist`).
 * @param {string} moduleDir
 * @param {string} cwd
 * @returns {string|null}
 */
function findManifestPath(moduleDir = __dirname, cwd = process.cwd()) {
  const candidates = [
    path.join(moduleDir, 'manifest.json'),
    path.join(moduleDir, '..', '..', 'build', 'manifest.json'),
    path.join(moduleDir, '..', 'build', 'manifest.json'),
    path.join(cwd, 'build', 'manifest.json'),
    path.join(cwd, 'dist', 'manifest.json'),
  ];

  for (const candidate of new Set(candidates.map((p) => path.resolve(p)))) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * @returns {any|null}
 */
function tryReadManifest() {
  try {
    const manifestPath = findManifestPath();
    if (!manifestPath) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Strip repeated extensions from a manifest base name.
 * @param {string} value
 * @param {string} extNoDot
 * @returns {string}
 */
function stripRepeatedExtension(value, extNoDot) {
  const re = new RegExp(`(\\.${extNoDot})+$`, 'i');
  return String(value || '').replace(re, '');
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function hashFileContent(filePath) {
  const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return digest.slice(0, 12);
}

/**
 * @param {string} assetPath
 * @param {string|undefined} contentHash
 * @returns {string}
 */
function withCacheBust(assetPath, contentHash) {
  if (!contentHash) return assetPath;
  return `${assetPath}?v=${contentHash}`;
}

/**
 * @param {string|undefined} baseName
 * @param {string} extNoDot
 * @param {string} fallbackPath
 * @param {string|undefined} contentHash
 * @returns {string}
 */
function buildStaticAssetPath(baseName, extNoDot, fallbackPath, contentHash) {
  if (!baseName) return fallbackPath;
  const normalized = stripRepeatedExtension(baseName, extNoDot);
  return withCacheBust(`/static/${normalized}.${extNoDot}`, contentHash);
}

/**
 * @returns {{ trackerCssHref: string, trackerJsSrc: string, logoPngHref: string, faviconHref: string }}
 */
function getPublicAssetUrls() {
  // In development, always use the canonical source filenames.
  // `src/app.js` mounts `/static` to `src/public`, so these resolve correctly.
  if (process.env.NODE_ENV !== 'production') {
    return {
      trackerCssHref: '/static/tracker.css',
      trackerJsSrc: '/static/tracker.js',
      logoPngHref: '/static/post%20loogo.png',
      faviconHref: '/static/post%20loogo.png',
    };
  }

  const manifest = tryReadManifest();
  const assets = manifest?.public?.assets || {};

  const trackerCss = buildStaticAssetPath(
    assets.trackerCss,
    'css',
    '/static/tracker.css',
    assets.trackerCssHash
  );
  const trackerJs = buildStaticAssetPath(
    assets.trackerJs,
    'js',
    '/static/tracker.js',
    assets.trackerJsHash
  );
  const logoPng = buildStaticAssetPath(
    assets.logoPng,
    'png',
    '/static/post%20loogo.png',
    assets.logoPngHash
  );
  // Favicon uses the same logo PNG.
  const favicon = logoPng;

  return {
    trackerCssHref: trackerCss,
    trackerJsSrc: trackerJs,
    logoPngHref: logoPng,
    faviconHref: favicon,
  };
}

module.exports = { findManifestPath, getPublicAssetUrls };
