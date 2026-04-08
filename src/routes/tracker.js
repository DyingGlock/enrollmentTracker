const express = require('express');
const controller = require('../controllers/trackerController');

const router = express.Router();

router.get('/', controller.renderActivePage);
router.get('/archived', controller.renderArchivedPage);
router.get('/api/applications', controller.getActiveApplications);
router.get('/api/applications/archived', controller.getArchivedApplications);
router.get('/api/current-class', controller.getCurrentClass);

module.exports = router;
