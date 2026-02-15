# MySQL Setup for POS Database Server

## Quick MySQL Setup Guide

### Step 1: Install MySQL
1. Download MySQL Community Server from: https://dev.mysql.com/downloads/mysql/
2. Run the installer
3. During installation:
   - Choose "Server only" or "Developer Default"
   - Set a root password (remember it!)
   - Keep default port: 3306
   - Start MySQL as Windows Service

### Step 2: Verify MySQL is Running
Open Command Prompt and run:
```bash
mysql --version
```
You should see: `mysql Ver 8.x.x`

Or check Windows Services:
- Press `Win + R`, type `services.msc`
- Look for "MySQL80" or similar
- Status should be "Running"

### Step 3: Create Database
Open MySQL Command Line Client (installed with MySQL) and run:
```sql
CREATE DATABASE pos_system;
```

Or use the SQL file:
```bash
mysql -u root -p < database-server/database.sql
```

### Step 4: Update Database Password
Edit `database-server\.env` file:
```env
DB_PASSWORD=your_mysql_password_here
```
Replace `your_mysql_password_here` with the password you set during MySQL installation.

### Step 5: Test Connection
Restart your POS app and click "Start Server Now"

---

## OR Use SQLite Instead (No MySQL Needed)

If you don't want to install MySQL, you can use SQLite for local database.
Just use "Local Mode" in Network Settings instead of "Network Mode".

Local Mode uses SQLite which is built-in, no setup required!
