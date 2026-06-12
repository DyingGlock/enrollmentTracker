/**
 * Trello API helpers for the enrollment tracker board.
 */

const { getConfig } = require('../config/env');

const TRELLO_BASE = 'https://api.trello.com/1';
const FIELD_NAME = {
  comments: 'Comments',
};

/**
 * @returns {{ key: string, token: string }}
 */
function getTrelloConfig() {
  const config = getConfig();
  if (!config.TRELLO_KEY || !config.TRELLO_TOKEN) {
    throw new Error('Missing TRELLO_KEY or TRELLO_TOKEN in environment.');
  }
  return { key: config.TRELLO_KEY, token: config.TRELLO_TOKEN };
}

/**
 * Execute a Trello API request and parse the JSON response.
 * @param {string} pathname
 * @param {Record<string, string>} [query]
 * @returns {Promise<any>}
 */
async function trelloGet(pathname, query = {}) {
  const trello = getTrelloConfig();
  const url = new URL(`${TRELLO_BASE}${pathname}`);
  url.searchParams.set('key', trello.key);
  url.searchParams.set('token', trello.token);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url);
  const text = await res.text();

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`Trello request failed (${res.status}): ${text}`);
    err.status = res.status;
    throw err;
  }

  return text ? JSON.parse(text) : null;
}

/**
 * Fetch full card by ID.
 * @param {string} cardId - Trello card ID
 * @returns {Promise<object>}
 */
async function fetchCard(cardId) {
  return trelloGet(`/cards/${encodeURIComponent(cardId)}`, {
    fields: 'name,idList,closed,shortUrl,dateLastActivity',
    customFieldItems: 'true',
  });
}

/**
 * Fetch recent list-move activity for a card.
 * @param {string} cardId
 * @returns {Promise<Array<object>>}
 */
async function fetchCardListActions(cardId) {
  return trelloGet(`/cards/${encodeURIComponent(cardId)}/actions`, {
    filter: 'updateCard:idList',
    fields: 'date,data',
    limit: '10',
  });
}

/**
 * Fetch all board lists.
 * @param {string} boardId
 * @returns {Promise<Array<{ id: string, name: string, closed: boolean }>>}
 */
async function fetchBoardLists(boardId) {
  return trelloGet(`/boards/${encodeURIComponent(boardId)}/lists`, {
    filter: 'all',
    fields: 'name,closed',
  });
}

/**
 * Fetch visible cards for the board.
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function fetchBoardCards(boardId) {
  return trelloGet(`/boards/${encodeURIComponent(boardId)}/cards`, {
    filter: 'visible',
    fields: 'name,idList,closed,shortUrl,dateLastActivity',
    customFieldItems: 'true',
  });
}

/**
 * Fetch every board card (open and closed), paginating past the 1000-card limit.
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function fetchAllBoardCards(boardId) {
  const cards = [];
  let before = null;

  for (;;) {
    const query = {
      filter: 'all',
      fields: 'name,id,idList,closed,shortUrl,dateLastActivity',
      customFieldItems: 'true',
      limit: '1000',
    };

    if (before) {
      query.before = before;
    }

    const batch = await trelloGet(
      `/boards/${encodeURIComponent(boardId)}/cards`,
      query
    );

    if (!batch.length) {
      break;
    }

    cards.push(...batch);

    if (batch.length < 1000) {
      break;
    }

    before = batch[batch.length - 1].id;
  }

  return cards;
}

/**
 * Fetch custom field definitions for the board.
 * @param {string} boardId
 * @returns {Promise<Array<object>>}
 */
async function fetchBoardCustomFields(boardId) {
  return trelloGet(`/boards/${encodeURIComponent(boardId)}/customFields`);
}

/**
 * @param {{ value?: { text?: string, number?: string, checked?: string, date?: string } } | null} item
 * @returns {string}
 */
function extractCustomFieldValue(item) {
  if (!item || !item.value) return '';
  const v = item.value;
  if (v.text !== undefined) return String(v.text);
  if (v.number !== undefined) return String(v.number);
  if (v.checked !== undefined) return String(v.checked) === 'true';
  if (v.date !== undefined) return String(v.date);
  return '';
}

/**
 * Build a name → id map for board custom fields.
 * @param {Array<{ id: string, name: string }>} customFields
 * @returns {Record<string, string>}
 */
function buildCustomFieldMap(customFields) {
  return (customFields || []).reduce((acc, field) => {
    acc[String(field.name || '').trim()] = field.id;
    return acc;
  }, {});
}

/**
 * Extract normalized tracker fields from Trello custom field items.
 * @param {Array<{ idCustomField: string, value?: object }>} items
 * @param {Record<string, string>} fieldMap
 * @returns {{ comments: string, attemptNumber: number | null }}
 */
function normalizeApplicationFields(items, fieldMap) {
  const byId = new Map((items || []).map((item) => [item.idCustomField, item]));

  const commentsValue = extractCustomFieldValue(
    byId.get(fieldMap[FIELD_NAME.comments])
  );
  const attemptFieldId =
    fieldMap.Attempt ||
    fieldMap['Attempt Number'] ||
    fieldMap['Attempt #'];
  const attemptValue = extractCustomFieldValue(
    attemptFieldId ? byId.get(attemptFieldId) : null
  );
  const parsedAttempt = Number.parseInt(String(attemptValue || ''), 10);

  return {
    comments: typeof commentsValue === 'string' ? commentsValue.trim() : '',
    attemptNumber: Number.isNaN(parsedAttempt) ? null : parsedAttempt,
  };
}

module.exports = {
  getTrelloConfig,
  trelloGet,
  fetchCard,
  fetchCardListActions,
  fetchBoardLists,
  fetchBoardCards,
  fetchAllBoardCards,
  fetchBoardCustomFields,
  extractCustomFieldValue,
  buildCustomFieldMap,
  normalizeApplicationFields,
  FIELD_NAME,
};
