import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import productsRouter from './routes/products.js';
import invoicesRouter from './routes/invoices.js';
import employeesRouter from './routes/employees.js';
import supplierInvoicesRouter from './routes/supplier-invoices.js';
import statsRouter from './routes/stats.js';
import locationsRouter from './routes/locations.js';

// Charger les variables d'environnement
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configuration Socket.IO pour synchronisation temps réel
const io = new Server(httpServer, {
  cors: {
    origin: '*', // En production, spécifiez les origines autorisées
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Déterminer si on utilise MySQL ou SQLite
let useMySQL = true;
let pool = null;
let sqliteDb = null;

// Essayer de se connecter à MySQL
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4'
  });
  
  // Tester la connexion
  await pool.query('SELECT 1');
  console.log('✅ MySQL connection successful');
} catch (error) {
  console.log('⚠️  MySQL not available, falling back to SQLite');
  console.log('💡 To use MySQL: Install MySQL and configure database-server/.env');
  useMySQL = false;
  pool = null;
  
  // ✅ Use the exact database file path passed from Electron
  let dbPath = process.env.DB_FILE_PATH;
  
  if (!dbPath) {
    console.warn('⚠️ DB_FILE_PATH not provided, using default');
    if (process.env.APP_DATA_PATH) {
      dbPath = join(process.env.APP_DATA_PATH, 'pos.db');
    } else {
      dbPath = join(__dirname, '..', 'electron', 'database', 'pos.db');
    }
  }
  
  console.log('📂 SQLite database path:', dbPath);
  
  const dbDir = dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // ✅ Open the SAME database file
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  console.log('✅ SQLite database opened (shared with Electron app)');
  
  // Import the createTables helper from Electron's schema for SQLite initialization
  try {
    // Use dynamic require for CommonJS module compatibility and try multiple lookup locations
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);

    // Candidate paths to look for schema.js (covers dev and packaged layouts)
    const candidates = [
      join(__dirname, '..', 'electron', 'database', 'schema.js'),
      join(process.resourcesPath || __dirname, 'electron', 'database', 'schema.js'),
      join(process.resourcesPath || __dirname, '..', 'electron', 'database', 'schema.js'),
      join(__dirname, '..', '..', 'electron', 'database', 'schema.js')
    ];

    let schema = null;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          console.log('📂 Loading schema from:', p);
          schema = require(p);
          break;
        }
      } catch (_e) {
        // ignore and continue
      }
    }

    // Fallback: try package name resolution if available inside bundled app
    if (!schema) {
      try {
        schema = require('electron/database/schema.js');
        console.log('📂 Loaded schema via module name resolution');
      } catch (e) {
        // last attempt: try resolving relative to process.cwd()
        try {
          const alt = join(process.cwd(), 'electron', 'database', 'schema.js');
          if (fs.existsSync(alt)) {
            console.log('📂 Loading schema from process.cwd():', alt);
            schema = require(alt);
          }
        } catch (e2) {
          // ignore
        }
      }
    }

    if (!schema) {
      throw new Error('schema.js not found in expected locations. Make sure electron/database/schema.js is packed with the app or copy it into the database-server folder.');
    }

    const createTables = schema && (schema.createTables || (schema.default && schema.default.createTables));
    if (typeof createTables === 'function') {
      createTables(sqliteDb);
    } else {
      console.warn('⚠️ createTables not found in schema module');
    }
  } catch (e) {
    console.error('❌ Error importing schema.createTables:', e && e.message ? e.message : e);
  }
}

// Export pool (ou wrapper SQLite)
export { pool, sqliteDb, useMySQL };

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rendre io disponible dans les routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes API
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/supplier-invoices', supplierInvoicesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/locations', locationsRouter);

// Route de test
app.get('/api/health', async (req, res) => {
  try {
    if (useMySQL) {
      await pool.query('SELECT 1');
    } else {
      sqliteDb.prepare('SELECT 1').get();
    }
    res.json({ 
      status: 'OK', 
      message: `Serveur de base de données POS opérationnel (${useMySQL ? 'MySQL' : 'SQLite'})`,
      database: useMySQL ? 'MySQL' : 'SQLite',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Erreur de connexion à la base de données',
      error: error.message 
    });
  }
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur interne du serveur'
  });
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Client connecté: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client déconnecté: ${socket.id}`);
  });

  // Rejoindre une room spécifique pour les notifications ciblées
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} a rejoint la room: ${room}`);
  });
});

// Export de io pour l'utiliser dans les routes
export { io };

// ✅ Démarrage du serveur - STORE INSTANCE FOR ELECTRON
const PORT = process.env.PORT || 3001;
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 =====================================');
  console.log(`🚀 Serveur POS Database démarré`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Base de données: ${useMySQL ? 'MySQL (' + process.env.DB_NAME + ')' : 'SQLite (pos.db)'}`);
  console.log(`🚀 Synchronisation temps réel: ${process.env.ENABLE_REALTIME === 'true' ? 'Activée' : 'Désactivée'}`);
  if (!useMySQL) {
    console.log('💡 Pour utiliser MySQL: Installez MySQL et configurez .env');
  }
  console.log('🚀 =====================================');
});

// ✅ EXPORT SERVER INSTANCE FOR ELECTRON INTEGRATION
export { server };
export default server;

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM reçu, fermeture du serveur...');
  if (useMySQL && pool) {
    await pool.end();
  }
  if (sqliteDb) {
    sqliteDb.close();
  }
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT reçu, fermeture du serveur...');
  if (useMySQL && pool) {
    await pool.end();
  }
  if (sqliteDb) {
    sqliteDb.close();
  }
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

// ✅ EXPORT CLEANUP FUNCTION FOR ELECTRON
export async function shutdownServer() {
  console.log('🔄 Shutting down database server...');
  
  return new Promise(async (resolve) => {
    if (useMySQL && pool) {
      await pool.end();
    }
    if (sqliteDb) {
      sqliteDb.close();
    }
    
    server.close(() => {
      console.log('✅ Server shutdown complete');
      resolve();
    });
  });
}