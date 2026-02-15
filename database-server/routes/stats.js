import express from 'express';
import { pool, sqliteDb, useMySQL } from '../server.js';

const router = express.Router();

// Obtenir les statistiques générales
router.get('/overview', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [salesResult] = await pool.query(
        "SELECT COALESCE(SUM(total), 0) as totalSales FROM invoices WHERE type = 'sale'"
      );
      const [productsResult] = await pool.query('SELECT COUNT(*) as totalProducts FROM products');
      const [stockResult] = await pool.query('SELECT COALESCE(SUM(price * quantity), 0) as stockValue FROM products');
      const [todayInvoicesResult] = await pool.query("SELECT COUNT(*) as todayInvoices FROM invoices WHERE DATE(date) = CURDATE() AND type = 'sale'");

      return res.json({
        totalSales: salesResult[0].totalSales,
        totalProducts: productsResult[0].totalProducts,
        stockValue: stockResult[0].stockValue,
        todayInvoices: todayInvoicesResult[0].todayInvoices
      });
    }

    // SQLite fallback
    const salesRow = sqliteDb.prepare("SELECT COALESCE(SUM(total),0) as totalSales FROM invoices WHERE type = 'sale'").get();
    const productsRow = sqliteDb.prepare('SELECT COUNT(*) as totalProducts FROM products').get();
    const stockRow = sqliteDb.prepare('SELECT COALESCE(SUM(price * quantity),0) as stockValue FROM products').get();
    const todayRow = sqliteDb.prepare("SELECT COUNT(*) as todayInvoices FROM invoices WHERE DATE(date) = DATE('now','localtime') AND type = 'sale'").get();

    res.json({
      totalSales: salesRow.totalSales || 0,
      totalProducts: productsRow.totalProducts || 0,
      stockValue: stockRow.stockValue || 0,
      todayInvoices: todayRow.todayInvoices || 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ventes par période
router.get('/sales-by-period', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFormat;
    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'year':
        dateFormat = '%Y';
        break;
      default: // month
        dateFormat = '%Y-%m';
    }
    
    if (useMySQL && pool) {
      const [rows] = await pool.query(
        `SELECT DATE_FORMAT(date, ?) as period, 
                COUNT(*) as count, 
                SUM(total) as total 
         FROM invoices 
         WHERE type = 'sale'
         GROUP BY period 
         ORDER BY period DESC 
         LIMIT 12`,
        [dateFormat]
      );
      return res.json(rows);
    }

    // SQLite: map MySQL date format to strftime
    let fmt = '%Y-%m';
    if (dateFormat === '%Y-%m-%d') fmt = '%Y-%m-%d';
    if (dateFormat === '%Y-%u') fmt = '%Y-%W';
    if (dateFormat === '%Y') fmt = '%Y';

    const rows = sqliteDb.prepare(`SELECT strftime('${fmt}', date) as period, COUNT(*) as count, SUM(total) as total FROM invoices WHERE type = 'sale' GROUP BY period ORDER BY period DESC LIMIT 12`).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des ventes par période:', error);
    res.status(500).json({ error: error.message });
  }
});

// Produits les plus vendus
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    if (useMySQL && pool) {
      const [rows] = await pool.query(
        `SELECT p.id, p.name, p.category, 
                SUM(ii.quantity) as totalSold,
                SUM(ii.total) as revenue
         FROM invoice_items ii
         JOIN products p ON ii.productId = p.id
         JOIN invoices i ON ii.invoiceId = i.id
         WHERE i.type = 'sale'
         GROUP BY p.id, p.name, p.category
         ORDER BY totalSold DESC
         LIMIT ?`,
        [parseInt(limit)]
      );
      return res.json(rows);
    }

    const rows = sqliteDb.prepare(`
      SELECT p.id, p.name, p.category, SUM(ii.quantity) as totalSold, SUM(ii.total) as revenue
      FROM invoice_items ii
      JOIN products p ON ii.productId = p.id
      JOIN invoices i ON ii.invoiceId = i.id
      WHERE i.type = 'sale'
      GROUP BY p.id, p.name, p.category
      ORDER BY totalSold DESC
      LIMIT ?
    `).all(parseInt(limit));
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits les plus vendus:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ventes par catégorie
router.get('/sales-by-category', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [rows] = await pool.query(
        `SELECT p.category,
                COUNT(DISTINCT ii.id) as itemCount,
                SUM(ii.quantity) as totalQuantity,
                SUM(ii.total) as totalRevenue
         FROM invoice_items ii
         JOIN products p ON ii.productId = p.id
         JOIN invoices i ON ii.invoiceId = i.id
         WHERE i.type = 'sale' AND p.category IS NOT NULL
         GROUP BY p.category
         ORDER BY totalRevenue DESC`
      );
      return res.json(rows);
    }

    const rows = sqliteDb.prepare(`
      SELECT p.category, COUNT(ii.id) as itemCount, SUM(ii.quantity) as totalQuantity, SUM(ii.total) as totalRevenue
      FROM invoice_items ii
      JOIN products p ON ii.productId = p.id
      JOIN invoices i ON ii.invoiceId = i.id
      WHERE i.type = 'sale' AND p.category IS NOT NULL
      GROUP BY p.category
      ORDER BY totalRevenue DESC
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des ventes par catégorie:', error);
    res.status(500).json({ error: error.message });
  }
});

// Produits en rupture de stock
router.get('/low-stock', async (req, res) => {
  try {
    const { threshold = 5 } = req.query;
    
    if (useMySQL && pool) {
      const [rows] = await pool.query('SELECT * FROM products WHERE quantity <= ? ORDER BY quantity ASC', [parseInt(threshold)]);
      return res.json(rows);
    }

    const rows = sqliteDb.prepare('SELECT * FROM products WHERE quantity <= ? ORDER BY quantity ASC').all(parseInt(threshold));
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits en rupture de stock:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
