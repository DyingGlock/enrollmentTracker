/**
 * Import historical exam results into PostgreSQL by matching Trello archived cards.
 *
 * Usage:
 *   node src/scripts/importExamResults.js --outcome failed
 *   node src/scripts/importExamResults.js --outcome passed
 *   node src/scripts/importExamResults.js --outcome all
 */

require('dotenv').config();

const { getConfig } = require('../config/env');
const applications = require('../repositories/applications');
const sync = require('../services/sync');
const trello = require('../services/trello');
const logger = require('../utils/logger');

const EXAM_RESULTS = [
  { identifier: 'Sandiegolapd:3397090925', classNumber: 93, passed: true, notes: 'Great application, well done.' },
  { identifier: 'Foxvvyy:1668903906', classNumber: 93, passed: true, notes: 'Great effort. This is one of the best applications I’ve come across.' },
  { identifier: 'towerofhell3q81:5062185775', classNumber: 93, passed: true, notes: '' },
  { identifier: 'Stormdoesroblox:45066613', classNumber: 93, passed: true, notes: '' },
  { identifier: 'NGZero2549:1759873687', classNumber: 93, passed: true, notes: 'Good effort!' },
  { identifier: 'Ne1_Iy:66347235', classNumber: 93, passed: true, notes: 'Exceptional Application.' },
  { identifier: 'hockeybob8:905251703', classNumber: 93, passed: true, notes: '' },
  { identifier: 'DogTrippenCards:145793616', classNumber: 93, passed: true, notes: 'Good application' },
  { identifier: 'NaydenVeteran:489244162', classNumber: 93, passed: true, notes: 'The applicant displayed exceptional detail and effort, this application goes beyond our expectations. One of the best I’ve come across in a while, outstanding work!' },
  { identifier: 'lionking6372365:80114869', classNumber: 93, passed: true, notes: '' },
  { identifier: 'Disneythriver2005:1400021155', classNumber: 93, passed: true, notes: '' },
  { identifier: 'MarionLaw71:43818907', classNumber: 93, passed: true, notes: '' },
  { identifier: 'chewaliciousJr:964730218', classNumber: 93, passed: true, notes: 'Great application!' },
  { identifier: 'Obx_RBLX:2633946921', classNumber: 93, passed: true, notes: '' },
  { identifier: 'JustDevThingz:2734466851', classNumber: 93, passed: false, notes: '' },
  { identifier: 'fghkkport:4108890478', classNumber: 93, passed: false, notes: 'Failed P1 - Profile Screening' },
  { identifier: '678melllie:1521719054', classNumber: 93, passed: false, notes: "There's  Lack of Detail and Effort in this application." },
  { identifier: 'Albani_an:2050927514', classNumber: 93, passed: false, notes: '' },
  { identifier: 'dgfgfrgdhrytgfdhjh:444094016', classNumber: 93, passed: false, notes: 'Failed Background Check.' },
  { identifier: 'witchmane:50787343', classNumber: 93, passed: false, notes: 'Correction: Failed P3 - Background Check' },
  { identifier: 'Spudaroo102:8613543999', classNumber: 93, passed: false, notes: 'Double Application' },
  { identifier: 'Spudaroo102:8613543999', classNumber: 93, passed: false, notes: '' },
  { identifier: 'BillActual:787601715', classNumber: 93, passed: false, notes: 'FS Executive  - Leve A No Hire List' },
  { identifier: 'ironfist1446:114492851', classNumber: 93, passed: false, notes: 'Failed P3 - Do not reapply.' },
  { identifier: 'monaldoz43:304976565', classNumber: 93, passed: false, notes: 'Failed P2: Lack of Depth and Specifications (Generic Application)' },
  { identifier: 'Teorecos:1727286462', classNumber: 93, passed: false, notes: '' },
  { identifier: 'boss210698:215101874', classNumber: 93, passed: false, notes: '' },
  { identifier: '678melllie:1521719054', classNumber: 93, passed: false, notes: 'Unsatisfactory Application' },
  { identifier: 'PixelatedLegoBlock:548072557', classNumber: 93, passed: false, notes: '' },
  { identifier: 'kryingtearz:7016699044', classNumber: 93, passed: false, notes: '' },
  { identifier: 'pacman5630:136690720', classNumber: 93, passed: false, notes: 'Low effort' },
  { identifier: 'deathrazier:17406508', classNumber: 93, passed: false, notes: 'Grammatical errors' },
  { identifier: 'JosipRosenheim:334900634', classNumber: 93, passed: false, notes: 'Failed P1 - Profile Screening' },
  { identifier: 'The_Blueco:1563734593', classNumber: 93, passed: false, notes: 'Failed to Provide Valid 2FA/Safechat' },
  { identifier: 'cotooth:63164820', classNumber: 93, passed: false, notes: 'No effort.' },
  { identifier: 'FalconFlamer463:400911124', classNumber: 93, passed: false, notes: '' },
  { identifier: 'CynicalJayski:198611170', classNumber: 93, passed: false, notes: 'Failed P3 - BGC' },
  { identifier: 'BrxdySider:1138922672', classNumber: 93, passed: false, notes: '' },
  { identifier: 'SouthwestOperatorz:1584972901', classNumber: 93, passed: false, notes: 'AI Detection' },
  { identifier: 'ServacDobromuz:3887290899', classNumber: 93, passed: false, notes: 'Failed to resubmit 2FA within 24hrs.' },
  { identifier: 'fcundyou:524672656', classNumber: 93, passed: false, notes: 'AI Detection' },
];

function parseOutcomeArg(argv) {
  const index = argv.indexOf('--outcome');
  if (index === -1) return 'failed';

  const value = String(argv[index + 1] || '').trim().toLowerCase();
  if (!value || !['failed', 'passed', 'all'].includes(value)) {
    throw new Error('Usage: node src/scripts/importExamResults.js --outcome failed|passed|all');
  }

  return value;
}

function extractUsername(identifier) {
  const value = String(identifier || '').trim();
  const colonIndex = value.indexOf(':');
  return colonIndex === -1 ? value : value.slice(0, colonIndex);
}

function cardMatchesUsername(cardName, username) {
  const normalizedCard = String(cardName || '').trim().toLowerCase();
  const normalizedUser = String(username || '').trim().toLowerCase();

  return (
    normalizedCard === normalizedUser ||
    normalizedCard.startsWith(`${normalizedUser}:`)
  );
}

function isApplicationCard(card, config, listName) {
  return sync.isApplicationCard(card, config, listName);
}

function sortCardsByRecency(cards) {
  return [...cards].sort((left, right) => {
    const leftDate = new Date(left.dateLastActivity || 0).getTime();
    const rightDate = new Date(right.dateLastActivity || 0).getTime();
    return rightDate - leftDate;
  });
}

function pickCardForRow(cardsByUsername, identifier, rowIndexByIdentifier) {
  const username = extractUsername(identifier);
  const matches = sortCardsByRecency(cardsByUsername.get(username) || []);
  const occurrence = rowIndexByIdentifier.get(identifier) || 0;
  rowIndexByIdentifier.set(identifier, occurrence + 1);

  return matches[occurrence] || null;
}

function buildCardsByUsername(cards, config, listMap) {
  const cardsByUsername = new Map();

  for (const card of cards) {
    const listName = listMap.get(card.idList) || '';
    if (!isApplicationCard(card, config, listName)) continue;

    const rawName = String(card.name || '').trim();
    const username = extractUsername(rawName);
    if (!username) continue;

    const bucket = cardsByUsername.get(username) || [];
    bucket.push(card);
    cardsByUsername.set(username, bucket);
  }

  for (const [username, bucket] of cardsByUsername.entries()) {
    cardsByUsername.set(username, sortCardsByRecency(bucket));
  }

  return cardsByUsername;
}

async function importExamResults(outcome) {
  const config = getConfig();
  const { listMap, fieldMap } = await sync.getBoardMetadata(true);
  const boardCards = await trello.fetchAllBoardCards(config.TRELLO_BOARD_ID);
  const cardsByUsername = buildCardsByUsername(boardCards, config, listMap);
  const rowIndexByIdentifier = new Map();

  const rows = EXAM_RESULTS.filter((row) => {
    if (outcome === 'all') return true;
    if (outcome === 'passed') return row.passed;
    return !row.passed;
  });

  const summary = {
    imported: 0,
    missing: [],
    errors: [],
  };

  for (const row of rows) {
    const username = extractUsername(row.identifier);
    const card = pickCardForRow(cardsByUsername, row.identifier, rowIndexByIdentifier);
    const listName = row.passed ? 'Passed' : 'Failed';

    if (!card) {
      summary.missing.push({ identifier: row.identifier, username, outcome: listName });
      continue;
    }

    try {
      const record = await sync.toApplicationRecord(
        card,
        listName,
        fieldMap,
        config.TRELLO_BOARD_ID,
        `Class ${row.classNumber}`,
        listMap
      );

      record.classNumber = row.classNumber;
      record.classLabel = `Class ${row.classNumber}`;
      record.currentListName = listName;
      if (row.notes) {
        record.comments = row.notes;
      }

      await applications.archiveApplication(record);
      summary.imported += 1;
      logger.info('Imported exam result', {
        identifier: row.identifier,
        cardId: card.id,
        cardName: card.name,
        outcome: listName,
      });
    } catch (err) {
      summary.errors.push({
        identifier: row.identifier,
        cardId: card.id,
        message: err.message,
      });
    }
  }

  return summary;
}

async function main() {
  const outcome = parseOutcomeArg(process.argv.slice(2));
  const summary = await importExamResults(outcome);

  logger.info('Exam result import completed', summary);

  if (summary.missing.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error('Exam result import failed', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
