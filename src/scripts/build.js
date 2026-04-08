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
  writeJson(manifestPath, manifest);

  // Print the built file path for tooling.
  process.stdout.write(`${manifest.builtFile}\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

