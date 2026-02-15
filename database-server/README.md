# Serveur de Base de Données Centralisé - POS

Ce serveur permet de connecter plusieurs postes POS à une base de données MySQL commune avec synchronisation en temps réel.

## 🚀 Installation

```bash
npm install
```

## ⚙️ Configuration

1. Créez le fichier `.env` (copier depuis `.env.example`)
2. Configurez vos paramètres MySQL:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=pos_user
DB_PASSWORD=votre_mot_de_passe
DB_NAME=pos_system
ENABLE_REALTIME=true
```

3. Créez la base de données MySQL:

```bash
mysql -u root -p < database.sql
```

## 🏃 Démarrage

**Développement:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Le serveur démarre sur `http://0.0.0.0:3001`

## 📡 API Endpoints

### Santé
- `GET /api/health` - Vérifier l'état du serveur

### Produits
- `GET /api/products` - Liste tous les produits
- `GET /api/products/search?query=...` - Rechercher
- `GET /api/products/barcode/:barcode` - Par code-barres
- `POST /api/products` - Créer
- `PUT /api/products/:id` - Modifier
- `DELETE /api/products/:id` - Supprimer
- `PATCH /api/products/:id/quantity` - Mettre à jour stock

### Factures
- `GET /api/invoices` - Liste toutes les factures
- `GET /api/invoices/:id` - Détails d'une facture
- `POST /api/invoices` - Créer
- `DELETE /api/invoices/:id` - Supprimer

### Employés
- `GET /api/employees` - Liste
- `POST /api/employees` - Créer
- `PUT /api/employees/:id` - Modifier
- `DELETE /api/employees/:id` - Supprimer
- `GET /api/employees/:id/absences` - Absences
- `POST /api/employees/:id/absences` - Ajouter absence
- `DELETE /api/employees/:employeeId/absences/:absenceId` - Supprimer absence

### Factures Fournisseurs
- `GET /api/supplier-invoices` - Liste
- `GET /api/supplier-invoices/:id` - Détails
- `POST /api/supplier-invoices` - Créer
- `DELETE /api/supplier-invoices/:id` - Supprimer

### Statistiques
- `GET /api/stats/overview` - Vue d'ensemble
- `GET /api/stats/sales-by-period?period=month` - Ventes par période
- `GET /api/stats/top-products?limit=10` - Produits populaires
- `GET /api/stats/sales-by-category` - Ventes par catégorie
- `GET /api/stats/low-stock?threshold=5` - Produits en rupture

## 🔄 Événements WebSocket

Le serveur émet des événements en temps réel pour synchroniser les clients:

- `product:created`
- `product:updated`
- `product:deleted`
- `product:quantity-updated`
- `invoice:created`
- `invoice:deleted`
- `employee:created`
- `employee:updated`
- `employee:deleted`
- `absence:created`
- `absence:deleted`
- `supplier-invoice:created`
- `supplier-invoice:deleted`

## 🔒 Sécurité

- Changez les mots de passe par défaut
- Configurez un pare-feu
- Utilisez HTTPS en production
- Limitez l'accès réseau

## 📊 Structure

```
database-server/
├── server.js              # Serveur principal
├── database.sql           # Schéma MySQL
├── .env                   # Configuration
├── .env.example          # Exemple de config
├── package.json
└── routes/
    ├── products.js
    ├── invoices.js
    ├── employees.js
    ├── supplier-invoices.js
    └── stats.js
```

## 🆘 Support

Consultez **NETWORK_MULTIPOSTE_GUIDE.md** pour le guide complet.
