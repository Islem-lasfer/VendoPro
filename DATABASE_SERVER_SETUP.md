# 🖥️ Database Server Setup Guide (No Command Line!)

## For the MAIN Computer (Server) - 192.168.1.6

### Step 1: Install MySQL
1. Download **MySQL Community Server** from: https://dev.mysql.com/downloads/mysql/
2. Run the installer
3. During setup:
   - Choose "Developer Default" or "Server only"
   - Set root password (remember this!)
   - Use default port 3306

### Step 2: Create Database
1. Open **MySQL Workbench** (installed with MySQL)
2. Connect to your local server
3. Go to **File → Open SQL Script**
4. Select: `database-server\database.sql`
5. Click the **⚡ Execute** button (lightning icon)
6. Database `pos_system` is now created!

### Step 3: Configure Database Connection
1. Open `database-server\.env` file in Notepad
2. Update the password line:
   ```
   DB_PASSWORD=your_mysql_root_password
   ```
3. Save and close

### Step 4: Start Database Server
**🎯 SIMPLE METHOD - Just Double-Click:**

1. Double-click: **`START_DATABASE_SERVER.bat`**
2. Wait for "SERVER RUNNING" message
3. **Keep this window open** while using POS
4. You'll see something like:
   ```
   ===============================================
     SERVER RUNNING - Keep this window open!
   ===============================================
   
   Server Address: http://192.168.1.6:3001
   ```

### Step 5: On Client Computers
1. Open POS application
2. Go to **Network Settings**
3. Enter server IP: `192.168.1.6`
4. Port: `3001`
5. Click **Test Connection** ✅
6. Enable network mode

---

## 🔧 Troubleshooting

### "Failed to install packages"
- Install **Node.js**: https://nodejs.org/
- Download LTS version
- Restart computer after installation

### "MySQL connection error"
- Open `.env` file in `database-server` folder
- Check `DB_PASSWORD` matches your MySQL password
- Make sure MySQL is running (check Task Manager)

### "Port 3001 already in use"
- Another program is using port 3001
- Change `PORT=3001` to `PORT=3002` in `.env`
- Update clients with new port number

### "Cannot connect from client"
- Check Windows Firewall (allow port 3001)
- Verify server computer IP is 192.168.1.6
- Make sure server window is still open and running

---

## ✅ Quick Checklist

**On Server (192.168.1.6):**
- ☐ MySQL installed and running
- ☐ Database created (database.sql executed)
- ☐ .env file configured with password
- ☐ START_DATABASE_SERVER.bat is running (window open)

**On Clients:**
- ☐ Network settings configured (192.168.1.6:3001)
- ☐ Connection test successful
- ☐ Network mode enabled

---

## 🎯 Daily Usage

**Server Computer:**
1. Double-click `START_DATABASE_SERVER.bat`
2. Keep window open all day
3. Close window at end of day

**Client Computers:**
1. Just start POS application normally
2. Everything syncs automatically

**That's it! No commands needed!** 🚀
