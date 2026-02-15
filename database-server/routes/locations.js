import express from 'express';
import { sqliteDb, pool, useMySQL } from '../server.js';

const router = express.Router();

// Get all locations
router.get('/', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [rows] = await pool.query('SELECT * FROM locations ORDER BY name');
      return res.json(rows);
    }

    const rows = sqliteDb.prepare('SELECT * FROM locations ORDER BY name').all();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single location
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (useMySQL && pool) {
      const [rows] = await pool.query('SELECT * FROM locations WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Location not found' });
      return res.json(rows[0]);
    }

    const row = sqliteDb.prepare('SELECT * FROM locations WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Location not found' });
    res.json(row);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;