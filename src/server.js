/**
 * Server entry point. Starts Express app, ensures DB schema exists, and begins sync.
 * PM2: pm2 start src/server.js --name enrollment-tracker
 */

const app = require('./app');
const { getConfig } = require('./config/env');
const { migrate } = require('./db/migrate');
const { startSyncScheduler } = require('./services/sync');
const logger = require('./utils/logger');

async function main() {
  const config = getConfig();
  const port = config.PORT;

  await migrate();
  await startSyncScheduler();

  const server = app.listen(port, () => {
    logger.info('Enrollment tracker listening', {
      url: `http://localhost:${port}`,
      port,
      env: config.NODE_ENV,
      boardId: config.TRELLO_BOARD_ID,
      currentClass: config.CURRENT_CLASS_LABEL,
    });
  });

  server.on('error', (err) => {
    logger.error('Server error', { message: err.message });
    process.exitCode = 1;
  });
}

main().catch((err) => {
  logger.error('Startup failure', { message: err.message, stack: err.stack });
  process.exit(1);
});
