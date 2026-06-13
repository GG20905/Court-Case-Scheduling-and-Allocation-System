const runSqlFile = require('./runSqlFile');

runSqlFile('queries.sql').catch((error) => {
  console.error('Failed to execute queries.sql', error);
  process.exit(1);
});
