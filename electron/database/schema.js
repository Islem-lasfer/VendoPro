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
      incomplete INTEGER DEFAULT 0,
      addedFrom TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      garantieDuration TEXT,
      garantieEndDate TEXT,
      notes TEXT,
      type TEXT,
      source TEXT,
      debt REAL DEFAULT 0,
      paid REAL DEFAULT 0
    )
  `);

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
      notes TEXT
    )
  `);
  
  // Add debt column to supplier_invoices if not exists (migration)
  try { db.exec('ALTER TABLE supplier_invoices ADD COLUMN debt REAL DEFAULT 0'); } catch (e) {}

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
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)'); } catch (e) {}

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      fromLocationId INTEGER,
      toLocationId INTEGER,
      quantity REAL NOT NULL,
      reason TEXT,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (fromLocationId) REFERENCES locations(id),
      FOREIGN KEY (toLocationId) REFERENCES locations(id)
    )
  `);

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