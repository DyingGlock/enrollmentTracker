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
 * Normalize a stored filename or base name by stripping repeated extensions.
 * Example: ("abc.png.png", "png") -> "abc"
 * @param {string} value
 * @param {string} extNoDot
 * @returns {string}
 */
function stripRepeatedExtension(value, extNoDot) {
  const re = new RegExp(`(\\.${extNoDot})+$`, 'i');
  return String(value || '').replace(re, '');
}

/**
 * Ensure the manifest asset key stores a stable *base name* (no extension).
 * Migrates old manifest values that included extensions.
 * @param {any} manifest
 * @param {string[]} pathKeys
 * @param {number} len
 * @param {string} extNoDot
 * @returns {string}
 */
function ensureStableBaseName(manifest, pathKeys, len, extNoDot) {
  const current = ensureStableName(manifest, pathKeys, len);
  const base = stripRepeatedExtension(current, extNoDot);
  // Write back the normalized base so it doesn't grow each build.
  let node = manifest;
  for (let i = 0; i < pathKeys.length - 1; i += 1) {
    node = node[pathKeys[i]];
  }
  node[pathKeys[pathKeys.length - 1]] = base;
  return base;
}

/**
 * Delete files in a directory that match a set of exact names or a prefix regex.
 * @param {string} dir
 * @param {RegExp} pattern
 * @param {Set<string>} keepNames
 */
function deleteMatchingFiles(dir, pattern, keepNames) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (keepNames.has(name)) continue;
    if (!pattern.test(name)) continue;
    try {
      fs.rmSync(path.join(dir, name), { force: true });
    } catch (_) {}
  }
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

  // Runtime migrations: the bundled server resolves migrations relative to __dirname,
  // which becomes dist/ at runtime. Copy SQL migrations into dist/migrations.
  const migrationsSrcDir = path.join(projectRoot, 'src', 'db', 'migrations');
  const migrationsOutDir = path.join(distDir, 'migrations');
  if (fs.existsSync(migrationsSrcDir)) {
    fs.mkdirSync(migrationsOutDir, { recursive: true });
    // Node 18+ supports cpSync.
    fs.cpSync(migrationsSrcDir, migrationsOutDir, { recursive: true });
  }

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
  fs.mkdirSync(publicOutDir, { recursive: true });

  // CSS
  const cssBase = ensureStableBaseName(
    manifest,
    ['public', 'assets', 'trackerCss'],
    24,
    'css'
  );
  const cssIn = path.join(srcPublicDir, 'tracker.css');
  const cssFile = `${cssBase}.css`;
  const cssOutRel = path.join(manifest.public?.baseDir || 'dist/public', cssFile);
  const cssOut = path.join(projectRoot, cssOutRel);
  if (fs.existsSync(cssIn)) {
    const css = readText(cssIn);
    const cssResult = await esbuild.transform(css, { loader: 'css', minify: true });
    writeText(cssOut, cssResult.code);
  }

  // Browser JS (bundle to iife, minify, then obfuscate)
  const jsBase = ensureStableBaseName(
    manifest,
    ['public', 'assets', 'trackerJs'],
    24,
    'js'
  );
  const jsIn = path.join(srcPublicDir, 'tracker.js');
  const jsFile = `${jsBase}.js`;
  const jsOutRel = path.join(manifest.public?.baseDir || 'dist/public', jsFile);
  const jsTmpOut = path.join(publicOutDir, `${jsBase}.bundle.tmp.js`);
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
  }

  // Images: copy + rename (so browser-served asset names aren't source names)
  const logoBase = ensureStableBaseName(
    manifest,
    ['public', 'assets', 'logoPng'],
    24,
    'png'
  );
  const logoIn = path.join(srcPublicDir, 'post loogo.png');
  const logoFile = `${logoBase}.png`;
  const logoOutRel = path.join(manifest.public?.baseDir || 'dist/public', logoFile);
  const logoOut = path.join(projectRoot, logoOutRel);
  if (fs.existsSync(logoIn)) {
    fs.mkdirSync(path.dirname(logoOut), { recursive: true });
    fs.copyFileSync(logoIn, logoOut);
  }

  // Cleanup: ensure rebuilds do not accumulate duplicate assets.
  // Keep only the current CSS/JS/logo outputs, delete obvious duplicates
  // like *.png.png.png or old favicon SVGs.
  const keep = new Set([cssFile, jsFile, logoFile]);
  deleteMatchingFiles(publicOutDir, /\.css(\.css)+$/i, keep);
  deleteMatchingFiles(publicOutDir, /\.js(\.js)+$/i, keep);
  deleteMatchingFiles(publicOutDir, /\.png(\.png)+$/i, keep);
  deleteMatchingFiles(publicOutDir, /\.svg(\.svg)+$/i, keep);
  // Also remove any standalone svg favicon artifacts (we now use PNG logo for favicon).
  deleteMatchingFiles(publicOutDir, /\.svg$/i, keep);

  writeJson(manifestPath, manifest);

  // Print the built file path for tooling.
  process.stdout.write(`${manifest.builtFile}\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

