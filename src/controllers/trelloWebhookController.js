/**
 * Trello webhook controller.
 * Validates HEAD/GET, receives POST payloads, syncs Trello cards into PostgreSQL.
 */

const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Optional: Trello request verification (do not enable until config is set)
// ---------------------------------------------------------------------------
// To verify requests are from Trello, you can:
// 1. Add env TRELLO_VERIFY_SECRET or TRELLO_WEBHOOK_SECRET
// 2. In a middleware or here: check X-Trello-Webhook header or validate
//    request signature if Trello supports it for your webhook type
// 3. Only run verification when env is set; otherwise allow all (current behavior)
// function verifyTrelloOrigin(req) { return true; }
// ---------------------------------------------------------------------------

const { runSync } = require('../services/sync');

/** Max JSON body size (1MB). */
const JSON_LIMIT = '1mb';

/**
 * Extract safe summary fields from Trello webhook payload for logging.
 * @param {object} payload - Parsed Trello webhook body
 * @returns {Record<string, string|undefined>}
 */
function extractTrelloSummary(payload) {
  const action = payload?.action;
  if (!action) return {};
  const data = action.data || {};
  const card = data.card || {};
  const listBefore = data.listBefore;
  const listAfter = data.listAfter;
  return {
    actionType: action.type,
    cardId: card.id,
    cardName: card.name,
    listBeforeName: listBefore?.name,
    listAfterName: listAfter?.name,
  };
}

/**
 * Handle HEAD /api/trello-webhook — Trello callback URL validation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function handleHead(req, res) {
  res.status(200).end();
}

/**
 * Handle GET /api/trello-webhook — readiness/debug check.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function handleGet(req, res) {
  res.status(200).json({ message: 'trello webhook endpoint ready' });
}

/**
 * Handle POST /api/trello-webhook — receive Trello payload, sync to PostgreSQL mirror.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handlePost(req, res) {
  const payload = req.body;
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

  if (!payload || typeof payload !== 'object') {
    logger.warn('Trello webhook POST with empty or non-object body', {
      hasBody: !!payload,
      clientIp,
    });
    return res.status(400).json({
      ok: false,
      message: 'Invalid or missing JSON body',
    });
  }

  const summary = extractTrelloSummary(payload);
  logger.info('Trello webhook received', {
    ...summary,
    clientIp,
  });

  try {
    await runSync(payload);
    logger.info('Trello webhook sync completed', summary);
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('Sync error', {
      message: err.message,
      stack: err.stack,
      ...summary,
    });
    return res.status(500).json({
      ok: false,
      message: err.message || 'Sync error',
    });
  }
}

module.exports = {
  handleHead,
  handleGet,
  handlePost,
  JSON_LIMIT,
};
