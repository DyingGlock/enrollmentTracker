const { getConfig } = require('../config/env');
const { getTrackerConfig } = require('../config/tracker');
const logger = require('../utils/logger');
const trello = require('./trello');
const applications = require('../repositories/applications');

let syncTimer = null;
let metadataCache = null;
let currentClassLabel = null;

function parseCreatedAtFromTrelloId(trelloCardId) {
  if (!trelloCardId || trelloCardId.length < 8) return null;

  const seconds = Number.parseInt(trelloCardId.slice(0, 8), 16);
  if (Number.isNaN(seconds)) return null;

  return new Date(seconds * 1000);
}

async function getBoardMetadata(force = false) {
  const config = getConfig();

  if (metadataCache && !force) {
    return metadataCache;
  }

  const [lists, customFields] = await Promise.all([
    trello.fetchBoardLists(config.TRELLO_BOARD_ID),
    trello.fetchBoardCustomFields(config.TRELLO_BOARD_ID),
  ]);

  const listMap = new Map(
    lists.map((list) => [list.id, String(list.name || '').trim()])
  );
  const fieldMap = trello.buildCustomFieldMap(customFields);

  metadataCache = { listMap, fieldMap };
  return metadataCache;
}

function isTrackedActiveList(listName) {
  return getTrackerConfig().activeListNames.includes(listName);
}

function isApplicationCard(card, config) {
  const title = String(card?.name || '').trim();
  const cardId = String(card?.id || '').trim();

  if (!cardId || !title) return false;
  if (cardId === config.TRELLO_CLASS_CARD_ID) return false;
  if (/enrollment exam for post class\s+\d+/i.test(title)) return false;
  return true;
}

function isEnrollmentApplicationCard(card, listName, config) {
  return isTrackedActiveList(listName) && isApplicationCard(card, config);
}

async function detectCurrentClassLabel() {
  const config = getConfig();
  const classCard = await trello.fetchCard(config.TRELLO_CLASS_CARD_ID);
  const title = String(classCard?.name || '').trim();
  const match = title.match(/Class\s+(\d+)/i);

  if (!match) {
    throw new Error(`Could not determine class number from card title: ${title}`);
  }

  currentClassLabel = `Class ${match[1]}`;
  return currentClassLabel;
}

function parseClassNumber(classLabel) {
  const match = String(classLabel || '').match(/Class\s+(\d+)/i);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function getCardListActivity(cardId, currentListId, listMap) {
  const actions = await trello.fetchCardListActions(cardId);
  const matchingAction = (actions || []).find(
    (action) => action?.data?.listAfter?.id === currentListId
  );

  const previousListId = String(
    matchingAction?.data?.listBefore?.id || ''
  ).trim();
  const previousListName =
    listMap.get(previousListId) ||
    String(matchingAction?.data?.listBefore?.name || '').trim();

  return {
    previousListId: previousListId || null,
    previousListName: previousListName || null,
  };
}

async function toApplicationRecord(card, listName, fieldMap, boardId, classLabel, listMap) {
  const normalizedFields = trello.normalizeApplicationFields(
    card.customFieldItems,
    fieldMap
  );
  const activity = await getCardListActivity(card.id, card.idList, listMap);

  return {
    cardId: card.id,
    boardId,
    name: String(card.name || '').trim(),
    classLabel,
    classNumber: parseClassNumber(classLabel),
    attemptNumber: normalizedFields.attemptNumber,
    currentListId: card.idList,
    currentListName: listName,
    previousListId: activity.previousListId,
    previousListName: activity.previousListName,
    comments: normalizedFields.comments,
    createdAt: parseCreatedAtFromTrelloId(card.id),
    updatedAt: card.dateLastActivity ? new Date(card.dateLastActivity) : null,
    rawTrello: card,
  };
}

async function reconcileBoard() {
  const config = getConfig();
  const { listMap, fieldMap } = await getBoardMetadata(true);
  const detectedClassLabel = await detectCurrentClassLabel();
  const boardCards = await trello.fetchBoardCards(config.TRELLO_BOARD_ID);
  const activeCards = boardCards.filter((card) =>
    isEnrollmentApplicationCard(card, listMap.get(card.idList) || '', config)
  );
  const inactiveApplicationCards = boardCards.filter((card) => {
    const listName = listMap.get(card.idList) || '';
    return (
      isApplicationCard(card, config) &&
      !isEnrollmentApplicationCard(card, listName, config)
    );
  });

  let upserted = 0;

  for (const card of activeCards) {
    const listName = listMap.get(card.idList) || 'Unknown';
    await applications.upsertApplication(
      await toApplicationRecord(
        card,
        listName,
        fieldMap,
        config.TRELLO_BOARD_ID,
        detectedClassLabel,
        listMap
      )
    );
    upserted += 1;
  }

  let archivedInactive = 0;

  for (const card of inactiveApplicationCards) {
    const listName = listMap.get(card.idList) || 'Unknown';
    await applications.archiveApplication(
      await toApplicationRecord(
        card,
        listName,
        fieldMap,
        config.TRELLO_BOARD_ID,
        detectedClassLabel,
        listMap
      )
    );
    archivedInactive += 1;
  }

  const archivedMissing = await applications.archiveMissingActiveApplications(
    config.TRELLO_BOARD_ID,
    activeCards.map((card) => card.id)
  );
  const archived = archivedInactive + archivedMissing;

  logger.info('Board reconciliation completed', {
    boardId: config.TRELLO_BOARD_ID,
    currentClass: detectedClassLabel,
    fetched: boardCards.length,
    activeCards: activeCards.length,
    upserted,
    archived,
  });

  return {
    fetched: boardCards.length,
    activeCards: activeCards.length,
    upserted,
    archived,
    currentClass: detectedClassLabel,
  };
}

async function syncCardById(cardId) {
  const config = getConfig();
  const { listMap, fieldMap } = await getBoardMetadata();
  const classLabel = await getCurrentClassLabel();

  try {
    const card = await trello.fetchCard(cardId);
    const listName = listMap.get(card.idList) || '';

    if (card.closed) {
      await applications.archiveApplicationByCardId(cardId);
      return { action: 'archived', reason: 'closed' };
    }

    if (!isEnrollmentApplicationCard(card, listName, config)) {
      if (isApplicationCard(card, config)) {
        await applications.archiveApplication(
          await toApplicationRecord(
            card,
            listName,
            fieldMap,
            config.TRELLO_BOARD_ID,
            classLabel,
            listMap
          )
        );
        return {
          action: 'archived',
          reason: listName === 'Failed' ? 'failed' : 'inactive-list',
        };
      }

      await applications.archiveApplicationByCardId(cardId);
      return { action: 'archived', reason: 'inactive-list' };
    }

    await applications.upsertApplication(
      await toApplicationRecord(
        card,
        listName,
        fieldMap,
        config.TRELLO_BOARD_ID,
        classLabel,
        listMap
      )
    );
    return { action: 'upserted', status: listName };
  } catch (err) {
    if (err.status === 404 || /invalid id/i.test(err.message)) {
      await applications.archiveApplicationByCardId(cardId);
      return { action: 'archived', reason: 'missing-card' };
    }
    throw err;
  }
}

async function runSync(payload) {
  const cardId = payload?.action?.data?.card?.id;
  if (!cardId) {
    return { action: 'ignored', reason: 'missing-card-id' };
  }

  return syncCardById(cardId);
}

async function startSyncScheduler() {
  const config = getConfig();

  await reconcileBoard();

  if (syncTimer) {
    clearInterval(syncTimer);
  }

  syncTimer = setInterval(() => {
    reconcileBoard().catch((err) => {
      logger.error('Scheduled reconciliation failed', {
        message: err.message,
        stack: err.stack,
      });
    });
  }, config.TRELLO_SYNC_INTERVAL_MS);

  if (typeof syncTimer.unref === 'function') {
    syncTimer.unref();
  }
}

async function getCurrentClassLabel() {
  if (currentClassLabel) return currentClassLabel;

  try {
    return await detectCurrentClassLabel();
  } catch (err) {
    logger.warn('Falling back to configured class label', {
      message: err.message,
    });
    return getConfig().CURRENT_CLASS_LABEL;
  }
}

module.exports = {
  parseCreatedAtFromTrelloId,
  getBoardMetadata,
  isTrackedActiveList,
  isApplicationCard,
  isEnrollmentApplicationCard,
  detectCurrentClassLabel,
  getCurrentClassLabel,
  getCardListActivity,
  parseClassNumber,
  toApplicationRecord,
  reconcileBoard,
  syncCardById,
  runSync,
  startSyncScheduler,
};
