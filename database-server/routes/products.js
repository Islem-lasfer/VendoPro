import express from 'express';
import { pool, sqliteDb, useMySQL } from '../server.js';

const router = express.Router();

// Obtenir tous les produits
router.get('/', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [rows] = await pool.query(`
        SELECT 
          p.*,
          COALESCE(SUM(pl.quantity), 0) as totalQuantity
        FROM products p
        LEFT JOIN product_locations pl ON p.id = pl.productId
        GROUP BY p.id
        ORDER BY p.id DESC
      `);

      // Attach per-product locations and flattened fields
      for (const row of rows) {
        const [locRows] = await pool.query(`
          SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
          FROM product_locations pl
          JOIN locations l ON pl.locationId = l.id
          WHERE pl.productId = ?
          ORDER BY l.type, l.name
        `, [row.id]);
        const locationQuantities = {};
        locRows.forEach(loc => {
          locationQuantities[loc.locationId] = {
            quantity: loc.quantity,
            localization: loc.localization,
            locationName: loc.locationName,
            locationType: loc.locationType
          };
          row[`loc_${loc.locationId}_qty`] = loc.quantity;
          row[`loc_${loc.locationId}_pos`] = loc.localization || '';
        });
        row.locationQuantities = locationQuantities;
      }

      return res.json(rows);
    }

    // SQLite fallback
    const rows = sqliteDb.prepare(`
      SELECT 
        p.*,
        (SELECT COALESCE(SUM(quantity), 0) FROM product_locations WHERE productId = p.id) as totalQuantity
      FROM products p
      ORDER BY p.id DESC
    `).all();

    for (const row of rows) {
      const locRows = sqliteDb.prepare(`
        SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `).all(row.id);
      const locationQuantities = {};
      locRows.forEach(loc => {
        locationQuantities[loc.locationId] = {
          quantity: loc.quantity,
          localization: loc.localization,
          locationName: loc.locationName,
          locationType: loc.locationType
        };
        row[`loc_${loc.locationId}_qty`] = loc.quantity;
        row[`loc_${loc.locationId}_pos`] = loc.localization || '';
      });
      row.locationQuantities = locationQuantities;
    }

    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rechercher des produits
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (useMySQL && pool) {
      const [rows] = await pool.query(`
        SELECT 
          p.*,
          COALESCE(SUM(pl.quantity), 0) as totalQuantity
        FROM products p
        LEFT JOIN product_locations pl ON p.id = pl.productId
        WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ?
        GROUP BY p.id
        ORDER BY p.name
      `, [`%${query}%`, `%${query}%`, `%${query}%`]);

      for (const row of rows) {
        const [locRows] = await pool.query(`
          SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
          FROM product_locations pl
          JOIN locations l ON pl.locationId = l.id
          WHERE pl.productId = ?
          ORDER BY l.type, l.name
        `, [row.id]);
        const locationQuantities = {};
        locRows.forEach(loc => {
          locationQuantities[loc.locationId] = {
            quantity: loc.quantity,
            localization: loc.localization,
            locationName: loc.locationName,
            locationType: loc.locationType
          };
          row[`loc_${loc.locationId}_qty`] = loc.quantity;
          row[`loc_${loc.locationId}_pos`] = loc.localization || '';
        });
        row.locationQuantities = locationQuantities;
      }

      return res.json(rows);
    }

    // SQLite fallback
    const rows = sqliteDb.prepare(`
      SELECT 
        p.*,
        (SELECT COALESCE(SUM(quantity), 0) FROM product_locations WHERE productId = p.id) as totalQuantity
      FROM products p
      WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.category LIKE ?
      ORDER BY p.name
    `).all(`%${query}%`, `%${query}%`, `%${query}%`);

    for (const row of rows) {
      const locRows = sqliteDb.prepare(`
        SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `).all(row.id);
      const locationQuantities = {};
      locRows.forEach(loc => {
        locationQuantities[loc.locationId] = {
          quantity: loc.quantity,
          localization: loc.localization,
          locationName: loc.locationName,
          locationType: loc.locationType
        };
        row[`loc_${loc.locationId}_qty`] = loc.quantity;
        row[`loc_${loc.locationId}_pos`] = loc.localization || '';
      });
      row.locationQuantities = locationQuantities;
    }

    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la recherche de produits:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir un produit par code-barres
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const barcode = req.params.barcode;

    if (useMySQL && pool) {
      const [rows] = await pool.query(`
        SELECT 
          p.*,
          COALESCE(SUM(pl.quantity), 0) as totalQuantity
        FROM products p
        LEFT JOIN product_locations pl ON p.id = pl.productId
        WHERE p.barcode = ?
        GROUP BY p.id
      `, [barcode]);
      if (rows.length === 0) return res.status(404).json({ error: 'Produit non trouvé' });
      const product = rows[0];
      const [locRows] = await pool.query(`
        SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `, [product.id]);
      const locationQuantities = {};
      locRows.forEach(loc => {
        locationQuantities[loc.locationId] = {
          quantity: loc.quantity,
          localization: loc.localization,
          locationName: loc.locationName,
          locationType: loc.locationType
        };
        product[`loc_${loc.locationId}_qty`] = loc.quantity;
        product[`loc_${loc.locationId}_pos`] = loc.localization || '';
      });
      product.locationQuantities = locationQuantities;
      return res.json(product);
    }

    // SQLite fallback
    const rows = sqliteDb.prepare(`
      SELECT p.*, (SELECT COALESCE(SUM(quantity),0) FROM product_locations WHERE productId = p.id) as totalQuantity
      FROM products p WHERE p.barcode = ?
    `).all(barcode);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Produit non trouvé' });
    const product = rows[0];
    const locRows = sqliteDb.prepare(`
      SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `).all(product.id);
    const locationQuantities = {};
    locRows.forEach(loc => {
      locationQuantities[loc.locationId] = {
        quantity: loc.quantity,
        localization: loc.localization,
        locationName: loc.locationName,
        locationType: loc.locationType
      };
      product[`loc_${loc.locationId}_qty`] = loc.quantity;
      product[`loc_${loc.locationId}_pos`] = loc.localization || '';
    });
    product.locationQuantities = locationQuantities;
    res.json(product);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouveau produit
router.post('/', async (req, res) => {
  try {
    const product = req.body;
    
    // Calculate total quantity from location quantities
    let totalQuantity = product.quantity || 0;
    if (product.locationQuantities && typeof product.locationQuantities === 'object') {
      totalQuantity = Object.values(product.locationQuantities).reduce((sum, loc) => {
        return sum + (parseFloat(loc.quantity) || 0);
      }, 0);
    }

    if (useMySQL && pool) {
      const [result] = await pool.query(
        `INSERT INTO products (barcode, name, category, price, detailPrice, wholesalePrice, 
         expirationDate, quantity, quantityType, purchasePrice, image, serialNumber, 
         incomplete, addedFrom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.barcode, product.name, product.category, product.price,
          product.detailPrice, product.wholesalePrice, product.expirationDate,
          totalQuantity, product.quantityType || 'unit', product.purchasePrice,
          product.image, product.serialNumber, product.incomplete || 0, product.addedFrom
        ]
      );

      const newProduct = { id: result.insertId, ...product, totalQuantity };

      // Handle location quantities if provided
      if (product.locationQuantities && typeof product.locationQuantities === 'object') {
        for (const [locationId, locData] of Object.entries(product.locationQuantities)) {
          if (locData && typeof locData === 'object') {
            const qty = parseFloat(locData.quantity) || 0;
            const localization = locData.localization && String(locData.localization).trim() !== '' ? locData.localization : null;
            await pool.query(
              `INSERT INTO product_locations (productId, locationId, quantity, localization) 
               VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), localization = VALUES(localization)`,
              [result.insertId, parseInt(locationId), qty, localization]
            );
          }
        }
      }

      const [locationRows] = await pool.query(`
        SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `, [result.insertId]);

      const locationQuantities = {};
      locationRows.forEach(loc => {
        locationQuantities[loc.locationId] = {
          quantity: loc.quantity,
          localization: loc.localization,
          locationName: loc.locationName,
          locationType: loc.locationType
        };
        newProduct[`loc_${loc.locationId}_qty`] = loc.quantity;
        newProduct[`loc_${loc.locationId}_pos`] = loc.localization || '';
      });

      newProduct.locationQuantities = locationQuantities;
      req.io.emit('product:created', newProduct);
      return res.status(201).json(newProduct);
    }

    // SQLite fallback
    const stmt = sqliteDb.prepare(`INSERT INTO products (barcode, name, category, price, detailPrice, wholesalePrice, expirationDate, quantity, quantityType, purchasePrice, image, serialNumber, incomplete, addedFrom) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run([product.barcode, product.name, product.category, product.price, product.detailPrice, product.wholesalePrice, product.expirationDate, totalQuantity, product.quantityType || 'unit', product.purchasePrice, product.image, product.serialNumber, product.incomplete || 0, product.addedFrom]);
    const insertedId = info.lastInsertRowid || info.lastInsertROWID || info.lastInsertId || null;
    const newProduct = { id: insertedId, ...product, totalQuantity };

    if (product.locationQuantities && typeof product.locationQuantities === 'object') {
      for (const [locationId, locData] of Object.entries(product.locationQuantities)) {
        if (locData && typeof locData === 'object') {
          const qty = parseFloat(locData.quantity) || 0;
          const localization = locData.localization && String(locData.localization).trim() !== '' ? locData.localization : null;
          sqliteDb.prepare(`INSERT OR REPLACE INTO product_locations (productId, locationId, quantity, localization) VALUES (?, ?, ?, ?)`).run([insertedId, parseInt(locationId), qty, localization]);
        }
      }
    }

    const locationRows = sqliteDb.prepare(`
      SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `).all(insertedId);

    const locationQuantities = {};
    locationRows.forEach(loc => {
      locationQuantities[loc.locationId] = {
        quantity: loc.quantity,
        localization: loc.localization,
        locationName: loc.locationName,
        locationType: loc.locationType
      };
      newProduct[`loc_${loc.locationId}_qty`] = loc.quantity;
      newProduct[`loc_${loc.locationId}_pos`] = loc.localization || '';
    });

    newProduct.locationQuantities = locationQuantities;
    req.io.emit('product:created', newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Erreur lors de la création du produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un produit
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body;
    
    // Calculate total quantity from location quantities
    let totalQuantity = product.quantity || 0;
    if (product.locationQuantities && typeof product.locationQuantities === 'object') {
      totalQuantity = Object.values(product.locationQuantities).reduce((sum, loc) => {
        return sum + (parseFloat(loc.quantity) || 0);
      }, 0);
    }

    if (useMySQL && pool) {
      await pool.query(
        `UPDATE products SET barcode = ?, name = ?, category = ?, price = ?, 
         detailPrice = ?, wholesalePrice = ?, expirationDate = ?, quantity = ?, 
         quantityType = ?, purchasePrice = ?, image = ?, serialNumber = ?, 
         incomplete = ?, addedFrom = ?, updatedAt = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [
          product.barcode, product.name, product.category, product.price,
          product.detailPrice, product.wholesalePrice, product.expirationDate,
          totalQuantity, product.quantityType, product.purchasePrice,
          product.image, product.serialNumber, product.incomplete, product.addedFrom, id
        ]
      );

      // Handle location quantities if provided
      if (product.locationQuantities && typeof product.locationQuantities === 'object') {
        for (const [locationId, locData] of Object.entries(product.locationQuantities)) {
          if (locData && typeof locData === 'object') {
            await pool.query(
              `INSERT INTO product_locations (productId, locationId, quantity, localization) 
               VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), localization = VALUES(localization)`,
              [parseInt(id), parseInt(locationId), locData.quantity || 0, locData.localization || null]
            );
          }
        }
      }

      const [updatedLocationRows] = await pool.query(`
        SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `, [id]);

      const updatedLocationQuantities = {};
      updatedLocationRows.forEach(loc => {
        updatedLocationQuantities[loc.locationId] = {
          quantity: loc.quantity,
          localization: loc.localization,
          locationName: loc.locationName,
          locationType: loc.locationType
        };
      });

      const updatedProduct = { id: parseInt(id), ...product, totalQuantity };
      updatedProduct.locationQuantities = updatedLocationQuantities;
      updatedLocationRows.forEach(loc => {
        updatedProduct[`loc_${loc.locationId}_qty`] = loc.quantity;
        updatedProduct[`loc_${loc.locationId}_pos`] = loc.localization || '';
      });

      req.io.emit('product:updated', updatedProduct);
      return res.json(updatedProduct);
    }

    // SQLite fallback
    sqliteDb.prepare(`UPDATE products SET barcode = ?, name = ?, category = ?, price = ?, detailPrice = ?, wholesalePrice = ?, expirationDate = ?, quantity = ?, quantityType = ?, purchasePrice = ?, image = ?, serialNumber = ?, incomplete = ?, addedFrom = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run([product.barcode, product.name, product.category, product.price, product.detailPrice, product.wholesalePrice, product.expirationDate, totalQuantity, product.quantityType, product.purchasePrice, product.image, product.serialNumber, product.incomplete, product.addedFrom, id]);

    if (product.locationQuantities && typeof product.locationQuantities === 'object') {
      for (const [locationId, locData] of Object.entries(product.locationQuantities)) {
        if (locData && typeof locData === 'object') {
          sqliteDb.prepare(`INSERT OR REPLACE INTO product_locations (productId, locationId, quantity, localization) VALUES (?, ?, ?, ?)`).run([parseInt(id), parseInt(locationId), locData.quantity || 0, locData.localization || null]);
        }
      }
    }

    const updatedLocationRows = sqliteDb.prepare(`
      SELECT pl.locationId, pl.quantity, pl.localization, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `).all(id);

    const updatedLocationQuantities = {};
    updatedLocationRows.forEach(loc => {
      updatedLocationQuantities[loc.locationId] = {
        quantity: loc.quantity,
        localization: loc.localization,
        locationName: loc.locationName,
        locationType: loc.locationType
      };
    });

    const updatedProduct = { id: parseInt(id), ...product, totalQuantity };
    updatedProduct.locationQuantities = updatedLocationQuantities;
    updatedLocationRows.forEach(loc => {
      updatedProduct[`loc_${loc.locationId}_qty`] = loc.quantity;
      updatedProduct[`loc_${loc.locationId}_pos`] = loc.localization || '';
    });

    req.io.emit('product:updated', updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un produit
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (useMySQL && pool) {
      await pool.query('DELETE FROM products WHERE id = ?', [id]);
    } else {
      sqliteDb.prepare('DELETE FROM products WHERE id = ?').run([id]);
    }

    req.io.emit('product:deleted', { id: parseInt(id) });
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({ error: error.message });
  }
});
// Obtenir les emplacements d'un produit
router.get('/:id/locations', async (req, res) => {
  try {
    const { id } = req.params;
    if (useMySQL && pool) {
      const [rows] = await pool.query(`
        SELECT pl.*, l.name as locationName, l.type as locationType
        FROM product_locations pl
        JOIN locations l ON pl.locationId = l.id
        WHERE pl.productId = ?
        ORDER BY l.type, l.name
      `, [id]);
      return res.json(rows);
    }

    const rows = sqliteDb.prepare(`
      SELECT pl.*, l.name as locationName, l.type as locationType
      FROM product_locations pl
      JOIN locations l ON pl.locationId = l.id
      WHERE pl.productId = ?
      ORDER BY l.type, l.name
    `).all(id);
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des emplacements du produit:', error);
    res.status(500).json({ error: error.message });
  }
});
// Mettre à jour la quantité d'un produit
router.patch('/:id/quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (useMySQL && pool) {
      await pool.query('UPDATE products SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [quantity, id]);
    } else {
      sqliteDb.prepare('UPDATE products SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run([quantity, id]);
    }

    req.io.emit('product:quantity-updated', { id: parseInt(id), quantity });
    res.json({ message: 'Quantité mise à jour avec succès', id, quantity });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la quantité:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
