import express from 'express';
import { pool, sqliteDb, useMySQL } from '../server.js';

const router = express.Router();

// Obtenir toutes les factures fournisseurs
router.get('/', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [rows] = await pool.query('SELECT * FROM supplier_invoices ORDER BY date DESC');
      return res.json(rows);
    }

    const rows = sqliteDb.prepare('SELECT * FROM supplier_invoices ORDER BY date DESC').all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des factures fournisseurs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir une facture fournisseur avec ses articles
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (useMySQL && pool) {
      const [invoices] = await pool.query('SELECT * FROM supplier_invoices WHERE id = ?', [id]);
      if (invoices.length === 0) return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
      const [items] = await pool.query('SELECT * FROM supplier_invoice_items WHERE invoiceId = ?', [id]);
      return res.json({ ...invoices[0], items });
    }

    const invoice = sqliteDb.prepare('SELECT * FROM supplier_invoices WHERE id = ?').get(id);
    if (!invoice) return res.status(404).json({ error: 'Facture fournisseur non trouvée' });
    const items = sqliteDb.prepare('SELECT * FROM supplier_invoice_items WHERE invoiceId = ?').all(id);
    res.json({ ...invoice, items });
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture fournisseur:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer une nouvelle facture fournisseur
router.post('/', async (req, res) => {
  try {
    const { items, ...invoiceData } = req.body;

    if (useMySQL && pool) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [invoiceResult] = await connection.query(
          `INSERT INTO supplier_invoices (invoiceNumber, supplierName, supplierAddress, supplierPhone, supplierEmail, date, subtotal, discount, tax, total, paymentStatus, paymentMethod, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [invoiceData.invoiceNumber, invoiceData.supplierName, invoiceData.supplierAddress, invoiceData.supplierPhone, invoiceData.supplierEmail, invoiceData.date, invoiceData.subtotal, invoiceData.discount, invoiceData.tax, invoiceData.total, invoiceData.paymentStatus, invoiceData.paymentMethod, invoiceData.notes]
        );
        const invoiceId = invoiceResult.insertId;

        if (items && items.length > 0) {
          for (const item of items) {
            await connection.query(`INSERT INTO supplier_invoice_items (invoiceId, productId, productName, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`, [invoiceId, item.productId, item.productName, item.quantity, item.price, item.total]);
            if (item.productId) {
              await connection.query('UPDATE products SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.productId]);
            }
          }
        }

        await connection.commit();
        const newInvoice = { id: invoiceId, ...invoiceData, items };
        req.io.emit('supplier-invoice:created', newInvoice);
        return res.status(201).json(newInvoice);
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    // SQLite fallback
    const insertInvoice = sqliteDb.prepare(`INSERT INTO supplier_invoices (invoiceNumber, supplierName, supplierAddress, supplierPhone, supplierEmail, date, subtotal, discount, tax, total, paymentStatus, paymentMethod, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertItem = sqliteDb.prepare(`INSERT INTO supplier_invoice_items (invoiceId, productId, productName, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`);
    const updateProduct = sqliteDb.prepare('UPDATE products SET quantity = quantity + ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');

    const tx = sqliteDb.transaction((invoiceData, items) => {
      const info = insertInvoice.run([invoiceData.invoiceNumber, invoiceData.supplierName, invoiceData.supplierAddress, invoiceData.supplierPhone, invoiceData.supplierEmail, invoiceData.date, invoiceData.subtotal, invoiceData.discount, invoiceData.tax, invoiceData.total, invoiceData.paymentStatus, invoiceData.paymentMethod, invoiceData.notes]);
      const invoiceId = info.lastInsertRowid || info.lastInsertROWID || info.lastInsertId || null;
      if (items && items.length > 0) {
        for (const item of items) {
          insertItem.run([invoiceId, item.productId, item.productName, item.quantity, item.price, item.total]);
          if (item.productId) updateProduct.run([item.quantity, item.productId]);
        }
      }
      return invoiceId;
    });

    const invoiceId = tx(invoiceData, items);
    const newInvoice = { id: invoiceId, ...invoiceData, items };
    req.io.emit('supplier-invoice:created', newInvoice);
    res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Erreur lors de la création de la facture fournisseur:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une facture fournisseur
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (useMySQL && pool) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [items] = await connection.query('SELECT * FROM supplier_invoice_items WHERE invoiceId = ?', [id]);
        for (const item of items) {
          if (item.productId) await connection.query('UPDATE products SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.productId]);
        }
        await connection.query('DELETE FROM supplier_invoices WHERE id = ?', [id]);
        await connection.commit();
        req.io.emit('supplier-invoice:deleted', { id: parseInt(id) });
        return res.json({ message: 'Facture fournisseur supprimée avec succès' });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    const items = sqliteDb.prepare('SELECT * FROM supplier_invoice_items WHERE invoiceId = ?').all(id);
    const tx = sqliteDb.transaction((items) => {
      for (const item of items) {
        if (item.productId) sqliteDb.prepare('UPDATE products SET quantity = quantity - ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run([item.quantity, item.productId]);
      }
      sqliteDb.prepare('DELETE FROM supplier_invoices WHERE id = ?').run([id]);
    });
    tx(items);

    req.io.emit('supplier-invoice:deleted', { id: parseInt(id) });
    res.json({ message: 'Facture fournisseur supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la facture fournisseur:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
