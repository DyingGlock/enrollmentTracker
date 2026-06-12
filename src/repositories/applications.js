const { query } = require('../db');
const {
  IGNORED_LIST_NAMES,
  TRACKED_APPLICANT_LIST_NAMES,
  normalizeStatusLabel,
} = require('../config/tracker');

const APPLICANT_NAME_PATTERN = '^[^:]+:[0-9]+$';

function mapRow(row) {
  return {
    id: row.id,
    cardId: row.trello_card_id,
    boardId: row.board_id,
    name: row.name,
    classLabel: row.class_label,
    classNumber: row.class_number,
    attemptNumber: row.attempt_number,
    status: normalizeStatusLabel(row.current_list_name),
    rawStatus: row.current_list_name,
    currentListId: row.current_list_id,
    previousListId: row.previous_list_id,
    previousListName: row.previous_list_name,
    comments: row.comments,
    createdAt: row.created_at_trello ? row.created_at_trello.toISOString() : null,
    updatedAt: row.updated_at_trello ? row.updated_at_trello.toISOString() : null,
    archived: row.is_archived,
    isArchived: row.is_archived,
    archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
  };
}

async function upsertApplication(application) {
  const result = await query(
    `
      INSERT INTO applications (
        trello_card_id,
        board_id,
        name,
        class_label,
        class_number,
        attempt_number,
        current_list_id,
        current_list_name,
        previous_list_id,
        previous_list_name,
        comments,
        created_at_trello,
        updated_at_trello,
        is_archived,
        archived_at,
        last_synced_at,
        raw_trello
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE, NULL, NOW(), $14::jsonb
      )
      ON CONFLICT (trello_card_id) DO UPDATE SET
        board_id = EXCLUDED.board_id,
        name = EXCLUDED.name,
        class_label = EXCLUDED.class_label,
        class_number = EXCLUDED.class_number,
        attempt_number = EXCLUDED.attempt_number,
        current_list_id = EXCLUDED.current_list_id,
        current_list_name = EXCLUDED.current_list_name,
        previous_list_id = EXCLUDED.previous_list_id,
        previous_list_name = EXCLUDED.previous_list_name,
        comments = EXCLUDED.comments,
        created_at_trello = EXCLUDED.created_at_trello,
        updated_at_trello = EXCLUDED.updated_at_trello,
        is_archived = FALSE,
        archived_at = NULL,
        last_synced_at = NOW(),
        raw_trello = EXCLUDED.raw_trello
      RETURNING *
    `,
    [
      application.cardId,
      application.boardId,
      application.name,
      application.classLabel,
      application.classNumber,
      application.attemptNumber,
      application.currentListId,
      application.currentListName,
      application.previousListId,
      application.previousListName,
      application.comments,
      application.createdAt,
      application.updatedAt,
      JSON.stringify(application.rawTrello),
    ]
  );

  return mapRow(result.rows[0]);
}

async function archiveApplication(application) {
  const result = await query(
    `
      INSERT INTO applications (
        trello_card_id,
        board_id,
        name,
        class_label,
        class_number,
        attempt_number,
        current_list_id,
        current_list_name,
        previous_list_id,
        previous_list_name,
        comments,
        created_at_trello,
        updated_at_trello,
        is_archived,
        archived_at,
        last_synced_at,
        raw_trello
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, NOW(), NOW(), $14::jsonb
      )
      ON CONFLICT (trello_card_id) DO UPDATE SET
        board_id = EXCLUDED.board_id,
        name = EXCLUDED.name,
        class_label = EXCLUDED.class_label,
        class_number = EXCLUDED.class_number,
        attempt_number = EXCLUDED.attempt_number,
        current_list_id = EXCLUDED.current_list_id,
        current_list_name = EXCLUDED.current_list_name,
        previous_list_id = EXCLUDED.previous_list_id,
        previous_list_name = EXCLUDED.previous_list_name,
        comments = EXCLUDED.comments,
        created_at_trello = EXCLUDED.created_at_trello,
        updated_at_trello = EXCLUDED.updated_at_trello,
        is_archived = TRUE,
        archived_at = COALESCE(applications.archived_at, NOW()),
        last_synced_at = NOW(),
        raw_trello = EXCLUDED.raw_trello
      RETURNING *
    `,
    [
      application.cardId,
      application.boardId,
      application.name,
      application.classLabel,
      application.classNumber,
      application.attemptNumber,
      application.currentListId,
      application.currentListName,
      application.previousListId,
      application.previousListName,
      application.comments,
      application.createdAt,
      application.updatedAt,
      JSON.stringify(application.rawTrello),
    ]
  );

  return mapRow(result.rows[0]);
}

async function archiveApplicationByCardId(trelloCardId) {
  const result = await query(
    `
      UPDATE applications
      SET is_archived = TRUE,
          archived_at = COALESCE(archived_at, NOW()),
          last_synced_at = NOW()
      WHERE trello_card_id = $1
      RETURNING *
    `,
    [trelloCardId]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

async function deleteApplicationByCardId(trelloCardId) {
  const result = await query(
    `
      DELETE FROM applications
      WHERE trello_card_id = $1
      RETURNING id
    `,
    [trelloCardId]
  );

  return result.rowCount;
}

async function deleteUntrackedApplications(boardId) {
  const result = await query(
    `
      DELETE FROM applications
      WHERE board_id = $1
        AND (
          current_list_name = ANY($2::text[])
          OR current_list_name <> ALL($3::text[])
          OR name !~ $4
        )
      RETURNING id
    `,
    [boardId, IGNORED_LIST_NAMES, TRACKED_APPLICANT_LIST_NAMES, APPLICANT_NAME_PATTERN]
  );

  return result.rowCount;
}

async function deleteApplicationsOnIgnoredLists(boardId) {
  return deleteUntrackedApplications(boardId);
}

async function archiveMissingActiveApplications(boardId, activeCardIds) {
  const result = await query(
    `
      UPDATE applications
      SET is_archived = TRUE,
          archived_at = COALESCE(archived_at, NOW()),
          last_synced_at = NOW()
      WHERE board_id = $1
        AND is_archived = FALSE
        AND NOT (trello_card_id = ANY($2::text[]))
      RETURNING id
    `,
    [boardId, activeCardIds]
  );

  return result.rowCount;
}

async function getActiveApplications() {
  const result = await query(
    `
      SELECT *
      FROM applications
      WHERE is_archived = FALSE
        AND current_list_name = ANY($1::text[])
        AND name ~ $2
      ORDER BY
        CASE current_list_name
          WHEN 'Pending' THEN 1
          WHEN 'Phase 1 - Profile Screening' THEN 2
          WHEN 'Phase 2 - Application Reading' THEN 3
          WHEN 'Phase 3 - Background Check' THEN 4
          WHEN 'Phase 4 - Administration Review' THEN 5
          WHEN 'Passed' THEN 6
          WHEN 'Failed' THEN 7
          WHEN 'On Hold' THEN 8
          ELSE 99
        END,
        class_number DESC NULLS LAST,
        updated_at_trello DESC NULLS LAST,
        name ASC
    `,
    [TRACKED_APPLICANT_LIST_NAMES, APPLICANT_NAME_PATTERN]
  );

  return result.rows.map(mapRow);
}

async function getArchivedApplications() {
  const result = await query(
    `
      SELECT *
      FROM applications
      WHERE is_archived = TRUE
        AND current_list_name = ANY($1::text[])
        AND name ~ $2
      ORDER BY archived_at DESC NULLS LAST, updated_at_trello DESC NULLS LAST, name ASC
    `,
    [TRACKED_APPLICANT_LIST_NAMES, APPLICANT_NAME_PATTERN]
  );

  return result.rows.map(mapRow);
}

async function getActiveStatusCounts() {
  const result = await query(
    `
      SELECT current_list_name AS status, COUNT(*)::int AS count
      FROM applications
      WHERE is_archived = FALSE
        AND current_list_name = ANY($1::text[])
        AND name ~ $2
      GROUP BY current_list_name
      ORDER BY current_list_name ASC
    `,
    [TRACKED_APPLICANT_LIST_NAMES, APPLICANT_NAME_PATTERN]
  );

  return result.rows.map((row) => ({
    status: normalizeStatusLabel(row.status),
    count: row.count,
  }));
}

module.exports = {
  upsertApplication,
  archiveApplication,
  archiveApplicationByCardId,
  deleteApplicationByCardId,
  deleteUntrackedApplications,
  deleteApplicationsOnIgnoredLists,
  archiveMissingActiveApplications,
  getActiveApplications,
  getArchivedApplications,
  getActiveStatusCounts,
};
