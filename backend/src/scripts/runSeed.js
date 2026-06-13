const runSqlFile = require('./runSqlFile');

runSqlFile('seed.sql').catch((error) => {
  console.error('Failed to execute seed.sql', error);
  process.exit(1);
});
