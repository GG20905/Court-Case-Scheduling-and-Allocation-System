const runSqlFile = require('./runSqlFile');

runSqlFile('schema.sql').catch((error) => {
  console.error('Failed to execute schema.sql', error);
  process.exit(1);
});
