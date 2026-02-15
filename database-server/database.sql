-- Script de création de la base de données MySQL pour système POS multi-postes
-- Exécutez ce script sur votre serveur MySQL

CREATE DATABASE IF NOT EXISTS pos_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pos_system;

-- Table des produits
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barcode VARCHAR(255) UNIQUE,
  name VARCHAR(500) NOT NULL,
  category VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  detailPrice DECIMAL(10, 2),
  wholesalePrice DECIMAL(10, 2),
  expirationDate DATE,
  quantity INT DEFAULT 0,
  quantityType VARCHAR(50) DEFAULT 'unit',
  purchasePrice DECIMAL(10, 2),
  image TEXT,
  serialNumber VARCHAR(255),
  incomplete TINYINT DEFAULT 0,
  addedFrom VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_barcode (barcode),
  INDEX idx_name (name(255)),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des emplacements
CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des quantités de produits par emplacement
CREATE TABLE IF NOT EXISTS product_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productId INT NOT NULL,
  locationId INT NOT NULL,
  quantity INT DEFAULT 0,
  localization VARCHAR(500),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (locationId) REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE KEY unique_product_location (productId, locationId),
  INDEX idx_productId (productId),
  INDEX idx_locationId (locationId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insérer des emplacements par défaut
INSERT IGNORE INTO locations (name, type) VALUES ('Shop 1', 'shop');
INSERT IGNORE INTO locations (name, type) VALUES ('Stock 1', 'stock');

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceNumber VARCHAR(255) UNIQUE NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  paymentMethod VARCHAR(100),
  customerName VARCHAR(500),
  clientAddress TEXT,
  clientEmail VARCHAR(255),
  clientPhone VARCHAR(50),
  clientId VARCHAR(100),
  paymentStatus VARCHAR(50),
  companyName VARCHAR(500),
  companyAddress TEXT,
  companyContact VARCHAR(255),
  companyTaxId VARCHAR(100),
  garantieDuration VARCHAR(100),
  garantieEndDate DATE,
  notes TEXT,
  type VARCHAR(50),
  source VARCHAR(50),
  INDEX idx_invoiceNumber (invoiceNumber),
  INDEX idx_date (date),
  INDEX idx_customerName (customerName(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des articles de facture
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceId INT NOT NULL,
  productId INT NOT NULL,
  productName VARCHAR(500) NOT NULL,
  serialNumber VARCHAR(255),
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id),
  INDEX idx_invoiceId (invoiceId),
  INDEX idx_productId (productId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des employés
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  position VARCHAR(255),
  salary DECIMAL(10, 2) DEFAULT 0,
  startDate DATE,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des absences
CREATE TABLE IF NOT EXISTS absences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeId INT NOT NULL,
  date DATE NOT NULL,
  reason VARCHAR(255),
  FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_employeeId (employeeId),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des factures fournisseurs
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceNumber VARCHAR(255) UNIQUE NOT NULL,
  supplierName VARCHAR(500) NOT NULL,
  supplierAddress TEXT,
  supplierPhone VARCHAR(50),
  supplierEmail VARCHAR(255),
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  paymentStatus VARCHAR(50),
  paymentMethod VARCHAR(100),
  notes TEXT,
  INDEX idx_invoiceNumber (invoiceNumber),
  INDEX idx_supplierName (supplierName(255)),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table des articles de facture fournisseur
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoiceId INT NOT NULL,
  productId INT,
  productName VARCHAR(500) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (invoiceId) REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id),
  INDEX idx_invoiceId (invoiceId),
  INDEX idx_productId (productId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table de synchronisation pour suivre les modifications
CREATE TABLE IF NOT EXISTS sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tableName VARCHAR(100) NOT NULL,
  recordId INT NOT NULL,
  operation VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clientId VARCHAR(100),
  INDEX idx_timestamp (timestamp),
  INDEX idx_table (tableName)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Créer un utilisateur pour l'application
-- IMPORTANT: Changez le mot de passe par un mot de passe sécurisé
CREATE USER IF NOT EXISTS 'pos_user'@'%' IDENTIFIED BY 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON pos_system.* TO 'pos_user'@'%';
FLUSH PRIVILEGES;

-- Afficher un message de confirmation
SELECT 'Base de données créée avec succès!' AS Status;
