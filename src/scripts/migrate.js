const { migrate } = require('../db/migrate');
const logger = require('../utils/logger');

migrate()
  .then(() => {
    logger.info('Database migration completed');
  })
  .catch((err) => {
    logger.error('Database migration failed', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
