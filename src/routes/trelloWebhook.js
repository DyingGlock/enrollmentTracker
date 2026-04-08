/**
 * Trello webhook routes.
 * HEAD/GET/POST /api/trello-webhook (mounted under /api in app).
 */

const express = require('express');
const controller = require('../controllers/trelloWebhookController');

const router = express.Router();

/** JSON body parser with size limit; applied only to POST */
router.use(
  express.json({
    limit: controller.JSON_LIMIT,
    strict: true,
  })
);

router.head('/', controller.handleHead);
router.get('/', controller.handleGet);
router.post('/', controller.handlePost);

module.exports = router;
