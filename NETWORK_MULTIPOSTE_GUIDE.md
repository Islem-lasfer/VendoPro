# 🌐 Système POS Multi-Postes - Guide Complet

## 📋 Vue d'ensemble

Votre système POS supporte maintenant deux modes de fonctionnement :

### Mode Local (Par défaut)
- Base de données SQLite locale
- Fonctionne sur une seule machine
- Aucune configuration réseau requise

### Mode Réseau Multi-Postes ✨
- Base de données MySQL centralisée
- Synchronisation en temps réel entre plusieurs machines
- Connexion via WiFi ou câble réseau
- Jusqu'à 10+ postes simultanés

---

## 🚀 Installation Serveur de Base de Données

### Étape 1: Installer MySQL

#### Windows
1. Téléchargez MySQL Server depuis: https://dev.mysql.com/downloads/installer/
2. Exécutez l'installateur et choisissez "Server Only"
3. Notez le mot de passe root que vous créez

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

#### macOS
```bash
brew install mysql
brew services start mysql
```

### Étape 2: Créer la Base de Données

1. Connectez-vous à MySQL:
```bash
mysql -u root -p
```

2. Exécutez le script de création:
```bash
mysql -u root -p < database-server/database.sql
```

Ou copiez-collez le contenu du fichier `database.sql` dans le terminal MySQL.

**IMPORTANT:** Changez le mot de passe dans le script SQL:
```sql
CREATE USER 'pos_user'@'%' IDENTIFIED BY 'votre_mot_de_passe_securise';
```

### Étape 3: Installer le Serveur d'API

```bash
cd database-server
npm install
```

### Étape 4: Configurer le Serveur

1. Créez le fichier `.env` (copiez depuis `.env.example`):
```bash
cp .env.example .env
```

2. Modifiez `.env` avec vos paramètres:
```env
PORT=3001

# Configuration MySQL
DB_HOST=localhost        # ou IP du serveur MySQL
DB_PORT=3306
DB_USER=pos_user
DB_PASSWORD=votre_mot_de_passe_securise
DB_NAME=pos_system

# Sécurité
API_SECRET=changez_cette_cle_secrete

# Synchronisation temps réel
ENABLE_REALTIME=true
```

### Étape 5: Démarrer le Serveur

```bash
# Mode développement (redémarre automatiquement)
npm run dev

# Mode production
npm start
```

Le serveur démarre sur le port 3001 (ou le port configuré dans .env).

---

## 💻 Configuration des Postes Clients

### Étape 1: Installer l'Application POS

Sur chaque poste client, installez l'application POS normalement:

```bash
cd Stock
npm install
npm run dev
```

### Étape 2: Configurer la Connexion Réseau

1. Ouvrez l'application POS
2. Allez dans **Paramètres → Réseau** (🌐)
3. Sélectionnez **Mode Réseau**
4. Entrez l'URL du serveur:
   - **Même machine:** `http://localhost:3001`
   - **Autre machine sur réseau local:** `http://192.168.1.100:3001`
   - **Nom d'hôte:** `http://server.local:3001`

5. Activez **Synchronisation temps réel** (recommandé)
6. Cliquez sur **Tester la connexion**
7. Si le test réussit, cliquez sur **Enregistrer**

### Étape 3: Redémarrer l'Application

Fermez et relancez l'application pour que les changements prennent effet.

---

## 🔧 Configuration Réseau Détaillée

### Trouver l'Adresse IP du Serveur

#### Windows
```powershell
ipconfig
```
Cherchez "Adresse IPv4" (ex: 192.168.1.100)

#### Linux/macOS
```bash
ifconfig
# ou
ip addr show
```

### Ouvrir le Port du Pare-feu

#### Windows Firewall
```powershell
# Exécuter en tant qu'administrateur
New-NetFirewallRule -DisplayName "POS Database Server" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

#### Linux (ufw)
```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

### Configuration Routeur/WiFi

Si les postes ne peuvent pas se connecter:
1. Assurez-vous que tous les appareils sont sur le même réseau
2. Désactivez l'isolation du client WiFi (AP Isolation) dans les paramètres du routeur
3. Vérifiez que le pare-feu du réseau autorise le port 3001

---

## ⚡ Synchronisation Temps Réel

### Fonctionnalités Synchronisées

Quand un utilisateur sur un poste effectue une action, tous les autres postes voient le changement instantanément:

- ✅ **Produits:** Ajout, modification, suppression, changement de quantité
- ✅ **Factures:** Création, suppression (ventes)
- ✅ **Employés:** Ajout, modification, suppression
- ✅ **Absences:** Ajout, suppression
- ✅ **Factures Fournisseurs:** Ajout, suppression

### Événements WebSocket

L'application utilise Socket.IO pour la communication en temps réel:

```javascript
// Exemples d'événements
product:created         // Nouveau produit ajouté
product:updated         // Produit modifié
product:deleted         // Produit supprimé
product:quantity-updated // Stock mis à jour
invoice:created         // Nouvelle vente
invoice:deleted         // Vente annulée
employee:created        // Nouvel employé
// etc.
```

### Gestion des Déconnexions

- Reconnexion automatique jusqu'à 5 tentatives
- Cache local pour continuer à travailler en cas de perte de connexion
- Indicateur de statut de connexion dans l'interface

---

## 📊 Architecture du Système

```
┌─────────────────────────────────────────────────────────┐
│                    Réseau Local (WiFi/Câble)            │
└─────────────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Poste 1  │   │ Poste 2  │   │ Poste 3  │
    │ (Client) │   │ (Client) │   │ (Client) │
    └──────────┘   └──────────┘   └──────────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                   ┌─────────────┐
                   │   Serveur   │
                   │  API + DB   │
                   │   (MySQL)   │
                   └─────────────┘
```

### Composants

**Serveur Central:**
- Serveur Express.js (port 3001)
- Base de données MySQL
- Socket.IO pour temps réel
- API REST pour opérations CRUD

**Clients (Postes):**
- Application Electron + React
- Client Socket.IO
- Cache local
- Interface utilisateur

---

## 🔒 Sécurité

### Recommandations

1. **Changez les mots de passe par défaut** dans `.env` et `database.sql`
2. **Utilisez HTTPS** en production (certificat SSL/TLS)
3. **Limitez l'accès réseau** au serveur (firewall)
4. **Sauvegardez régulièrement** la base de données MySQL
5. **Activez l'authentification** sur l'API si nécessaire

### Sauvegarde de la Base de Données

```bash
# Créer une sauvegarde
mysqldump -u pos_user -p pos_system > backup_$(date +%Y%m%d).sql

# Restaurer une sauvegarde
mysql -u pos_user -p pos_system < backup_20260202.sql
```

---

## 🧪 Tests et Dépannage

### Tester la Connexion au Serveur

```bash
# Test simple avec curl
curl http://192.168.1.100:3001/api/health

# Devrait retourner:
# {"status":"OK","message":"Serveur de base de données POS opérationnel","timestamp":"..."}
```

### Problèmes Courants

#### ❌ "Erreur de connexion" dans l'application

**Solutions:**
1. Vérifiez que le serveur est démarré: `cd database-server && npm start`
2. Vérifiez l'URL (IP, port)
3. Testez avec `curl` ou navigateur: `http://IP:3001/api/health`
4. Vérifiez le pare-feu

#### ❌ "Cannot connect to MySQL"

**Solutions:**
1. Vérifiez que MySQL est démarré
2. Vérifiez les identifiants dans `.env`
3. Testez la connexion: `mysql -u pos_user -p -h localhost pos_system`
4. Vérifiez que l'utilisateur a les permissions

#### ❌ Synchronisation temps réel ne fonctionne pas

**Solutions:**
1. Vérifiez que "Synchronisation temps réel" est activée
2. Vérifiez que WebSocket n'est pas bloqué
3. Regardez la console développeur (F12) pour les erreurs
4. Vérifiez que `ENABLE_REALTIME=true` dans `.env`

#### ❌ Lenteur du système

**Solutions:**
1. Augmentez `connectionLimit` dans `server.js` (MySQL pool)
2. Vérifiez la qualité de la connexion réseau
3. Optimisez les requêtes (ajoutez des index)
4. Activez la compression HTTP (déjà configuré)

---

## 📈 Performance et Scalabilité

### Recommandations

- **Maximum de postes recommandés:** 10-15 avec configuration standard
- **Pour plus de postes:**
  - Augmentez les ressources serveur (RAM, CPU)
  - Utilisez un serveur MySQL dédié
  - Optimisez les index de base de données
  - Configurez un load balancer pour l'API

### Optimisations

```javascript
// Dans server.js, augmentez le pool de connexions MySQL
const pool = mysql.createPool({
  // ...
  connectionLimit: 20,  // Augmentez selon vos besoins
  queueLimit: 0
});
```

---

## 🔄 Migration depuis Mode Local

### Importer les Données Existantes

Si vous avez déjà des données en mode local (SQLite), vous pouvez les migrer vers MySQL:

1. Exportez vos données depuis SQLite (à venir dans une prochaine version)
2. Importez dans MySQL via l'API ou directement dans la base

---

## 📞 Support et Contact

Pour toute question ou problème:
- Consultez les logs du serveur: `database-server/`
- Consultez la console développeur (F12) dans l'application
- Vérifiez les messages d'erreur détaillés

---

## 📝 Fichiers Importants

### Serveur
- `database-server/server.js` - Serveur principal
- `database-server/database.sql` - Schéma de base de données
- `database-server/.env` - Configuration
- `database-server/routes/` - Routes API

### Client
- `src/utils/dbAPI.js` - Client API REST
- `src/utils/realtimeSync.js` - Client WebSocket
- `src/pages/NetworkSettings/` - Interface configuration

---

## ✅ Checklist de Déploiement

### Serveur
- [ ] MySQL installé et configuré
- [ ] Base de données créée (`database.sql` exécuté)
- [ ] Mot de passe MySQL changé
- [ ] Fichier `.env` configuré
- [ ] Dépendances installées (`npm install`)
- [ ] Port 3001 ouvert dans le pare-feu
- [ ] Serveur démarré et accessible

### Chaque Poste Client
- [ ] Application POS installée
- [ ] Mode Réseau sélectionné
- [ ] URL du serveur configurée correctement
- [ ] Test de connexion réussi
- [ ] Synchronisation temps réel activée
- [ ] Application redémarrée

---

## 🎉 Félicitations !

Votre système POS est maintenant configuré en mode multi-postes !

Tous vos postes partagent maintenant la même base de données et se synchronisent en temps réel. 🚀
