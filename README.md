# Enrollment Tracker

Trello-backed enrollment tracker website for the `POST Enrollment Exams` board. The app mirrors tracked Trello cards into PostgreSQL, serves a read-only tracker website, and keeps itself in sync via webhooks plus periodic full-board reconciliation.

## What It Does

- Uses Trello board `5a46fb92d46aeb4f84445b53` as the source of truth.
- Stores tracked applications in PostgreSQL instead of Google Sheets.
- Shows active applications at `/`.
- Shows archived applications at `/archived`.
- Accepts Trello webhooks at `/api/trello-webhook` and `/trello-webhook`.
- Reconciles the whole board on startup and on an interval to repair missed webhook events.

Tracked active lists:

- `Pending`
- `Phase 1 - Profile Screening`
- `Phase 2 - Application Reading`
- `Phase 3 - Background Check`
- `Phase 4 - Administration Review`
- `Passed`
- `On Hold`

Cards moved to `Failed`, that leave the tracked lists above, are deleted, or are closed are marked archived.

## Routes

| Method | Path                          | Purpose |
| ------ | ----------------------------- | ------- |
| GET    | `/`                           | Active tracker page |
| GET    | `/archived`                   | Archived tracker page |
| GET    | `/api/health`                 | Health check |
| GET    | `/health`                     | Compatibility health alias |
| GET    | `/api/current-class`          | Current class label and active counts |
| GET    | `/api/applications`           | Active applications JSON |
| GET    | `/api/applications/archived`  | Archived applications JSON |
| HEAD   | `/api/trello-webhook`         | Trello callback validation |
| GET    | `/api/trello-webhook`         | Webhook readiness check |
| POST   | `/api/trello-webhook`         | Trello webhook ingestion |
| HEAD   | `/trello-webhook`             | Compatibility webhook alias |
| GET    | `/trello-webhook`             | Compatibility webhook alias |
| POST   | `/trello-webhook`             | Compatibility webhook alias |

## Environment

Required:

- `TRELLO_KEY`
- `TRELLO_TOKEN`
- `DATABASE_URL`

Recommended:

- `CURRENT_CLASS_LABEL`
- `TRELLO_BOARD_ID`
- `TRELLO_SYNC_INTERVAL_MS`
- `PORT`

Example local `.env`:

```bash
PORT=5003
TRELLO_KEY=...
TRELLO_TOKEN=...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qa_enrollmentTracker?schema=public
CURRENT_CLASS_LABEL=Class 1
TRELLO_BOARD_ID=5a46fb92d46aeb4f84445b53
TRELLO_SYNC_INTERVAL_MS=300000
```

## Database Names

- Dev and QA: `qa_enrollmentTracker`
- Production: `prod_enrollmentTracker`

Create them manually if needed:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c 'CREATE DATABASE "qa_enrollmentTracker";'
PGPASSWORD=postgres psql -h localhost -U postgres -d postgres -c 'CREATE DATABASE "prod_enrollmentTracker";'
```

## Setup

```bash
npm install
npm run db:migrate
npm run dev
```

The server will:

1. ensure the schema exists
2. reconcile the tracked Trello board into PostgreSQL
3. start serving the tracker website

## Testing

```bash
npm test
```

## PM2

```bash
pm2 start src/server.js --name enrollment-tracker
pm2 save
```
