const createTables = (db) => {
  // ✅ better-sqlite3 uses exec() for DDL statements
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL,
      detailPrice REAL,
      wholesalePrice REAL,
      expirationDate TEXT,
      quantity INTEGER DEFAULT 0,
      quantityType TEXT DEFAULT 'unit',
      purchasePrice REAL,
      image TEXT,
      serialNumber TEXT,
      reference TEXT,
      incomplete INTEGER DEFAULT 0,
      addedFrom TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migration: add reference column if it's missing
  try { db.exec('ALTER TABLE products ADD COLUMN reference TEXT'); } catch (e) {} 

  console.log('✅ Products table created or already exists!');

  // ✅ Migrations (better-sqlite3 style)
  try { db.exec('ALTER TABLE products ADD COLUMN detailPrice REAL'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN wholesalePrice REAL'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN expirationDate TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN addedFrom TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN serialNumber TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN quantityType TEXT DEFAULT "unit"'); } catch (e) {}

  // Continue with all other tables using db.exec()...
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      paymentMethod TEXT,
      customerName TEXT,
      clientAddress TEXT,
      clientEmail TEXT,
      clientPhone TEXT,
      clientId TEXT,
      paymentStatus TEXT,
      companyName TEXT,
      companyAddress TEXT,
      companyContact TEXT,
      companyTaxId TEXT,
      companyRC TEXT,
      companyAI TEXT,
      companyNIS TEXT,
      garantieDuration TEXT,
      garantieEndDate TEXT,
      notes TEXT,
      type TEXT,
      source TEXT,
      debt REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Add createdAt/updatedAt columns to invoices if missing (migration)
  try { db.exec('ALTER TABLE invoices ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}
  try { db.exec('ALTER TABLE invoices ADD COLUMN updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}
  // Ensure newly added invoice columns exist
  try { ensureColumn('invoices', 'companyRC', 'companyRC TEXT'); } catch (e) {}
  try { ensureColumn('invoices', 'companyAI', 'companyAI TEXT'); } catch (e) {}
  try { ensureColumn('invoices', 'companyNIS', 'companyNIS TEXT'); } catch (e) {}
  try { ensureColumn('invoices', 'clientRC', 'clientRC TEXT'); } catch (e) {}
  try { ensureColumn('invoices', 'clientAI', 'clientAI TEXT'); } catch (e) {}
  try { ensureColumn('invoices', 'clientNIS', 'clientNIS TEXT'); } catch (e) {}

  // Invoice items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      productId INTEGER NOT NULL,
      productName TEXT NOT NULL,
      serialNumber TEXT,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);
  // Add serialNumber column to invoice_items if not exists (migration)
  try { db.exec('ALTER TABLE invoice_items ADD COLUMN serialNumber TEXT'); } catch (e) {}
  // Add quantityType column to invoice_items if not exists (migration)
  try { db.exec('ALTER TABLE invoice_items ADD COLUMN quantityType TEXT DEFAULT "unit"'); } catch (e) {}

  // Supplier invoices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT UNIQUE NOT NULL,
      supplierName TEXT NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      total REAL NOT NULL,
      paid REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add debt column to supplier_invoices if not exists (migration)
  try { db.exec('ALTER TABLE supplier_invoices ADD COLUMN debt REAL DEFAULT 0'); } catch (e) {}
  // Add createdAt/updatedAt columns to supplier_invoices if missing (migration)
  try { db.exec('ALTER TABLE supplier_invoices ADD COLUMN createdAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}
  try { db.exec('ALTER TABLE supplier_invoices ADD COLUMN updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}

  // Ensure supplier_invoices columns exist (safer)
  try { ensureColumn('supplier_invoices', 'paid', 'paid REAL DEFAULT 0'); } catch (e) {}
  try { ensureColumn('supplier_invoices', 'debt', 'debt REAL DEFAULT 0'); } catch (e) {}
  try { ensureColumn('supplier_invoices', 'status', "status TEXT DEFAULT 'pending'"); } catch (e) {}
  try { ensureColumn('supplier_invoices', 'supplierPhone', 'supplierPhone TEXT'); } catch (e) {}
  try { ensureColumn('supplier_invoices', 'createdAt', 'createdAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}
  try { ensureColumn('supplier_invoices', 'updatedAt', 'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}

  // Supplier invoice items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplierInvoiceId INTEGER NOT NULL,
      productId INTEGER,
      productName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      quantityType TEXT DEFAULT 'unit',
      price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (supplierInvoiceId) REFERENCES supplier_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id)
    )
  `);
  try { db.exec('ALTER TABLE supplier_invoice_items ADD COLUMN quantityType TEXT DEFAULT "unit"'); } catch (e) {}

  // Migration: ensure supplierInvoiceId exists (some older DBs used different column names)
  try {
    const cols = db.prepare('PRAGMA table_info(supplier_invoice_items)').all();
    const hasCamel = cols.find(c => c.name === 'supplierInvoiceId');
    const hasUnderscore = cols.find(c => c.name === 'supplier_invoice_id');
    if (!hasCamel) {
      db.exec('ALTER TABLE supplier_invoice_items ADD COLUMN supplierInvoiceId INTEGER');
      console.log('✅ Migration: added column supplierInvoiceId to supplier_invoice_items');
      if (hasUnderscore) {
        try {
          db.exec('UPDATE supplier_invoice_items SET supplierInvoiceId = supplier_invoice_id');
          console.log('✅ Migration: copied supplier_invoice_id -> supplierInvoiceId');
        } catch (e) {
          console.warn('⚠️ Migration: could not copy supplier_invoice_id -> supplierInvoiceId:', e.message);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Migration: supplier_invoice_items supplierInvoiceId check failed:', e.message);
  }

  // Employees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      salary REAL NOT NULL,
      absences INTEGER DEFAULT 0,
      deduction REAL DEFAULT 0,
      nationalCard TEXT,
      insurance TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      hireDate TEXT,
      startDate TEXT,
      leaveBalance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration helper: adds column only if missing (safer than blind ALTER TABLE)
  function ensureColumn(table, column, definition) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all();
      const exists = cols && cols.find(c => c.name === column);
      if (!exists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
        console.log(`✅ Migration: added column ${column} to ${table}`);
      }
    } catch (e) {
      // Not fatal; continue
      console.warn(`⚠️ Migration: could not ensure column ${column} on ${table}:`, e.message);
    }
  }

  // Ensure employee-related columns exist (fixes missing-column errors on older DBs)
  ensureColumn('employees', 'updatedAt', 'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP');
  ensureColumn('employees', 'absences', 'absences INTEGER DEFAULT 0');
  ensureColumn('employees', 'startDate', 'startDate TEXT');
  ensureColumn('employees', 'leaveBalance', 'leaveBalance REAL DEFAULT 0');
  ensureColumn('employees', 'hireDate', 'hireDate TEXT');
  ensureColumn('employees', 'status', "status TEXT DEFAULT 'active'");

  // Employee Leave table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_leave (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER NOT NULL,
      leaveType TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      days REAL NOT NULL,
      status TEXT DEFAULT 'approved',
      reason TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Employee Bonuses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employee_bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeId INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Locations table (Shops and Stocks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add updatedAt column to locations if not exists (migration)
  try { db.exec('ALTER TABLE locations ADD COLUMN updatedAt TEXT DEFAULT CURRENT_TIMESTAMP'); } catch (e) {}

  // Default locations handled later using a safer query/insert approach.

  // Clients table (customers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      companyName TEXT,
      taxId TEXT,
      rc TEXT,
      ai TEXT,
      nis TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)'); } catch (e) {}
  // Ensure new client identifier columns exist on older DBs
  try { ensureColumn('clients', 'rc', 'rc TEXT'); } catch (e) {}
  try { ensureColumn('clients', 'ai', 'ai TEXT'); } catch (e) {}
  try { ensureColumn('clients', 'nis', 'nis TEXT'); } catch (e) {}

  // Product Locations table (quantity per location)
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      locationId INTEGER NOT NULL,
      quantity REAL DEFAULT 0,
      localization TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
      UNIQUE(productId, locationId)
    )
  `);

  // Location Transfers table (track inventory movements)
  // NOTE: productId now uses ON DELETE CASCADE so transfers are removed when a product is removed.
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      fromLocationId INTEGER,
      toLocationId INTEGER,
      quantity REAL NOT NULL,
      reason TEXT,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (fromLocationId) REFERENCES locations(id),
      FOREIGN KEY (toLocationId) REFERENCES locations(id)
    )
  `);

  // Migration: ensure location_transfers productId FK uses ON DELETE CASCADE (SQLite requires table rebuild)
  try {
    const fkInfo = db.prepare("PRAGMA foreign_key_list(location_transfers)").all();
    const prodFk = fkInfo && fkInfo.find(f => f.table === 'products' && f.from === 'productId');
    if (prodFk && prodFk.on_delete !== 'CASCADE') {
      console.log('🔁 Migration: rebuilding location_transfers to add ON DELETE CASCADE on productId');
      db.exec('BEGIN TRANSACTION');
      db.exec(`
        CREATE TABLE IF NOT EXISTS __location_transfers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          fromLocationId INTEGER,
          toLocationId INTEGER,
          quantity REAL NOT NULL,
          reason TEXT,
          date TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (fromLocationId) REFERENCES locations(id),
          FOREIGN KEY (toLocationId) REFERENCES locations(id)
        )
      `);
      db.exec(`INSERT INTO __location_transfers_new (id, productId, fromLocationId, toLocationId, quantity, reason, date)
               SELECT id, productId, fromLocationId, toLocationId, quantity, reason, date FROM location_transfers`);
      db.exec('DROP TABLE location_transfers');
      db.exec('ALTER TABLE __location_transfers_new RENAME TO location_transfers');
      db.exec('COMMIT');
      console.log('✅ Migration: location_transfers rebuilt with ON DELETE CASCADE');
    }
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch(_) {}
    console.warn('⚠️ Migration: could not ensure ON DELETE CASCADE for location_transfers:', e.message);
  }

try {
    const existingLocations = db.prepare('SELECT COUNT(*) as count FROM locations').get();
    if (existingLocations.count === 0) {
      db.exec(`
        INSERT INTO locations (name, type) VALUES ('Shop 1', 'shop');
        INSERT INTO locations (name, type) VALUES ('Stock 1', 'stock');
      `);
      console.log('✅ Default locations inserted');
    }
  } catch (e) {
    console.log('⚠️ Could not insert default locations:', e.message);
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices(date);
    CREATE INDEX IF NOT EXISTS idx_product_locations_productId ON product_locations(productId);
    CREATE INDEX IF NOT EXISTS idx_product_locations_locationId ON product_locations(locationId);
    CREATE INDEX IF NOT EXISTS idx_location_transfers_productId ON location_transfers(productId);
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
  `);

  console.log('✅ Database schema initialized successfully');
};

module.exports = { createTables };