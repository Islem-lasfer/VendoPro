import express from 'express';
import { pool, sqliteDb, useMySQL } from '../server.js';

const router = express.Router();

// Obtenir tous les employés
router.get('/', async (req, res) => {
  try {
    if (useMySQL && pool) {
      const [rows] = await pool.query('SELECT * FROM employees ORDER BY name');
      return res.json(rows);
    }

    // SQLite fallback
    const stmt = sqliteDb.prepare('SELECT * FROM employees ORDER BY name');
    const rows = stmt.all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des employés:', error);
    res.status(500).json({ error: error.message });
  }
});

// Créer un nouvel employé
router.post('/', async (req, res) => {
  try {
    const employee = req.body;

    if (useMySQL && pool) {
      const [result] = await pool.query(
        `INSERT INTO employees (name, position, salary, startDate, phone, email, address) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [employee.name, employee.position, employee.salary, employee.startDate,
         employee.phone, employee.email, employee.address]
      );
      const newEmployee = { id: result.insertId, ...employee };
      req.io.emit('employee:created', newEmployee);
      return res.status(201).json(newEmployee);
    }

    // SQLite fallback
    const stmt = sqliteDb.prepare(`INSERT INTO employees (name, position, salary, startDate, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run([employee.name, employee.position, employee.salary, employee.startDate, employee.phone, employee.email, employee.address]);
    const newEmployee = { id: info.lastInsertRowid || info.lastInsertROWID || info.lastInsertId || null, ...employee };
    req.io.emit('employee:created', newEmployee);
    res.status(201).json(newEmployee);
  } catch (error) {
    console.error('Erreur lors de la création de l\'employé:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un employé
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const employee = req.body;

    if (useMySQL && pool) {
      await pool.query(
        `UPDATE employees SET name = ?, position = ?, salary = ?, startDate = ?, 
         phone = ?, email = ?, address = ?, updatedAt = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [employee.name, employee.position, employee.salary, employee.startDate,
         employee.phone, employee.email, employee.address, id]
      );
    } else {
      const stmt = sqliteDb.prepare(`UPDATE employees SET name = ?, position = ?, salary = ?, startDate = ?, phone = ?, email = ?, address = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run([employee.name, employee.position, employee.salary, employee.startDate, employee.phone, employee.email, employee.address, id]);
    }

    const updatedEmployee = { id: parseInt(id), ...employee };
    req.io.emit('employee:updated', updatedEmployee);
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'employé:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un employé
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (useMySQL && pool) {
      await pool.query('DELETE FROM employees WHERE id = ?', [id]);
    } else {
      const stmt = sqliteDb.prepare('DELETE FROM employees WHERE id = ?');
      stmt.run([id]);
    }

    req.io.emit('employee:deleted', { id: parseInt(id) });
    res.json({ message: 'Employé supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'employé:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les absences d'un employé
router.get('/:id/absences', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM absences WHERE employeeId = ? ORDER BY date DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des absences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ajouter une absence
router.post('/:id/absences', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, reason } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO absences (employeeId, date, reason) VALUES (?, ?, ?)',
      [id, date, reason]
    );
    
    const newAbsence = { id: result.insertId, employeeId: parseInt(id), date, reason };
    
    // Notifier tous les clients connectés
    req.io.emit('absence:created', newAbsence);
    
    res.status(201).json(newAbsence);
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'absence:', error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une absence
router.delete('/:employeeId/absences/:absenceId', async (req, res) => {
  try {
    const { absenceId } = req.params;
    await pool.query('DELETE FROM absences WHERE id = ?', [absenceId]);
    
    // Notifier tous les clients connectés
    req.io.emit('absence:deleted', { id: parseInt(absenceId) });
    
    res.json({ message: 'Absence supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'absence:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
