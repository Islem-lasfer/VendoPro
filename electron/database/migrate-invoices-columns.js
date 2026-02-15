// Utility script to force-add all missing columns to the invoices table
const { getDatabase, initDatabase } = require('./db');

const columns = [
  { name: 'clientAddress', type: 'TEXT' },
  { name: 'clientEmail', type: 'TEXT' },
  { name: 'clientPhone', type: 'TEXT' },
  { name: 'clientId', type: 'TEXT' },
  { name: 'paymentStatus', type: 'TEXT' },
  { name: 'companyName', type: 'TEXT' },
  { name: 'companyAddress', type: 'TEXT' },
  { name: 'companyContact', type: 'TEXT' },
  { name: 'companyTaxId', type: 'TEXT' },
  { name: 'garantieDuration', type: 'TEXT' },
  { name: 'garantieEndDate', type: 'TEXT' },
  { name: 'source', type: 'TEXT' }
];

async function migrate() {
  await initDatabase();
  const db = getDatabase();
  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE invoices ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added column: ${col.name}`);
    } catch (e) {
      if (e.message && e.message.includes('duplicate column name')) {
        console.log(`Column already exists: ${col.name}`);
      } else {
        console.error(`Error adding column ${col.name}:`, e.message);
      }
    }
  }
  console.log('Migration complete.');
}

migrate();