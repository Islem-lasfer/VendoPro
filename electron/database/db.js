const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { app } = require('electron');
const { createTables } = require('./schema');

let db = null;

const initDatabase = async () => {
  try {
    const userDataPath = app.getPath('userData');
    
    // ✅ Use pos.db for both dev and production
    const dbPath = app.isPackaged 
      ? path.join(userDataPath, 'pos.db')
      : path.join(__dirname, 'pos.db');
    
    console.log('📂 Database path:', dbPath);
    
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // ✅ Open database with better-sqlite3 (supports concurrent access)
    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    
    // Create tables
    createTables(db);
    
    console.log('✅ Database initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// No need for saveDatabase() anymore - better-sqlite3 writes directly to disk
const saveDatabase = () => {
  // This function is kept for backward compatibility but does nothing
  // better-sqlite3 automatically saves to disk
  if (db) {
    // Optionally checkpoint the WAL
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (error) {
      console.error('Error checkpointing WAL:', error);
    }
  }
};

// Close database
const closeDatabase = () => {
  if (db) {
    try {
      db.close();
      db = null;
      console.log('✅ Database closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
};

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  closeDatabase
};