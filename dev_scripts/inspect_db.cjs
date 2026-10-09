const Database = require('better-sqlite3');
const db = new Database('telemetry.db');

try {
  const rowCount = db.prepare('SELECT count(*) as count FROM telemetry').get();
  console.log('Total rows:', rowCount.count);

  const lastRows = db.prepare('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 5').all();
  console.log('Last 5 rows:', JSON.stringify(lastRows, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
db.close();
