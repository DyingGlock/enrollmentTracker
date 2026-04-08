/**
 * Express application.
 * Supports both /api/* and unprefixed public routes for compatibility.
 */

const express = require('express');
const path = require('path');
const trackerRouter = require('./routes/tracker');
const trelloWebhookRouter = require('./routes/trelloWebhook');
const logger = require('./utils/logger');
const { getPublicAssetUrls } = require('./utils/assets');

const app = express();

/** Trust proxy for correct req.ip behind reverse proxy */
app.set('trust proxy', 1);

/** No body parsing at app level; trello webhook route adds its own JSON parser with limit */
// Serve ONLY built browser assets from dist/ (do not serve src/public in production).
// Note: `npm run build` generates dist/public/* and records stable filenames in build/manifest.json.
app.use(
  '/static',
  express.static(path.join(__dirname, '..', 'dist', 'public'), {
    fallthrough: false,
    index: false,
    maxAge: '7d',
  })
);

app.get('/favicon.ico', (req, res) => {
  // Redirect legacy favicon path to the built favicon asset.
  // (Tracker page itself uses the manifest URL; this is for compatibility.)
  const assets = getPublicAssetUrls();
  res.redirect(302, assets.faviconHref);
});

function sendHealth(req, res) {
  res.status(200).json({
    ok: true,
    service: 'enrollment-tracker',
  });
}

/** Health checks: canonical /api/health plus compatibility /health */
app.get('/api/health', sendHealth);
app.get('/health', sendHealth);

/** Tracker pages and JSON APIs */
app.use('/', trackerRouter);

/** Trello webhook: canonical /api/trello-webhook plus compatibility /trello-webhook */
app.use('/api/trello-webhook', trelloWebhookRouter);
app.use('/trello-webhook', trelloWebhookRouter);

/** 404 */
app.use((req, res) => {
  logger.warn('Unhandled route', {
    method: req.method,
    path: req.originalUrl,
  });
  res.status(404).json({ ok: false, message: 'Not found' });
});

/** Global error handler: malformed JSON → 400, rest → 500 */
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError) {
    logger.warn('Invalid JSON body', { message: err.message });
    return res.status(400).json({
      ok: false,
      message: 'Invalid or missing JSON body',
    });
  }
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({
    ok: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = app;
