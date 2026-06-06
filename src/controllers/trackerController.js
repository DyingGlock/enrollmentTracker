const { getTrackerConfig } = require('../config/tracker');
const applications = require('../repositories/applications');
const sync = require('../services/sync');
const { renderTrackerPage } = require('../views/trackerPage');
const { getPublicAssetUrls } = require('../utils/assets');

function getRequestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

async function buildCurrentClassPayload() {
  const statusCounts = await applications.getActiveStatusCounts();
  const totalApplications = statusCounts.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return {
    currentClass: await sync.getCurrentClassLabel(),
    totalApplications,
    statusCounts,
  };
}

async function renderActivePage(req, res, next) {
  try {
    const [currentClass, records] = await Promise.all([
      buildCurrentClassPayload(),
      applications.getActiveApplications(),
    ]);

    const assets = getPublicAssetUrls();

    res.status(200).send(
      renderTrackerPage({
        title: `${currentClass.currentClass} Enrollment Tracker`,
        heading: currentClass.currentClass,
        subtitle: 'Active enrollment applications mirrored from Trello.',
        pageUrl: `${getRequestOrigin(req)}${req.originalUrl}`,
        imageUrl: `${getRequestOrigin(req)}${assets.logoPngHref}`,
        currentClass,
        infoSections: getTrackerConfig().infoSections,
        records,
        archived: false,
      })
    );
  } catch (err) {
    next(err);
  }
}

async function renderArchivedPage(req, res, next) {
  try {
    const [currentClass, records] = await Promise.all([
      buildCurrentClassPayload(),
      applications.getArchivedApplications(),
    ]);

    const assets = getPublicAssetUrls();

    res.status(200).send(
      renderTrackerPage({
        title: `${currentClass.currentClass} Archived Applications`,
        heading: 'Archived Applications',
        subtitle: 'Applications archived after leaving the tracked Trello enrollment workflow.',
        pageUrl: `${getRequestOrigin(req)}${req.originalUrl}`,
        imageUrl: `${getRequestOrigin(req)}${assets.logoPngHref}`,
        currentClass,
        infoSections: [],
        records,
        archived: true,
      })
    );
  } catch (err) {
    next(err);
  }
}

async function getActiveApplications(req, res, next) {
  try {
    const records = await applications.getActiveApplications();
    res.status(200).json(records);
  } catch (err) {
    next(err);
  }
}

async function getArchivedApplications(req, res, next) {
  try {
    const records = await applications.getArchivedApplications();
    res.status(200).json(records);
  } catch (err) {
    next(err);
  }
}

async function getCurrentClass(req, res, next) {
  try {
    const payload = await buildCurrentClassPayload();
    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buildCurrentClassPayload,
  renderActivePage,
  renderArchivedPage,
  getActiveApplications,
  getArchivedApplications,
  getCurrentClass,
};
