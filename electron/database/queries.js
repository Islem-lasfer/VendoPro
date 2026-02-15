const { getDatabase, saveDatabase } = require('./db');

// Helper function to execute SELECT queries (better-sqlite3)
const executeSelect = (query, params = []) => {
  const db = getDatabase();
  try {
    if (params && params.length > 0) return db.prepare(query).all(...params);
    return db.prepare(query).all();
  } catch (err) {
    console.error('DB SELECT error:', err.message, 'Query:', query, 'Params:', params);
    return [];
  }
};

// Helper function to execute INSERT/UPDATE/DELETE queries (better-sqlite3)
const executeModify = (query, params = []) => {
  const db = getDatabase();
  try {
    const stmt = db.prepare(query);
    if (params && params.length > 0) stmt.run(...params);
    else stmt.run();
    saveDatabase();
  } catch (err) {
    console.error('DB MODIFY error:', err.message, 'Query:', query, 'Params:', params);
    throw err;
  }
};

// Helper function to get last insert ID (better-sqlite3)
const getLastInsertId = () => {
  const db = getDatabase();
  try {
    const row = db.prepare('SELECT last_insert_rowid() as id').get();
    if (row && typeof row.id !== 'undefined' && row.id !== 0) {
      console.log('Electron Debug: last_insert_rowid() ->', row.id);
      return row.id;
    }
  } catch (err) {
    console.warn('Electron Debug: last_insert_rowid() failed:', err.message);
  }

  // Fallback: query the last product id directly
  try {
    const row2 = db.prepare('SELECT id FROM products ORDER BY id DESC LIMIT 1').get();
    if (row2 && typeof row2.id !== 'undefined') {
      console.log('Electron Debug: fallback last id ->', row2.id);
      return row2.id;
    }
  } catch (err) {
    console.error('Electron Debug: fallback last id query failed:', err.message);
  }

  console.warn('Electron Debug: getLastInsertId returning 0');
  return 0;
};

// ============= PRODUCTS =============

const getAllProducts = () => {
  const products = executeSelect(`
    SELECT 
      p.*,
      COALESCE(SUM(pl.quantity), 0) as totalQuantity
    FROM products p
    LEFT JOIN product_locations pl ON p.id = pl.productId
    GROUP BY p.id
    ORDER BY p.name
  `);
  
  // Load location quantities for each product
  products.forEach(product => {
    product.locationQuantities = {};
    const locations = executeSelect(`
      SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `, [product.id]);
    
    locations.forEach(loc => {
      product.locationQuantities[loc.locationId] = {
        quantity: loc.quantity,
        localization: loc.localization,
        locationName: loc.locationName,
        locationType: loc.locationType
      };
      // Add flattened fields for UI compatibility
      product[`loc_${loc.locationId}_qty`] = loc.quantity;
      product[`loc_${loc.locationId}_pos`] = loc.localization || '';
    });
  });
  
  return products;
};

const getProductById = (id) => {
  const results = executeSelect(`
    SELECT 
      p.*,
      COALESCE(SUM(pl.quantity), 0) as totalQuantity
    FROM products p
    LEFT JOIN product_locations pl ON p.id = pl.productId
    WHERE p.id = ?
    GROUP BY p.id
  `, [id]);
  
  if (results.length > 0) {
    const product = results[0];
    // Load location quantities
    product.locationQuantities = {};
    const locations = executeSelect(`
      SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `, [id]);
    
    locations.forEach(loc => {
      product.locationQuantities[loc.locationId] = {
        quantity: loc.quantity,
        localization: loc.localization,
        locationName: loc.locationName,
        locationType: loc.locationType
      };
      // Add flattened fields for UI compatibility
      product[`loc_${loc.locationId}_qty`] = loc.quantity;
      product[`loc_${loc.locationId}_pos`] = loc.localization || '';
    });
    
    return product;
  }
  
  return null;
};

const getProductByBarcode = (barcode) => {
  const results = executeSelect('SELECT * FROM products WHERE barcode = ?', [barcode]);
  return results.length > 0 ? results[0] : null;
};

const createProduct = (product) => {
  console.log('Electron Debug: createProduct called with', product);
  // Calculate total quantity from location quantities
  let totalQuantity = product.quantity || 0;
  if (product.locationQuantities && typeof product.locationQuantities === 'object') {
    totalQuantity = Object.values(product.locationQuantities).reduce((sum, loc) => {
      return sum + (parseFloat(loc.quantity) || 0);
    }, 0);
  }

  executeModify(`
    INSERT INTO products (barcode, name, category, price, detailPrice, wholesalePrice, expirationDate, quantity, quantityType, purchasePrice, image, serialNumber, reference, incomplete, addedFrom, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    product.barcode || null,
    product.name,
    product.category || null,
    product.price,
    product.detailPrice || null,
    product.wholesalePrice || null,
    product.expirationDate || null,
    totalQuantity,
    product.quantityType || 'unit',
    product.purchasePrice || null,
    product.image || null,
    product.serialNumber || null,
    product.reference || null,
    product.incomplete || 0,
    product.addedFrom || null,
    product.createdAt || new Date().toISOString()
  ]);
  const id = getLastInsertId();
  console.log('Electron Debug: createProduct inserted id =', id);
  if (!id || id === 0) {
    console.error('Electron Error: createProduct failed to obtain a valid insert id');
  }
  
  // Handle location quantities if provided
  if (product.locationQuantities && typeof product.locationQuantities === 'object') {
    Object.entries(product.locationQuantities).forEach(([locationId, locData]) => {
      if (locData && typeof locData === 'object') {
        setProductLocationQuantity(id, parseInt(locationId), locData.quantity || 0, locData.localization || null);
      }
    });
  }
  
  // Load location quantities for the returned product
  const locationQuantities = {};
  const locs = executeSelect(`
    SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
    FROM product_locations pl
    JOIN locations l ON pl.locationId = l.id
    WHERE pl.productId = ?
    ORDER BY l.type, l.name
  `, [id]);
  locs.forEach(loc => {
    locationQuantities[loc.locationId] = {
      quantity: loc.quantity,
      localization: loc.localization,
      locationName: loc.locationName,
      locationType: loc.locationType
    };
  });
  
  // Build response and include flattened location fields for UI
  const response = { id, ...product, totalQuantity, locationQuantities };
  locs.forEach(loc => {
    response[`loc_${loc.locationId}_qty`] = loc.quantity;
    response[`loc_${loc.locationId}_pos`] = loc.localization || '';
  });

  return response;
};

const updateProduct = (id, product) => {
  // Calculate total quantity from location quantities
  let totalQuantity = product.quantity || 0;
  if (product.locationQuantities && typeof product.locationQuantities === 'object') {
    totalQuantity = Object.values(product.locationQuantities).reduce((sum, loc) => {
      return sum + (parseFloat(loc.quantity) || 0);
    }, 0);
  }

  executeModify(`
    UPDATE products 
    SET barcode = ?, name = ?, category = ?, price = ?, detailPrice = ?, wholesalePrice = ?, expirationDate = ?, quantity = ?, quantityType = ?,
        purchasePrice = ?, image = ?, serialNumber = ?, reference = ?, incomplete = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    product.barcode || null,
    product.name,
    product.category || null,
    product.price,
    product.detailPrice || null,
    product.wholesalePrice || null,
    product.expirationDate || null,
    totalQuantity,
    product.quantityType || 'unit',
    product.purchasePrice || null,
    product.image || null,
    product.serialNumber || null,
    product.reference || null,
    product.incomplete || 0,
    id
  ]);
  
  // Handle location quantities if provided
  if (product.locationQuantities && typeof product.locationQuantities === 'object') {
    Object.entries(product.locationQuantities).forEach(([locationId, locData]) => {
      if (locData && typeof locData === 'object') {
        setProductLocationQuantity(id, parseInt(locationId), locData.quantity || 0, locData.localization || null);
      }
    });
  }
  
  // Return the updated product from database
  return getProductById(id);
};

const deleteProduct = (id) => {
  // Automatic-delete behavior: remove dependent rows that would block product deletion
  // (location_transfers, product_locations), then remove the product itself.
  // Keep invoice_items/supplier_invoice_items nullified to preserve invoice history.

  // Nullify invoice references (best effort)
  try {
    executeModify('UPDATE invoice_items SET productId = NULL WHERE productId = ?', [id]);
  } catch (e) {
    console.warn('Failed to nullify invoice_items.productId for deleted product', id, e.message);
  }
  try {
    executeModify('UPDATE supplier_invoice_items SET productId = NULL WHERE productId = ?', [id]);
  } catch (e) {
    console.warn('Failed to nullify supplier_invoice_items.productId for deleted product', id, e.message);
  }

  // Remove location_transfers and product_locations referencing this product (automatic cleanup)
  try {
    executeModify('DELETE FROM location_transfers WHERE productId = ?', [id]);
  } catch (e) {
    console.warn('Failed to delete location_transfers for product', id, e.message);
  }
  try {
    executeModify('DELETE FROM product_locations WHERE productId = ?', [id]);
  } catch (e) {
    console.warn('Failed to delete product_locations for product', id, e.message);
  }

  // Finally delete the product (cascade or manual cleanup already handled)
  try {
    executeModify('DELETE FROM products WHERE id = ?', [id]);
  } catch (err) {
    // Convert FK error into a clearer message as a last-resort
    if (err && err.message && err.message.toLowerCase().includes('foreign key')) {
      throw new Error('Failed to delete product due to existing references (foreign key constraint). Check related data.');
    }
    throw err;
  }

  return { success: true };
};

const updateProductQuantity = (id, quantity) => {
  executeModify('UPDATE products SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [quantity, id]);
  return { success: true };
};

// ============= INVOICES =============

const getAllInvoices = () => {
  const invoices = executeSelect('SELECT * FROM invoices ORDER BY date DESC'); // type is now included
  // Load items for each invoice with quantityType from product as fallback
  invoices.forEach(invoice => {
    const items = executeSelect(`
      SELECT 
        ii.id,
        ii.invoiceId,
        ii.productId,
        ii.productName,
        ii.serialNumber,
        ii.quantity,
        ii.price,
        ii.total,
        COALESCE(ii.quantityType, p.quantityType, 'unit') as quantityType
      FROM invoice_items ii
      LEFT JOIN products p ON ii.productId = p.id
      WHERE ii.invoiceId = ?
    `, [invoice.id]);
    invoice.items = items;
  });
  return invoices;
};

// ============= CLIENTS (CUSTOMERS) =============

const getAllClients = () => {
  return executeSelect('SELECT * FROM clients ORDER BY name');
};

const getClientById = (id) => {
  const results = executeSelect('SELECT * FROM clients WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
};

const searchClients = (term) => {
  if (!term || term.trim() === '') return [];
  const q = `%${term.trim().toLowerCase()}%`;
  const qPhone = `%${term.trim()}%`;

  // First try to find real client records
  const clients = executeSelect(
    'SELECT * FROM clients WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ? ORDER BY name LIMIT 50',
    [q, q, qPhone]
  );
  if (clients && clients.length > 0) return clients;

  // Fallback: search invoices for client info (use DISTINCT to avoid duplicates)
  const invoices = executeSelect(
    `SELECT DISTINCT COALESCE(customerName, '') as name, COALESCE(clientEmail, '') as email, COALESCE(clientPhone, '') as phone, COALESCE(clientAddress, '') as address
     FROM invoices
     WHERE LOWER(customerName) LIKE ? OR LOWER(clientEmail) LIKE ? OR clientPhone LIKE ?
     LIMIT 50`,
    [q, q, qPhone]
  );

  // Map invoice rows to client-like objects (no id)
  return (invoices || []).map((r, i) => ({ id: null, name: r.name, email: r.email, phone: r.phone, address: r.address || '', source: 'invoice' }));
};

const createClient = (client) => {
  executeModify(`
    INSERT INTO clients (name, phone, email, address, companyName, taxId)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    client.name,
    client.phone || null,
    client.email || null,
    client.address || null,
    client.companyName || null,
    client.taxId || null
  ]);
  const id = getLastInsertId();
  return { id, ...client };
};

const updateClient = (id, client) => {
  executeModify(`
    UPDATE clients
    SET name = ?, phone = ?, email = ?, address = ?, companyName = ?, taxId = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    client.name,
    client.phone || null,
    client.email || null,
    client.address || null,
    client.companyName || null,
    client.taxId || null,
    id
  ]);
  return getClientById(id);
};

const getInvoiceById = (id) => {
  const results = executeSelect('SELECT * FROM invoices WHERE id = ?', [id]); // type is now included
  if (results.length > 0) {
    const invoice = results[0];
    const items = executeSelect(`
      SELECT 
        ii.id,
        ii.invoiceId,
        ii.productId,
        ii.productName,
        ii.serialNumber,
        ii.quantity,
        ii.price,
        ii.total,
        COALESCE(ii.quantityType, p.quantityType, 'unit') as quantityType
      FROM invoice_items ii
      LEFT JOIN products p ON ii.productId = p.id
      WHERE ii.invoiceId = ?
    `, [id]);
    invoice.items = items;
    return invoice;
  }
  return null;
};

const createInvoice = (invoice) => {
  const db = getDatabase();
  
  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Insert invoice with all fields
    db.prepare(`
      INSERT INTO invoices (
        invoiceNumber, subtotal, discount, tax, total, paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientRC, clientAI, clientNIS, clientId, paymentStatus, companyName, companyAddress, companyContact, companyTaxId, garantieDuration, garantieEndDate, notes, type, source, date, debt, paid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      invoice.invoiceNumber,
      invoice.subtotal,
      invoice.discount || 0,
      invoice.tax || 0,
      invoice.total,
      invoice.paymentMethod || null,
      invoice.customerName || null,
      invoice.clientAddress || null,
      invoice.clientEmail || null,
      invoice.clientPhone || null,
      invoice.clientRC || null,
      invoice.clientAI || null,
      invoice.clientNIS || null,
      invoice.clientId || null,
      invoice.paymentStatus || null,
      invoice.companyName || null,
      invoice.companyAddress || null,
      invoice.companyContact || null,
      invoice.companyTaxId || null,
      invoice.garantieDuration || null,
      invoice.garantieEndDate || null,
      invoice.notes || null,
      invoice.type || null,
      invoice.source || null,
      invoice.date || new Date().toISOString(),
      invoice.debt || 0,
      invoice.paid || 0
    ]);
    
    const invoiceId = getLastInsertId();
    
    // Insert invoice items and update quantities
    invoice.items.forEach(item => {
      // Ensure productId is never null (use 0 for pure manual items) to satisfy NOT NULL constraint
      const boundProductId = item.id || item.productId || 0;
      db.prepare(`
        INSERT INTO invoice_items (invoiceId, productId, productName, serialNumber, quantity, quantityType, price, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run([
        invoiceId,
        boundProductId,
        item.name || item.productName,
        item.serialNumber || null,
        item.quantity,
        item.quantityType || 'unit',
        item.price,
        item.quantity * item.price
      ]);
      // Update product quantity only if we have a real product id (non-zero)
      if (boundProductId) {
        const product = getProductById(boundProductId);
        if (product) {
          db.prepare('UPDATE products SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(product.quantity - item.quantity, product.id);
        }
      }
    });
    
    // Commit transaction
    db.exec('COMMIT');
    
    saveDatabase();
    
    return { id: invoiceId, ...invoice };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw error;
  }
};

const updateInvoice = (id, updates) => {
  const db = getDatabase();
  
  try {
    // Build update query dynamically based on provided fields
    const allowedFields = ['debt', 'paid', 'paymentStatus', 'customerName', 'clientAddress', 'clientEmail', 'clientPhone', 'notes'];
    const updateFields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updateFields.length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }
    
    values.push(id);
    
    executeModify(`
      UPDATE invoices 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    return { success: true };
  } catch (error) {
    console.error('Error updating invoice:', error);
    return { success: false, error: error.message };
  }
};

const deleteInvoice = (id) => {
  executeModify('DELETE FROM invoices WHERE id = ?', [id]);
  return { success: true };
};

const clearAllInvoices = () => {
  executeModify('DELETE FROM invoice_items');
  executeModify('DELETE FROM invoices');
  return { success: true };
};

// ============= SUPPLIER INVOICES =============

const getAllSupplierInvoices = () => {
  const invoices = executeSelect('SELECT * FROM supplier_invoices ORDER BY date DESC');
  // Load items for each invoice with product details including barcode using JOIN
  invoices.forEach(invoice => {
    const items = executeSelect(`
      SELECT 
        si.*,
        p.barcode as barcode
      FROM supplier_invoice_items si
      LEFT JOIN products p ON si.productId = p.id
      WHERE si.supplierInvoiceId = ?
    `, [invoice.id]);
    invoice.items = items;
  });
  return invoices;
};

const getSupplierInvoiceById = (id) => {
  const results = executeSelect('SELECT * FROM supplier_invoices WHERE id = ?', [id]);
  if (results.length > 0) {
    const invoice = results[0];
    const items = executeSelect(`
      SELECT 
        si.*,
        p.barcode as barcode
      FROM supplier_invoice_items si
      LEFT JOIN products p ON si.productId = p.id
      WHERE si.supplierInvoiceId = ?
    `, [id]);
    invoice.items = items;
    return invoice;
  }
  return null;
};

const createSupplierInvoice = (invoice) => {
  const db = getDatabase();
  const newProducts = [];
  
  // Detect legacy schema differences once
  const supplierInvoiceItemsCols = (() => {
    try {
      const cols = db.prepare('PRAGMA table_info(supplier_invoice_items)').all();
      return cols.map(c => c.name);
    } catch (e) {
      return [];
    }
  })();
  const hasInvoiceId = supplierInvoiceItemsCols.includes('invoiceId') || supplierInvoiceItemsCols.includes('invoice_id');
  const hasSupplierInvoiceId = supplierInvoiceItemsCols.includes('supplierInvoiceId') || supplierInvoiceItemsCols.includes('supplier_invoice_id');

  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Insert supplier invoice
    db.prepare(`
      INSERT INTO supplier_invoices (invoiceNumber, supplierName, supplierPhone, date, total, paid, debt, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      invoice.invoiceNumber,
      invoice.supplierName,
      invoice.supplierPhone || null,
      invoice.date || new Date().toISOString(),
      invoice.total,
      invoice.paid || 0,
      invoice.debt || 0,
      invoice.status || 'pending',
      invoice.notes || null
    ]);
    
    const invoiceId = getLastInsertId();
    
    // Insert supplier invoice items and update product quantities
    const autoUpdateQuantity = invoice.autoUpdateQuantity !== false; // Default to true
    
    invoice.items.forEach(item => {
      // Try to find product by barcode first, then by name
      let product = null;
      if (item.barcode) {
        product = getProductByBarcode(item.barcode);
      }
      if (!product && item.productName) {
        const results = executeSelect('SELECT * FROM products WHERE name = ?', [item.productName]);
        product = results.length > 0 ? results[0] : null;
      }
      
      let productIdToUse = product ? product.id : null;
      
      // Update product quantity if found, or create new product
      if (product) {
        if (autoUpdateQuantity) {
          db.prepare('UPDATE products SET quantity = ?, purchasePrice = ?, quantityType = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(product.quantity + item.quantity, item.price, item.quantityType || 'unit', product.id);
        } else {
          // Only update purchase price, not quantity
          db.prepare('UPDATE products SET purchasePrice = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(item.price, product.id);
        }
      } else if (item.productName) {
        // Create new product
        db.prepare(`
          INSERT INTO products (barcode, name, category, price, quantity, quantityType, purchasePrice, incomplete, addedFrom)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run([
          item.barcode || null,
          item.productName,
          null,
          item.price * 1.3, // Default selling price 30% markup
          item.quantity,
          item.quantityType || 'unit',
          item.price,
          1,
          'supplier_invoice'
        ]);
        
        productIdToUse = getLastInsertId();
        newProducts.push({
          id: productIdToUse,
          name: item.productName,
          barcode: item.barcode
        });
      }

      // Insert into supplier_invoice_items - handle legacy column names
      if (hasInvoiceId && hasSupplierInvoiceId) {
        db.prepare(`INSERT INTO supplier_invoice_items (invoiceId, supplierInvoiceId, productId, productName, quantity, quantityType, price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run([
          invoiceId,
          invoiceId,
          productIdToUse,
          item.productName,
          item.quantity,
          item.quantityType || 'unit',
          item.price,
          item.quantity * item.price
        ]);
      } else if (hasInvoiceId && !hasSupplierInvoiceId) {
        // legacy table expects invoiceId
        db.prepare(`INSERT INTO supplier_invoice_items (invoiceId, productId, productName, quantity, quantityType, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run([
          invoiceId,
          productIdToUse,
          item.productName,
          item.quantity,
          item.quantityType || 'unit',
          item.price,
          item.quantity * item.price
        ]);
      } else {
        // modern table uses supplierInvoiceId
        db.prepare(`
          INSERT INTO supplier_invoice_items (supplierInvoiceId, productId, productName, quantity, quantityType, price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run([
          invoiceId,
          productIdToUse,
          item.productName,
          item.quantity,
          item.quantityType || 'unit',
          item.price,
          item.quantity * item.price
        ]);
      }
    });
    
    // Commit transaction
    db.exec('COMMIT');
    
    saveDatabase();
    
    return { 
      id: invoiceId, 
      ...invoice,
      newProducts: newProducts
    };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw error;
  }
};

const updateSupplierInvoice = (id, updates) => {
  // Recalculate debt and status server-side to keep data consistent
  const invoice = getSupplierInvoiceById(id) || { total: 0, paid: 0 };
  const total = parseFloat(invoice.total) || 0;
  const paid = typeof updates.paid !== 'undefined' ? parseFloat(updates.paid) || 0 : (parseFloat(invoice.paid) || 0);
  const debt = Math.max(0, +(total - paid).toFixed(2));
  const status = typeof updates.status !== 'undefined' ? updates.status : (debt > 0 ? 'pending' : 'paid');

  executeModify(`
    UPDATE supplier_invoices 
    SET paid = ?, debt = ?, status = ?
    WHERE id = ?
  `, [paid, debt, status, id]);

  return getSupplierInvoiceById(id);
};

const deleteSupplierInvoice = (id) => {
  executeModify('DELETE FROM supplier_invoices WHERE id = ?', [id]);
  return { success: true };
};

// ============= EMPLOYEES =============

const getAllEmployees = () => {
  return executeSelect('SELECT * FROM employees ORDER BY name');
};

const getEmployeeById = (id) => {
  const results = executeSelect('SELECT * FROM employees WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
};

const createEmployee = (employee) => {
  executeModify(`
    INSERT INTO employees (name, position, salary, absences, deduction, nationalCard, insurance, phone, email, address, hireDate, startDate, leaveBalance, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    employee.name,
    employee.position,
    employee.salary,
    employee.absences || 0,
    employee.deduction || 0,
    employee.nationalCard || null,
    employee.insurance || null,
    employee.phone || null,
    employee.email || null,
    employee.address || null,
    employee.hireDate || null,
    employee.startDate || new Date().toISOString().split('T')[0],
    employee.leaveBalance || 0,
    employee.status || 'active'
  ]);
  const id = getLastInsertId();
  return { id, ...employee };
};

const updateEmployee = (id, employee) => {
  executeModify(`
    UPDATE employees 
    SET name = ?, position = ?, salary = ?, absences = ?, deduction = ?, nationalCard = ?, insurance = ?, phone = ?, email = ?, address = ?, startDate = ?, leaveBalance = ?, status = ?
    WHERE id = ?
  `, [
    employee.name,
    employee.position,
    employee.salary,
    employee.absences || 0,
    employee.deduction || 0,
    employee.nationalCard || null,
    employee.insurance || null,
    employee.phone || null,
    employee.email || null,
    employee.address || null,
    employee.startDate || null,
    employee.leaveBalance || 0,
    employee.status || 'active',
    id
  ]);
  return getEmployeeById(id);
};

const deleteEmployee = (id) => {
  executeModify('DELETE FROM employees WHERE id = ?', [id]);
  return { success: true };
};

// ============= EMPLOYEE LEAVE =============

const getEmployeeLeave = (employeeId) => {
  return executeSelect('SELECT * FROM employee_leave WHERE employeeId = ? ORDER BY startDate DESC', [employeeId]);
};

const createLeave = (leave) => {
  executeModify(`
    INSERT INTO employee_leave (employeeId, leaveType, startDate, endDate, days, status, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    leave.employeeId,
    leave.leaveType,
    leave.startDate,
    leave.endDate,
    leave.days,
    leave.status || 'approved',
    leave.reason || null
  ]);
  const id = getLastInsertId();
  return { id, ...leave };
};

const updateLeave = (id, leave) => {
  executeModify(`
    UPDATE employee_leave 
    SET leaveType = ?, startDate = ?, endDate = ?, days = ?, status = ?, reason = ?
    WHERE id = ?
  `, [
    leave.leaveType,
    leave.startDate,
    leave.endDate,
    leave.days,
    leave.status,
    leave.reason || null,
    id
  ]);
};

const deleteLeave = (id) => {
  executeModify('DELETE FROM employee_leave WHERE id = ?', [id]);
  return { success: true };
};

// ============= EMPLOYEE BONUSES =============

const getEmployeeBonuses = (employeeId) => {
  return executeSelect('SELECT * FROM employee_bonuses WHERE employeeId = ? ORDER BY date DESC', [employeeId]);
};

const createBonus = (bonus) => {
  executeModify(`
    INSERT INTO employee_bonuses (employeeId, amount, reason, date)
    VALUES (?, ?, ?, ?)
  `, [
    bonus.employeeId,
    bonus.amount,
    bonus.reason || null,
    bonus.date || new Date().toISOString().split('T')[0]
  ]);
  const id = getLastInsertId();
  return { id, ...bonus };
};

const updateBonus = (id, bonus) => {
  executeModify(`
    UPDATE employee_bonuses 
    SET amount = ?, reason = ?, date = ?
    WHERE id = ?
  `, [
    bonus.amount,
    bonus.reason || null,
    bonus.date,
    id
  ]);
};

const deleteBonus = (id) => {
  executeModify('DELETE FROM employee_bonuses WHERE id = ?', [id]);
  return { success: true };
};

// Calculate accrued leave based on start date
const calculateAccruedLeave = (startDate, leavePerMonth = 2) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const monthsWorked = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, monthsWorked * leavePerMonth);
};

// ============= SETTINGS =============

const getSetting = (key) => {
  const results = executeSelect('SELECT value FROM settings WHERE key = ?', [key]);
  return results.length > 0 ? results[0].value : null;
};

const setSetting = (key, value) => {
  executeModify(`
    INSERT INTO settings (key, value) 
    VALUES (?, ?) 
    ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = CURRENT_TIMESTAMP
  `, [key, value, value]);
};

const getAllSettings = () => {
  const rows = executeSelect('SELECT * FROM settings');
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
};

// ============= LOCATIONS =============

const getAllLocations = () => {
  return executeSelect('SELECT * FROM locations ORDER BY type, name');
};

const getLocationById = (id) => {
  const results = executeSelect('SELECT * FROM locations WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
};

const createLocation = (location) => {
  executeModify(`
    INSERT INTO locations (name, type, createdAt)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `, [location.name, location.type]);
  const id = getLastInsertId();
  return { id, ...location };
};

const updateLocation = (id, location) => {
  executeModify(`
    UPDATE locations 
    SET name = ?, type = ?
    WHERE id = ?
  `, [location.name, location.type, id]);
  return getLocationById(id);
};

const deleteLocation = (id) => {
  // Check if any products exist in this location
  const productCount = executeSelect(
    'SELECT COUNT(*) as count FROM product_locations WHERE locationId = ? AND quantity > 0',
    [id]
  );
  
  if (productCount[0].count > 0) {
    throw new Error('Cannot delete location with existing products');
  }
  
  executeModify('DELETE FROM locations WHERE id = ?', [id]);
  return { success: true };
};

// ============= PRODUCT LOCATIONS =============

const getProductLocations = (productId) => {
  return executeSelect(`
    SELECT pl.*, l.name as locationName, l.type as locationType
    FROM product_locations pl
    JOIN locations l ON pl.locationId = l.id
    WHERE pl.productId = ?
    ORDER BY l.type, l.name
  `, [productId]);
};

const getAllProductLocations = () => {
  return executeSelect(`
    SELECT pl.*, p.name as productName, p.barcode, l.name as locationName, l.type as locationType
    FROM product_locations pl
    JOIN products p ON pl.productId = p.id
    JOIN locations l ON pl.locationId = l.id
    ORDER BY p.name, l.type, l.name
  `);
};

const setProductLocationQuantity = (productId, locationId, quantity, localization = null) => {
  console.log(`Electron Debug: setProductLocationQuantity productId=${productId}, locationId=${locationId}, quantity=${quantity}, localization=${localization}`);
  executeModify(`
    INSERT OR REPLACE INTO product_locations (productId, locationId, quantity, localization, updatedAt)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [productId, locationId, quantity, localization]);
  return { success: true };
};

const updateProductLocalization = (productId, locationId, localization) => {
  executeModify(`
    UPDATE product_locations 
    SET localization = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE productId = ? AND locationId = ?
  `, [localization, productId, locationId]);
  return { success: true };
};

const getProductLocationQuantity = (productId, locationId) => {
  const results = executeSelect(
    'SELECT quantity FROM product_locations WHERE productId = ? AND locationId = ?',
    [productId, locationId]
  );
  return results.length > 0 ? results[0].quantity : 0;
};

const getTotalProductQuantity = (productId) => {
  const results = executeSelect(
    'SELECT COALESCE(SUM(quantity), 0) as total FROM product_locations WHERE productId = ?',
    [productId]
  );
  return results.length > 0 ? results[0].total : 0;
};

// ============= LOCATION TRANSFERS =============

const createLocationTransfer = (transfer) => {
  const db = getDatabase();
  
  try {
    // Validate source has enough quantity
    if (transfer.fromLocationId) {
      const fromQty = getProductLocationQuantity(transfer.productId, transfer.fromLocationId);
      if (fromQty < transfer.quantity) {
        throw new Error('Insufficient quantity in source location');
      }
    }
    
    // Update from location (decrease quantity)
    if (transfer.fromLocationId) {
      executeModify(`
        UPDATE product_locations 
        SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP
        WHERE productId = ? AND locationId = ?
      `, [transfer.quantity, transfer.productId, transfer.fromLocationId]);
    }
    
    // Update to location (increase quantity)
    if (transfer.toLocationId) {
      // Check if record exists
      const existing = executeSelect(`
        SELECT quantity FROM product_locations WHERE productId = ? AND locationId = ?
      `, [transfer.productId, transfer.toLocationId]);
      
      if (existing.length > 0) {
        // Update existing
        executeModify(`
          UPDATE product_locations 
          SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP
          WHERE productId = ? AND locationId = ?
        `, [transfer.quantity, transfer.productId, transfer.toLocationId]);
      } else {
        // Insert new
        executeModify(`
          INSERT INTO product_locations (productId, locationId, quantity, updatedAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [transfer.productId, transfer.toLocationId, transfer.quantity]);
      }
    }
    
    // Record the transfer
    executeModify(`
      INSERT INTO location_transfers (productId, fromLocationId, toLocationId, quantity, reason, date)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [transfer.productId, transfer.fromLocationId, transfer.toLocationId, transfer.quantity, transfer.reason || null]);
    
    const id = getLastInsertId();
    return { id, ...transfer, success: true };
  } catch (error) {
    console.error('Transfer error:', error);
    throw error;
  }
};

const getLocationTransfers = (productId = null) => {
  if (productId) {
    return executeSelect(`
      SELECT lt.*, 
             p.name as productName,
             fl.name as fromLocationName, fl.type as fromLocationType,
             tl.name as toLocationName, tl.type as toLocationType
      FROM location_transfers lt
      JOIN products p ON lt.productId = p.id
      LEFT JOIN locations fl ON lt.fromLocationId = fl.id
      LEFT JOIN locations tl ON lt.toLocationId = tl.id
      WHERE lt.productId = ?
      ORDER BY lt.date DESC
    `, [productId]);
  } else {
    return executeSelect(`
      SELECT lt.*, 
             p.name as productName,
             fl.name as fromLocationName, fl.type as fromLocationType,
             tl.name as toLocationName, tl.type as toLocationType
      FROM location_transfers lt
      JOIN products p ON lt.productId = p.id
      LEFT JOIN locations fl ON lt.fromLocationId = fl.id
      LEFT JOIN locations tl ON lt.toLocationId = tl.id
      ORDER BY lt.date DESC
    `);
  }
};

// Delete a transfer and reverse inventory movement where possible
const deleteLocationTransfer = (transferId) => {
  const db = getDatabase();
  try {
    const transfer = db.prepare('SELECT * FROM location_transfers WHERE id = ?').get(transferId);
    if (!transfer) return { success: false, error: 'Transfer not found' };

    db.exec('BEGIN TRANSACTION');

    // Restore quantity to the source location (if any)
    if (transfer.fromLocationId) {
      const exists = db.prepare('SELECT id FROM product_locations WHERE productId = ? AND locationId = ?').get(transfer.productId, transfer.fromLocationId);
      if (exists) {
        db.prepare('UPDATE product_locations SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP WHERE productId = ? AND locationId = ?')
          .run(transfer.quantity, transfer.productId, transfer.fromLocationId);
      } else {
        db.prepare('INSERT INTO product_locations (productId, locationId, quantity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
          .run(transfer.productId, transfer.fromLocationId, transfer.quantity);
      }
    }

    // Subtract quantity from destination location (if any)
    if (transfer.toLocationId) {
      const existsTo = db.prepare('SELECT id FROM product_locations WHERE productId = ? AND locationId = ?').get(transfer.productId, transfer.toLocationId);
      if (existsTo) {
        db.prepare('UPDATE product_locations SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE productId = ? AND locationId = ?')
          .run(transfer.quantity, transfer.productId, transfer.toLocationId);
      }
      // if destination record does not exist, ignore (nothing to subtract)
    }

    db.prepare('DELETE FROM location_transfers WHERE id = ?').run(transferId);
    db.exec('COMMIT');
    saveDatabase();
    return { success: true };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) {}
    console.error('Error deleting location transfer:', err.message || err);
    throw err;
  }
};

// ============= BULK SNAPSHOT IMPORT =============
// Import a complete snapshot from the server into the local sqlite DB (transactional)
const importSnapshot = (snapshot) => {
  const db = getDatabase();
  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    // Locations
    if (Array.isArray(snapshot.locations)) {
      db.exec('DELETE FROM locations');
      // Only include columns that exist in the current schema (safeguard for older DBs)
      const locCols = db.prepare("PRAGMA table_info('locations')").all().map(c => c.name);
      const hasUpdatedAt = locCols.includes('updatedAt');
      const insertSql = hasUpdatedAt
        ? `INSERT INTO locations (id, name, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`
        : `INSERT INTO locations (id, name, type, createdAt) VALUES (?, ?, ?, ?)`;

      snapshot.locations.forEach(loc => {
        if (hasUpdatedAt) {
          db.prepare(insertSql).run([loc.id || null, loc.name || null, loc.type || null, loc.createdAt || null, loc.updatedAt || null]);
        } else {
          db.prepare(insertSql).run([loc.id || null, loc.name || null, loc.type || null, loc.createdAt || null]);
        }
      });
    }

    // Products and product_locations
    if (Array.isArray(snapshot.products)) {
      db.exec('DELETE FROM product_locations');
      db.exec('DELETE FROM products');
      snapshot.products.forEach(p => {
        db.prepare(`INSERT INTO products (id, barcode, name, category, price, detailPrice, wholesalePrice, expirationDate, quantity, quantityType, purchasePrice, image, serialNumber, reference, incomplete, addedFrom, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
          p.id || null, p.barcode || null, p.name || null, p.category || null, p.price || 0, p.detailPrice || null, p.wholesalePrice || null,
          p.expirationDate || null, p.quantity || 0, p.quantityType || 'unit', p.purchasePrice || null, p.image || null, p.serialNumber || null, p.incomplete || 0, p.addedFrom || null, p.createdAt || null, p.updatedAt || null
        ]);

        if (p.locationQuantities && typeof p.locationQuantities === 'object') {
          Object.entries(p.locationQuantities).forEach(([locationId, locData]) => {
            db.prepare(`INSERT INTO product_locations (productId, locationId, quantity, localization) VALUES (?, ?, ?, ?)`).run([p.id, parseInt(locationId), locData.quantity || 0, locData.localization || null]);
          });
        }
      });
    }

    // Invoices and invoice_items
    if (Array.isArray(snapshot.invoices)) {
      db.exec('DELETE FROM invoice_items');
      db.exec('DELETE FROM invoices');

      // Safeguard: only include columns that exist in current schema
      const invCols = db.prepare("PRAGMA table_info('invoices')").all().map(c => c.name);
      const hasCreatedAtInv = invCols.includes('createdAt');
      const hasUpdatedAtInv = invCols.includes('updatedAt');

      // Choose appropriate INSERT SQL depending on which timestamp columns exist
      const insertInvSql = hasCreatedAtInv && hasUpdatedAtInv
        ? `INSERT INTO invoices (id, invoiceNumber, subtotal, discount, tax, total, paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientId, paymentStatus, companyName, companyAddress, companyContact, companyTaxId, garantieDuration, garantieEndDate, notes, type, source, date, debt, paid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        : hasCreatedAtInv
          ? `INSERT INTO invoices (id, invoiceNumber, subtotal, discount, tax, total, paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientId, paymentStatus, companyName, companyAddress, companyContact, companyTaxId, garantieDuration, garantieEndDate, notes, type, source, date, debt, paid, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO invoices (id, invoiceNumber, subtotal, discount, tax, total, paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientId, paymentStatus, companyName, companyAddress, companyContact, companyTaxId, garantieDuration, garantieEndDate, notes, type, source, date, debt, paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      snapshot.invoices.forEach(inv => {
        if (hasCreatedAtInv && hasUpdatedAtInv) {
          db.prepare(insertInvSql).run([
            inv.id || null, inv.invoiceNumber || null, inv.subtotal || 0, inv.discount || 0, inv.tax || 0, inv.total || 0, inv.paymentMethod || null,
            inv.customerName || null, inv.clientAddress || null, inv.clientEmail || null, inv.clientPhone || null, inv.clientId || null, inv.paymentStatus || null,
            inv.companyName || null, inv.companyAddress || null, inv.companyContact || null, inv.companyTaxId || null, inv.garantieDuration || null, inv.garantieEndDate || null,
            inv.notes || null, inv.type || null, inv.source || null, inv.date || null, inv.debt || 0, inv.paid || 0, inv.createdAt || null, inv.updatedAt || null
          ]);
        } else if (hasCreatedAtInv) {
          db.prepare(insertInvSql).run([
            inv.id || null, inv.invoiceNumber || null, inv.subtotal || 0, inv.discount || 0, inv.tax || 0, inv.total || 0, inv.paymentMethod || null,
            inv.customerName || null, inv.clientAddress || null, inv.clientEmail || null, inv.clientPhone || null, inv.clientId || null, inv.paymentStatus || null,
            inv.companyName || null, inv.companyAddress || null, inv.companyContact || null, inv.companyTaxId || null, inv.garantieDuration || null, inv.garantieEndDate || null,
            inv.notes || null, inv.type || null, inv.source || null, inv.date || null, inv.debt || 0, inv.paid || 0, inv.createdAt || null
          ]);
        } else {
          db.prepare(insertInvSql).run([
            inv.id || null, inv.invoiceNumber || null, inv.subtotal || 0, inv.discount || 0, inv.tax || 0, inv.total || 0, inv.paymentMethod || null,
            inv.customerName || null, inv.clientAddress || null, inv.clientEmail || null, inv.clientPhone || null, inv.clientId || null, inv.paymentStatus || null,
            inv.companyName || null, inv.companyAddress || null, inv.companyContact || null, inv.companyTaxId || null, inv.garantieDuration || null, inv.garantieEndDate || null,
            inv.notes || null, inv.type || null, inv.source || null, inv.date || null, inv.debt || 0, inv.paid || 0
          ]);
        }

        if (Array.isArray(inv.items)) {
          inv.items.forEach(item => {
            db.prepare(`INSERT INTO invoice_items (id, invoiceId, productId, productName, serialNumber, quantity, quantityType, price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([item.id || null, inv.id, item.productId || null, item.productName || item.name || null, item.serialNumber || null, item.quantity || 0, item.quantityType || 'unit', item.price || 0, item.total || (item.quantity * item.price) || 0]);
          });
        }
      });
    }

    // Supplier invoices
    if (Array.isArray(snapshot.supplierInvoices)) {
      db.exec('DELETE FROM supplier_invoice_items');
      db.exec('DELETE FROM supplier_invoices');

      // Safeguard: only include columns that exist in current schema
      const supInvCols = db.prepare("PRAGMA table_info('supplier_invoices')").all().map(c => c.name);
      const hasCreatedAtSup = supInvCols.includes('createdAt');
      const hasUpdatedAtSup = supInvCols.includes('updatedAt');

      const insertSupSql = hasCreatedAtSup && hasUpdatedAtSup
        ? `INSERT INTO supplier_invoices (id, invoiceNumber, supplierName, date, total, paid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        : hasCreatedAtSup
          ? `INSERT INTO supplier_invoices (id, invoiceNumber, supplierName, date, total, paid, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO supplier_invoices (id, invoiceNumber, supplierName, date, total, paid) VALUES (?, ?, ?, ?, ?, ?)`;

      snapshot.supplierInvoices.forEach(inv => {
        if (hasCreatedAtSup && hasUpdatedAtSup) {
          db.prepare(insertSupSql).run([inv.id || null, inv.invoiceNumber || null, inv.supplierName || null, inv.date || null, inv.total || 0, inv.paid || 0, inv.createdAt || null, inv.updatedAt || null]);
        } else if (hasCreatedAtSup) {
          db.prepare(insertSupSql).run([inv.id || null, inv.invoiceNumber || null, inv.supplierName || null, inv.date || null, inv.total || 0, inv.paid || 0, inv.createdAt || null]);
        } else {
          db.prepare(insertSupSql).run([inv.id || null, inv.invoiceNumber || null, inv.supplierName || null, inv.date || null, inv.total || 0, inv.paid || 0]);
        }

        if (Array.isArray(inv.items)) {
          // Detect supplier_invoice_items columns to handle legacy variations
          const supItemCols = db.prepare("PRAGMA table_info('supplier_invoice_items')").all().map(c => c.name);
          const hasInvoiceIdCol = supItemCols.includes('invoiceId') || supItemCols.includes('invoice_id');
          const hasSupplierInvoiceIdCol = supItemCols.includes('supplierInvoiceId') || supItemCols.includes('supplier_invoice_id');

          inv.items.forEach(item => {
            if (hasInvoiceIdCol && hasSupplierInvoiceIdCol) {
              db.prepare(`INSERT INTO supplier_invoice_items (id, invoiceId, supplierInvoiceId, productId, productName, quantity, quantityType, purchasePrice, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run([item.id || null, inv.id, inv.id, item.productId || null, item.productName || null, item.quantity || 0, item.quantityType || 'unit', item.purchasePrice || 0, item.total || 0]);
            } else if (hasInvoiceIdCol && !hasSupplierInvoiceIdCol) {
              db.prepare(`INSERT INTO supplier_invoice_items (id, invoiceId, productId, productName, quantity, quantityType, purchasePrice, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run([item.id || null, inv.id, item.productId || null, item.productName || null, item.quantity || 0, item.quantityType || 'unit', item.purchasePrice || 0, item.total || 0]);
            } else {
              db.prepare(`INSERT INTO supplier_invoice_items (id, supplierInvoiceId, productId, productName, quantity, quantityType, purchasePrice, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run([item.id || null, inv.id, item.productId || null, item.productName || null, item.quantity || 0, item.quantityType || 'unit', item.purchasePrice || 0, item.total || 0]);
            }
          });
        }
      });
    }

    // Employees and absences
    if (Array.isArray(snapshot.employees)) {
      db.exec('DELETE FROM absences');
      db.exec('DELETE FROM employees');

      // Safeguard: detect which columns exist in current schema and map legacy fields
      const empCols = db.prepare("PRAGMA table_info('employees')").all().map(c => c.name);
      const hasUpdatedAtEmp = empCols.includes('updatedAt');
      const hasPosition = empCols.includes('position');
      const hasRole = empCols.includes('role');
      const hasAbsencesCol = empCols.includes('absences');
      const hasStartDate = empCols.includes('startDate');
      const hasLeaveBalance = empCols.includes('leaveBalance');
      const hasHireDate = empCols.includes('hireDate');
      const hasStatusEmp = empCols.includes('status');

      // Build dynamic insert columns for employees
      const baseCols = ['id', 'name'];
      if (hasPosition) baseCols.push('position'); else if (hasRole) baseCols.push('role');
      baseCols.push('salary');
      if (hasStartDate) baseCols.push('startDate');
      if (hasLeaveBalance) baseCols.push('leaveBalance');
      if (hasHireDate) baseCols.push('hireDate');
      if (hasAbsencesCol) baseCols.push('absences');
      if (hasStatusEmp) baseCols.push('status');
      if (hasUpdatedAtEmp) baseCols.push('createdAt', 'updatedAt'); else baseCols.push('createdAt');

      const insertEmpSql = `INSERT INTO employees (${baseCols.join(', ')}) VALUES (${baseCols.map(() => '?').join(', ')})`;

      snapshot.employees.forEach(emp => {
        const values = [];
        values.push(emp.id || null);
        values.push(emp.name || null);

        // Map role -> position where appropriate
        if (hasPosition) {
          values.push(emp.position || emp.role || null);
        } else if (hasRole) {
          values.push(emp.role || emp.position || null);
        }

        values.push(emp.salary || null);
        if (hasStartDate) values.push(emp.startDate || emp.hireDate || null);
        if (hasLeaveBalance) values.push(typeof emp.leaveBalance !== 'undefined' ? emp.leaveBalance : null);
        if (hasHireDate) values.push(emp.hireDate || null);
        if (hasAbsencesCol) values.push(typeof emp.absences !== 'undefined' ? emp.absences : 0);
        if (hasStatusEmp) values.push(emp.status || 'active');
        if (hasUpdatedAtEmp) {
          values.push(emp.createdAt || null, emp.updatedAt || null);
        } else {
          values.push(emp.createdAt || null);
        }

        db.prepare(insertEmpSql).run(values);

        if (Array.isArray(emp.absences)) {
          emp.absences.forEach(abs => {
            db.prepare(`INSERT INTO absences (id, employeeId, date, reason, createdAt) VALUES (?, ?, ?, ?, ?)`).run([abs.id || null, emp.id, abs.date || null, abs.reason || null, abs.createdAt || null]);
          });
        }
      });
    }

    // Commit
    db.exec('COMMIT');
    saveDatabase();
    return { success: true };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch(e) {}
    console.error('Error importing snapshot:', error);
    throw error;
  }
};

module.exports = {
  // Products
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductQuantity,
  
  // Invoices
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  clearAllInvoices,
  
  // Supplier Invoices
  getAllSupplierInvoices,
  getSupplierInvoiceById,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  
  // Employees
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  
  // Employee Leave
  getEmployeeLeave,
  createLeave,
  updateLeave,
  deleteLeave,
  calculateAccruedLeave,
  
  // Employee Bonuses
  getEmployeeBonuses,
  createBonus,
  updateBonus,
  deleteBonus,
  
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  
  // Locations
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  
  // Product Locations
  getProductLocations,
  getAllProductLocations,
  setProductLocationQuantity,
  updateProductLocalization,
  getProductLocationQuantity,
  getTotalProductQuantity,
  
  // Clients (customers)
  getAllClients,
  getClientById,
  searchClients,
  createClient,
  updateClient,
  
  // Location Transfers
  createLocationTransfer,
  getLocationTransfers,
  deleteLocationTransfer,

  // Bulk snapshot import
  importSnapshot
};
