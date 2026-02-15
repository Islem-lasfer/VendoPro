// Seed script to populate electron/database/pos.db with sample data (ESM-compatible)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Robust schema loader (works in dev and packaged installs)
const candidates = [
  path.join(__dirname, '..', 'electron', 'database', 'schema.js'),
  path.join(process.cwd(), 'electron', 'database', 'schema.js'),
  path.join(process.cwd(), '..', 'electron', 'database', 'schema.js')
];
let schema = null;
for (const p of candidates) {
  try {
    if (fs.existsSync(p)) {
      console.log('📂 Loading schema for seeding from:', p);
      schema = require(p);
      break;
    }
  } catch (e) {
    // ignore
  }
}
if (!schema) {
  try {
    schema = require('electron/database/schema.js');
    console.log('📂 Loaded schema via module name resolution');
  } catch (e) {
    // ignore
  }
}
const createTables = schema && (schema.createTables || (schema.default && schema.default.createTables));

const dbPath = path.join(process.cwd(), '..', 'electron', 'database', 'pos.db');
const db = new Database(dbPath);

// Wrap better-sqlite3 Database with run/exec/prepare for compatibility with schema.js
const wrappedDb = {
  run: (sql) => db.exec(sql),
  exec: (sql) => db.exec(sql),
  prepare: (sql) => db.prepare(sql),
  transaction: (fn) => db.transaction(fn)
};

async function defaultRun() {
  try {
    console.log('🔧 Ensuring schema exists...');
    createTables(wrappedDb);

    // Helpers (use real db prepare for DML)
    const run = (sql, params = []) => db.prepare(sql).run(...params);
    const get = (sql, params = []) => db.prepare(sql).get(...params);
    const all = (sql, params = []) => db.prepare(sql).all(...params);

    // Insert locations if none
    const locCount = get('SELECT COUNT(*) as c FROM locations').c;
    if (locCount === 0) {
      console.log('➕ Inserting default locations');
      run("INSERT INTO locations (name, type) VALUES ('Shop 1','shop')");
      run("INSERT INTO locations (name, type) VALUES ('Stock 1','stock')");
    }

    // Insert sample products
    const pCount = get('SELECT COUNT(*) as c FROM products').c;
    if (pCount === 0) {
      console.log('➕ Inserting sample products');
      const prods = [
        { barcode: '123456789012', name: 'Banana', category: 'Fruits', price: 0.5 },
        { barcode: '234567890123', name: 'Milk 1L', category: 'Dairy', price: 1.2 },
        { barcode: '345678901234', name: 'Coffee Pack', category: 'Beverages', price: 3.5 }
      ];
      for (const p of prods) {
        const info = run('INSERT INTO products (barcode, name, category, price, quantity) VALUES (?, ?, ?, ?, ?)', [p.barcode, p.name, p.category, p.price, 0]);
        const id = info.lastInsertRowid || info.lastInsertROWID || info.lastInsertId;
        // Add product locations
        run('INSERT OR REPLACE INTO product_locations (productId, locationId, quantity) VALUES (?, ?, ?)', [id, 1, Math.floor(Math.random()*20)+5]);
        run('INSERT OR REPLACE INTO product_locations (productId, locationId, quantity) VALUES (?, ?, ?)', [id, 2, Math.floor(Math.random()*100)+10]);
        // update product total quantity
        const total = get('SELECT COALESCE(SUM(quantity),0) as s FROM product_locations WHERE productId = ?', [id]).s;
        run('UPDATE products SET quantity = ? WHERE id = ?', [total, id]);
      }
    }

    // Insert sample employees
    const eCount = get('SELECT COUNT(*) as c FROM employees').c;
    if (eCount === 0) {
      console.log('➕ Inserting sample employees');
      run('INSERT INTO employees (name, position, salary, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)', ['Alice Dupont', 'Cashier', 25000, '0612345678', 'alice@example.com', '123 Main St']);
      run('INSERT INTO employees (name, position, salary, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)', ['Bob Martin', 'Manager', 35000, '0698765432', 'bob@example.com', '45 Market Ave']);
    }

    // Insert a sample invoice
    const invCount = get('SELECT COUNT(*) as c FROM invoices').c;
    if (invCount === 0) {
      console.log('➕ Inserting sample invoice');
      const invoiceInfo = run('INSERT INTO invoices (invoiceNumber, subtotal, discount, tax, total, paymentMethod, customerName, type, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ['INV-1001', 10.0, 0.0, 0.6, 10.6, 'cash', 'Client A', 'sale', new Date().toISOString()]);
      const invoiceId = invoiceInfo.lastInsertRowid || invoiceInfo.lastInsertId || invoiceInfo.lastInsertROWID;
      // pick a product
      const prod = all('SELECT id, price FROM products LIMIT 1')[0];
      if (prod) {
        run('INSERT INTO invoice_items (invoiceId, productId, productName, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)', [invoiceId, prod.id, 'Sample Item', 2, prod.price, prod.price * 2]);
        // decrement product quantity
        run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [2, prod.id]);
      }
    }

    console.log('✅ Seeding complete');
    console.log('Counts after seed:');
    console.log('locations:', get('SELECT COUNT(*) as c FROM locations').c);
    console.log('products:', get('SELECT COUNT(*) as c FROM products').c);
    console.log('product_locations:', get('SELECT COUNT(*) as c FROM product_locations').c);
    console.log('employees:', get('SELECT COUNT(*) as c FROM employees').c);
    console.log('invoices:', get('SELECT COUNT(*) as c FROM invoices').c);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

defaultRun();