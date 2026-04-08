/**
 * Built asset resolver.
 * Reads build/manifest.json to map logical assets to dist/public filenames.
 * Falls back to legacy source paths only if manifest is missing (dev convenience).
 */

const path = require('path');
const fs = require('fs');

/**
 * @returns {any|null}
 */
function tryReadManifest() {
  try {
    const p = path.join(__dirname, '..', '..', 'build', 'manifest.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
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

  const trackerCss = assets.trackerCss ? `/static/${assets.trackerCss}` : '/static/tracker.css';
  const trackerJs = assets.trackerJs ? `/static/${assets.trackerJs}` : '/static/tracker.js';
  const logoPng = assets.logoPng ? `/static/${assets.logoPng}` : '/static/post%20loogo.png';
  // Favicon uses the same logo PNG.
  const favicon = logoPng;

  return {
    trackerCssHref: trackerCss,
    trackerJsSrc: trackerJs,
    logoPngHref: logoPng,
    faviconHref: favicon,
  };
}

module.exports = { getPublicAssetUrls };

