/**
 * Build pipeline:
 * - bundles server entry to a single file with esbuild
 * - minifies
 * - obfuscates output
 *
 * Output filename is a “random” alphanumeric string generated ONCE and stored
 * in build/manifest.json so subsequent builds overwrite the same file (no new build files).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');

/**
 * @param {string} p
 */
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * @param {string} p
 * @param {any} obj
 */
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/**
 * @returns {string}
 */
function randomBase62(len) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Ensure a stable manifest key has a random base62 name (generated once).
 * @param {any} manifest
 * @param {string[]} pathKeys
 * @param {number} len
 * @returns {string} the value
 */
function ensureStableName(manifest, pathKeys, len) {
  let node = manifest;
  for (let i = 0; i < pathKeys.length - 1; i += 1) {
    const k = pathKeys[i];
    node[k] = node[k] || {};
    node = node[k];
  }
  const leafKey = pathKeys[pathKeys.length - 1];
  if (!node[leafKey]) node[leafKey] = randomBase62(len);
  return node[leafKey];
}

/**
 * @param {string} inputPath
 * @returns {string}
 */
function readText(inputPath) {
  return fs.readFileSync(inputPath, 'utf8');
}

/**
 * @param {string} outPath
 * @param {string} text
 */
function writeText(outPath, text) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, 'utf8');
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const manifestPath = path.join(projectRoot, 'build', 'manifest.json');
  const distDir = path.join(projectRoot, 'dist');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing build manifest at ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  const entry = path.join(projectRoot, manifest.entry || 'src/server.js');

  if (!fs.existsSync(entry)) {
    throw new Error(`Entry file not found: ${entry}`);
  }

  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  // Generate and persist the “random” output name once.
  if (!manifest.outFileBase || manifest.outFileBase === 'CHANGE_ME_ON_FIRST_BUILD') {
    manifest.outFileBase = randomBase62(24);
  }

  const outFile = path.join(distDir, `${manifest.outFileBase}.js`);
  const tempFile = path.join(distDir, `${manifest.outFileBase}.bundle.tmp.js`);

  // Bundle + minify.
  await esbuild.build({
    entryPoints: [entry],
    platform: 'node',
    format: 'cjs',
    bundle: true,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    outfile: tempFile,
    target: ['node18'],
    // Avoid bundling node native deps.
    external: [],
  });

  // Obfuscate.
  const bundled = fs.readFileSync(tempFile, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(bundled, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    renameGlobals: false,
    sourceMap: false,
  }).getObfuscatedCode();

  fs.writeFileSync(outFile, obfuscated, 'utf8');
  fs.rmSync(tempFile, { force: true });

  // Clean any previously recorded built file if it differs (prevents artifact accumulation).
  if (manifest.builtFile && manifest.builtFile !== path.relative(projectRoot, outFile)) {
    const old = path.join(projectRoot, manifest.builtFile);
    try {
      fs.rmSync(old, { force: true });
    } catch (_) {}
  }

  manifest.builtFile = path.relative(projectRoot, outFile);

  // -----------------------------------------------------------------------
  // Browser/public assets: minify CSS, bundle+minify+obfuscate JS, rename files
  // -----------------------------------------------------------------------
  const publicOutDir = path.join(projectRoot, manifest.public?.baseDir || 'dist/public');
  const srcPublicDir = path.join(projectRoot, 'src', 'public');

  // CSS
  const cssName = ensureStableName(manifest, ['public', 'assets', 'trackerCss'], 24);
  const cssIn = path.join(srcPublicDir, 'tracker.css');
  const cssFile = `${cssName}.css`;
  const cssOutRel = path.join(manifest.public?.baseDir || 'dist/public', cssFile);
  const cssOut = path.join(projectRoot, cssOutRel);
  if (fs.existsSync(cssIn)) {
    const css = readText(cssIn);
    const cssResult = await esbuild.transform(css, { loader: 'css', minify: true });
    writeText(cssOut, cssResult.code);
    manifest.public.assets.trackerCss = cssFile;
  }

  // Browser JS (bundle to iife, minify, then obfuscate)
  const jsName = ensureStableName(manifest, ['public', 'assets', 'trackerJs'], 24);
  const jsIn = path.join(srcPublicDir, 'tracker.js');
  const jsFile = `${jsName}.js`;
  const jsOutRel = path.join(manifest.public?.baseDir || 'dist/public', jsFile);
  const jsTmpOut = path.join(publicOutDir, `${jsName}.bundle.tmp.js`);
  const jsOut = path.join(projectRoot, jsOutRel);
  if (fs.existsSync(jsIn)) {
    await esbuild.build({
      entryPoints: [jsIn],
      platform: 'browser',
      format: 'iife',
      bundle: true,
      minify: true,
      sourcemap: false,
      legalComments: 'none',
      outfile: jsTmpOut,
      target: ['es2019'],
    });
    const jsBundled = fs.readFileSync(jsTmpOut, 'utf8');
    const jsObfuscated = JavaScriptObfuscator.obfuscate(jsBundled, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.2,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      renameGlobals: false,
      sourceMap: false,
    }).getObfuscatedCode();
    writeText(jsOut, jsObfuscated);
    fs.rmSync(jsTmpOut, { force: true });
    manifest.public.assets.trackerJs = jsFile;
  }

  // Images: copy + rename (so browser-served asset names aren't source names)
  const logoName = ensureStableName(manifest, ['public', 'assets', 'logoPng'], 24);
  const logoIn = path.join(srcPublicDir, 'post loogo.png');
  const logoFile = `${logoName}.png`;
  const logoOutRel = path.join(manifest.public?.baseDir || 'dist/public', logoFile);
  const logoOut = path.join(projectRoot, logoOutRel);
  if (fs.existsSync(logoIn)) {
    fs.mkdirSync(path.dirname(logoOut), { recursive: true });
    fs.copyFileSync(logoIn, logoOut);
    manifest.public.assets.logoPng = logoFile;
  }

  const faviconName = ensureStableName(manifest, ['public', 'assets', 'faviconSvg'], 24);
  const faviconIn = path.join(srcPublicDir, 'favicon.svg');
  const faviconFile = `${faviconName}.svg`;
  const faviconOutRel = path.join(manifest.public?.baseDir || 'dist/public', faviconFile);
  const faviconOut = path.join(projectRoot, faviconOutRel);
  if (fs.existsSync(faviconIn)) {
    fs.mkdirSync(path.dirname(faviconOut), { recursive: true });
    fs.copyFileSync(faviconIn, faviconOut);
    manifest.public.assets.faviconSvg = faviconFile;
  }

  writeJson(manifestPath, manifest);

  // Print the built file path for tooling.
  process.stdout.write(`${manifest.builtFile}\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

