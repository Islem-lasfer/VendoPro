import express from 'express';
import { pool, sqliteDb, useMySQL } from '../server.js';

const router = express.Router();

// Obtenir toutes les factures
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM invoices';
    let params = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY date DESC';

    if (useMySQL && pool) {
      const [rows] = await pool.query(query, params);
      return res.json(rows);
    }

    // SQLite fallback
    const rows = sqliteDb.prepare(query).all(...params);
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer toutes les factures (clear history) - utile pour le mode réseau
router.delete('/', async (req, res) => {
  try {
    if (useMySQL && pool) {
      // MySQL: execute deletes inside a transaction
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM invoice_items');
        await connection.query('DELETE FROM invoices');
        await connection.commit();
        req.io.emit('invoices:cleared');
        return res.json({ success: true });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // SQLite fallback
    const tx = sqliteDb.transaction(() => {
      sqliteDb.prepare('DELETE FROM invoice_items').run();
      sqliteDb.prepare('DELETE FROM invoices').run();
    });
    tx();
    req.io.emit('invoices:cleared');
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression de toutes les factures:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir une facture avec ses articles
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (useMySQL && pool) {
      const [invoices] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
      if (invoices.length === 0) return res.status(404).json({ error: 'Facture non trouvée' });
      const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoiceId = ?', [id]);
      return res.json({ ...invoices[0], items });
    }

    // SQLite fallback
    const invoice = sqliteDb.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!invoice) return res.status(404).json({ error: 'Facture non trouvée' });
    const items = sqliteDb.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id);
    res.json({ ...invoice, items });
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer une nouvelle facture
router.post('/', async (req, res) => {
  try {
    const { items, ...invoiceData } = req.body;

    if (useMySQL && pool) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [invoiceResult] = await connection.query(
          `INSERT INTO invoices (invoiceNumber, date, subtotal, discount, tax, total, 
           paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientId,
           paymentStatus, companyName, companyAddress, companyContact, companyTaxId,
           garantieDuration, garantieEndDate, notes, type, source) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceData.invoiceNumber, invoiceData.date, invoiceData.subtotal,
            invoiceData.discount, invoiceData.tax, invoiceData.total,
            invoiceData.paymentMethod, invoiceData.customerName,
            invoiceData.clientAddress, invoiceData.clientEmail, invoiceData.clientPhone,
            invoiceData.clientId, invoiceData.paymentStatus, invoiceData.companyName,
            invoiceData.companyAddress, invoiceData.companyContact, invoiceData.companyTaxId,
            invoiceData.garantieDuration, invoiceData.garantieEndDate, invoiceData.notes,
            invoiceData.type, invoiceData.source
          ]
        );
        const invoiceId = invoiceResult.insertId;

        if (items && items.length > 0) {
          for (const item of items) {
            await connection.query(
              `INSERT INTO invoice_items (invoiceId, productId, productName, serialNumber, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [invoiceId, item.productId, item.productName, item.serialNumber, item.quantity, item.price, item.total]
            );
            await connection.query('UPDATE products SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.productId]);
          }
        }

        await connection.commit();
        const newInvoice = { id: invoiceId, ...invoiceData, items };
        req.io.emit('invoice:created', newInvoice);
        return res.status(201).json(newInvoice);
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // SQLite fallback: do all operations in a transaction
    const insertInvoice = sqliteDb.prepare(`INSERT INTO invoices (invoiceNumber, date, subtotal, discount, tax, total, paymentMethod, customerName, clientAddress, clientEmail, clientPhone, clientId, paymentStatus, companyName, companyAddress, companyContact, companyTaxId, garantieDuration, garantieEndDate, notes, type, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertItem = sqliteDb.prepare(`INSERT INTO invoice_items (invoiceId, productId, productName, serialNumber, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const updateProductQty = sqliteDb.prepare('UPDATE products SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');

    const tx = sqliteDb.transaction((invoiceData, items) => {
      const info = insertInvoice.run([invoiceData.invoiceNumber, invoiceData.date, invoiceData.subtotal, invoiceData.discount, invoiceData.tax, invoiceData.total, invoiceData.paymentMethod, invoiceData.customerName, invoiceData.clientAddress, invoiceData.clientEmail, invoiceData.clientPhone, invoiceData.clientId, invoiceData.paymentStatus, invoiceData.companyName, invoiceData.companyAddress, invoiceData.companyContact, invoiceData.companyTaxId, invoiceData.garantieDuration, invoiceData.garantieEndDate, invoiceData.notes, invoiceData.type, invoiceData.source]);
      const invoiceId = info.lastInsertRowid || info.lastInsertROWID || info.lastInsertId || null;
      if (items && items.length > 0) {
        for (const item of items) {
          insertItem.run([invoiceId, item.productId, item.productName, item.serialNumber, item.quantity, item.price, item.total]);
          updateProductQty.run([item.quantity, item.productId]);
        }
      }
      return invoiceId;
    });

    const invoiceId = tx(invoiceData, items);
    const newInvoice = { id: invoiceId, ...invoiceData, items };
    req.io.emit('invoice:created', newInvoice);
    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une facture
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (useMySQL && pool) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [items] = await connection.query('SELECT * FROM invoice_items WHERE invoiceId = ?', [id]);
        for (const item of items) {
          await connection.query('UPDATE products SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.productId]);
        }
        await connection.query('DELETE FROM invoices WHERE id = ?', [id]);
        await connection.commit();
        req.io.emit('invoice:deleted', { id: parseInt(id) });
        return res.json({ message: 'Facture supprimée avec succès' });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // SQLite fallback
    const items = sqliteDb.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(id);
    const tx = sqliteDb.transaction((items) => {
      for (const item of items) {
        sqliteDb.prepare('UPDATE products SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run([item.quantity, item.productId]);
      }
      sqliteDb.prepare('DELETE FROM invoices WHERE id = ?').run([id]);
    });
    tx(items);

    req.io.emit('invoice:deleted', { id: parseInt(id) });
    res.json({ message: 'Facture supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la facture:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
