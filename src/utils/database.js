// Database API for React components
// This file provides easy-to-use functions for database operations
// Supports both local (SQLite via IPC) and network (HTTP API) modes

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };
import dbAPI from './dbAPI.js';
import realtimeSync from './realtimeSync.js';
import syncQueue from './syncQueue.js';

// Initialize dbAPI with saved server URL if in network mode
// If this machine is configured as the server, ensure a sensible default URL exists
const initializeDatabaseAPI = () => {
  const savedMode = localStorage.getItem('db_mode');
  let savedURL = localStorage.getItem('db_server_url');
  const isServer = localStorage.getItem('is_server') === 'true';

  if (isServer && (!savedURL || savedURL.trim() === '')) {
    savedURL = 'http://localhost:3001';
    localStorage.setItem('db_server_url', savedURL);
  }

  if (savedMode === 'network' && savedURL && savedURL.trim() !== '' && savedURL !== 'http://localhost:3001') {
    dbAPI.setServerURL(savedURL);
    console.log('🌐 Database API initialized for network mode:', savedURL);
  } else if (isServer && savedURL) {
    // Server machine with a URL — preconfigure API to localhost so we can auto-connect when server starts
    dbAPI.setServerURL(savedURL);
    console.log('🌐 Database API initialized for server machine (preconfigured):', savedURL);
  } else {
    console.log('💻 Database API initialized for local mode');
  }
};

// Initialize on module load
if (typeof window !== 'undefined') {
  initializeDatabaseAPI();
}

// Helper function to check if we're in network mode (dynamic check)
const isNetworkMode = async () => {
  const mode = localStorage.getItem('db_mode');
  let serverURL = localStorage.getItem('db_server_url');
  const isServer = localStorage.getItem('is_server') === 'true';

  // If this machine is configured as the server, check whether the server process is running.
  // If the server process is running, prefer the server API (network mode). Otherwise, use local DB.
  if (isServer) {
    try {
      if (ipcRenderer) {
        const status = await ipcRenderer.invoke('get-database-server-status');
        if (status && status.running) {
          // Ensure serverURL is set to localhost if missing
          if (!serverURL || serverURL.trim() === '') {
            serverURL = 'http://localhost:3001';
            localStorage.setItem('db_server_url', serverURL);
          }
          dbAPI.setServerURL(serverURL);
          return true;
        }
      }
    } catch (e) {
      console.warn('Error checking local server status, falling back to local DB:', e.message);
      return false;
    }
  }

  if (mode !== 'network' || !serverURL || serverURL.trim() === '' || serverURL === 'http://localhost:3001') {
    if (mode === 'network') {
      console.warn('🌐 Network mode selected but no valid server URL configured. Falling back to local mode.');
    }
    return false;
  }

  // If websocket sync is connected, prefer network DB
  try {
    if (realtimeSync && realtimeSync.isConnected && realtimeSync.isConnected()) {
      return true;
    }

    // Fallback: ping the HTTP API health endpoint
    const health = await dbAPI.checkHealth();
    return health && health.status && health.status.toUpperCase() === 'OK';
  } catch (error) {
    console.warn('🌐 Network check failed, using local DB:', error.message);
    return false;
  }
};

// Helper function to handle API responses consistently
const handleResponse = (response, fallback = null) => {
  if (response && response.success !== undefined) {
    return response;
  }
  // Network API returns data directly, wrap it in success format
  return { success: true, data: response };
};

// Helper function to handle API errors consistently
const handleError = (error) => {
  console.error('Database operation failed:', error);
  return { success: false, error: error.message };
};

// ============= PRODUCTS =============

export const getAllProducts = async () => {
  try {
    if (await isNetworkMode()) {
      try {
        const data = await dbAPI.getProducts();
        return handleResponse(data);
      } catch (networkError) {
        console.warn('🌐 getAllProducts network call failed, falling back to local DB:', networkError.message);
        // Fallback to local DB when network call fails
        if (!ipcRenderer) return { success: false, error: networkError.message };
        return await ipcRenderer.invoke('db:getAllProducts');
      }
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getAllProducts');
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getProductById = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getProduct(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getProductById', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getProductByBarcode = async (barcode) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getProductByBarcode(barcode);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getProductByBarcode', barcode);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createProduct = async (product) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.createProduct(product);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:createProduct', product);
      // Queue for sync when back online
      try { if (localRes && localRes.id) syncQueue.pushOperation({ type: 'createProduct', payload: localRes }); } catch(e){ console.warn('Failed to queue createProduct', e); }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateProduct = async (id, product) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.updateProduct(id, product);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const res = await ipcRenderer.invoke('db:updateProduct', id, product);
      try { syncQueue.pushOperation({ type: 'updateProduct', payload: { id, ...product } }); } catch(e) { console.warn('Failed to queue updateProduct', e); }
      return res;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteProduct = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.deleteProduct(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const res = await ipcRenderer.invoke('db:deleteProduct', id);
      try { syncQueue.pushOperation({ type: 'deleteProduct', payload: { id } }); } catch(e) { console.warn('Failed to queue deleteProduct', e); }
      return res;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getProductLocations = async (productId) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getProductLocations(productId);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getProductLocations', productId);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getLocationTransfers = async (productId) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getLocationTransfers(productId);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getLocationTransfers', productId);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteLocationTransfer = async (transferId) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.deleteLocationTransfer(transferId);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:deleteLocationTransfer', transferId);
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= LOCATIONS =============

export const getAllLocations = async () => {
  try {
    if (await isNetworkMode()) {
      try {
        const data = await dbAPI.getLocations();
        return handleResponse(data);
      } catch (networkError) {
        console.warn('🌐 getAllLocations network call failed, falling back to local DB:', networkError.message);
        if (!ipcRenderer) return { success: false, error: networkError.message };
        return await ipcRenderer.invoke('db:getAllLocations');
      }
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getAllLocations');
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= INVOICES =============

export const getAllInvoices = async () => {
  try {
    // Helper: parse invoice items which may be stored as arrays or JSON strings
    const parseInvoiceItems = (items) => {
      if (Array.isArray(items)) return items;
      if (typeof items === 'string' && items.trim() !== '') {
        try {
          const parsed = JSON.parse(items);
          if (Array.isArray(parsed)) return parsed;
          if (parsed && typeof parsed === 'object') return Object.values(parsed);
        } catch (e) {
          console.warn('Failed to parse invoice items JSON:', e);
        }
      }
      return [];
    };

    if (await isNetworkMode()) {
      const data = await dbAPI.getInvoices();
      // Normalize invoices: ensure items is always an array (and try parsing JSON strings)
      if (Array.isArray(data)) {
        // Normalize and ensure items are populated. The server list endpoint doesn't include items;
        // for invoices without items we'll fetch the invoice details in parallel.
        const normalized = data.map(inv => ({ ...inv, items: Array.isArray(inv.items) ? inv.items : parseInvoiceItems(inv.items) }));
        // Find invoices missing items and fetch details
        const missingIds = normalized.filter(inv => !inv.items || inv.items.length === 0).map(inv => inv.id);
        if (missingIds.length > 0) {
          try {
            const fetched = await Promise.all(missingIds.map(async id => {
              try {
                const full = await dbAPI.getInvoice(id);
                if (full && Array.isArray(full.items)) return { id, items: full.items.map(it => ({ ...it, quantityType: it.quantityType || 'unit' })) };
              } catch (e) {
                console.warn('Failed to fetch invoice details for id', id, e.message);
              }
              return { id, items: [] };
            }));
            // Merge fetched items into normalized list
            const fetchedMap = new Map(fetched.map(f => [f.id, f.items]));
            normalized.forEach(inv => {
              if ((!inv.items || inv.items.length === 0) && fetchedMap.has(inv.id)) {
                inv.items = fetchedMap.get(inv.id) || [];
              }
              if (!inv.items) inv.items = [];
            });
          } catch (e) {
            console.warn('Error fetching missing invoice details:', e.message);
          }
        }
        return handleResponse(normalized);
      }
      if (data && Array.isArray(data.data)) {
        const normalizedData = data.data.map(inv => ({ ...inv, items: Array.isArray(inv.items) ? inv.items : parseInvoiceItems(inv.items) }));
        // same merge for paginated response
        const missingIds = normalizedData.filter(inv => !inv.items || inv.items.length === 0).map(inv => inv.id);
        if (missingIds.length > 0) {
          try {
            const fetched = await Promise.all(missingIds.map(async id => {
              try {
                const full = await dbAPI.getInvoice(id);
                if (full && Array.isArray(full.items)) return { id, items: full.items.map(it => ({ ...it, quantityType: it.quantityType || 'unit' })) };
              } catch (e) {
                console.warn('Failed to fetch invoice details for id', id, e.message);
              }
              return { id, items: [] };
            }));
            const fetchedMap = new Map(fetched.map(f => [f.id, f.items]));
            normalizedData.forEach(inv => {
              if ((!inv.items || inv.items.length === 0) && fetchedMap.has(inv.id)) {
                inv.items = fetchedMap.get(inv.id) || [];
              }
              if (!inv.items) inv.items = [];
            });
          } catch (e) {
            console.warn('Error fetching missing invoice details:', e.message);
          }
        }
        return handleResponse({ ...data, data: normalizedData });
      }
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:getAllInvoices');
      // Normalize local results as well (parse items JSON if needed)
      if (Array.isArray(localRes)) {
        return localRes.map(inv => ({ ...inv, items: parseInvoiceItems(inv.items) }));
      }
      if (localRes && Array.isArray(localRes.data)) {
        return { ...localRes, data: localRes.data.map(inv => ({ ...inv, items: parseInvoiceItems(inv.items) })) };
      }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= CLIENTS (CUSTOMERS) =============

export const getAllClients = async () => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getClients();
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getAllClients');
    }
  } catch (error) {
    return handleError(error);
  }
};

export const searchClients = async (term) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.searchClients(term);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:searchClients', term);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createClient = async (client) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.createClient(client);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:createClient', client);
      try { if (localRes && localRes.id) syncQueue.pushOperation({ type: 'createClient', payload: localRes }); } catch(e){ console.warn('Failed to queue createClient', e); }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateClient = async (id, client) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.updateClient(id, client);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:updateClient', id, client);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getInvoiceById = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getInvoice(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getInvoiceById', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createInvoice = async (invoice) => {
  // Normalize date-only values (YYYY-MM-DD) to full ISO timestamps including current time.
  // This prevents storing date-only strings that parse as UTC midnight and display as 01:00 AM in some timezones.
  const normalizeInvoiceDate = (inv) => {
    if (!inv || !inv.date) return inv;
    const d = inv.date;
    // If the date is YYYY-MM-DD (no time), append current local time and convert to ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const localDateTime = `${d}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      return { ...inv, date: new Date(localDateTime).toISOString() };
    }
    return inv;
  };

  const normalizedInvoice = normalizeInvoiceDate(invoice);

  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.createInvoice(normalizedInvoice);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:createInvoice', normalizedInvoice);
      try { if (localRes && localRes.id) syncQueue.pushOperation({ type: 'createInvoice', payload: localRes }); } catch(e){ console.warn('Failed to queue createInvoice', e); }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateInvoice = async (id, updates) => {
  try {
    if (await isNetworkMode()) {
      // Network API might not have updateInvoice, use createInvoice for now
      // This might need to be implemented in the server
      console.warn('updateInvoice not implemented for network mode');
      return { success: false, error: 'Update invoice not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:updateInvoice', id, updates);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteInvoice = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.deleteInvoice(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const res = await ipcRenderer.invoke('db:deleteInvoice', id);
      try { syncQueue.pushOperation({ type: 'deleteInvoice', payload: { id } }); } catch(e) { console.warn('Failed to queue deleteInvoice', e); }
      return res;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const clearAllInvoices = async () => {
  try {
    if (await isNetworkMode()) {
      // Call server endpoint to clear all invoices
      try {
        const data = await dbAPI.clearAllInvoices();
        return handleResponse(data);
      } catch (e) {
        console.warn('clearAllInvoices network call failed:', e.message);
        return { success: false, error: e.message };
      }
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:clearAllInvoices');
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= SUPPLIER INVOICES =============

export const getAllSupplierInvoices = async () => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getSupplierInvoices();
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getAllSupplierInvoices');
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getSupplierInvoiceById = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getSupplierInvoice(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getSupplierInvoiceById', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createSupplierInvoice = async (invoice) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.createSupplierInvoice(invoice);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:createSupplierInvoice', invoice);
      try { if (localRes && localRes.id) syncQueue.pushOperation({ type: 'createSupplierInvoice', payload: localRes }); } catch(e){ console.warn('Failed to queue createSupplierInvoice', e); }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateSupplierInvoice = async (id, updates) => {
  try {
    if (await isNetworkMode()) {
      // Network API might not have updateSupplierInvoice
      console.warn('updateSupplierInvoice not implemented for network mode');
      return { success: false, error: 'Update supplier invoice not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:updateSupplierInvoice', id, updates);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteSupplierInvoice = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.deleteSupplierInvoice(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:deleteSupplierInvoice', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= EMPLOYEES =============

export const getAllEmployees = async () => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.getEmployees();
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getAllEmployees');
    }
  } catch (error) {
    return handleError(error);
  }
};

export const getEmployeeById = async (id) => {
  try {
    if (await isNetworkMode()) {
      // Network API might not have getEmployeeById, get all and filter
      const employees = await dbAPI.getEmployees();
      const employee = employees.find(emp => emp.id === id);
      return handleResponse(employee || null);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getEmployeeById', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createEmployee = async (employee) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.createEmployee(employee);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const localRes = await ipcRenderer.invoke('db:createEmployee', employee);
      try { if (localRes && localRes.id) syncQueue.pushOperation({ type: 'createEmployee', payload: localRes }); } catch(e){ console.warn('Failed to queue createEmployee', e); }
      return localRes;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateEmployee = async (id, employee) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.updateEmployee(id, employee);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const res = await ipcRenderer.invoke('db:updateEmployee', id, employee);
      try { syncQueue.pushOperation({ type: 'updateEmployee', payload: { id, ...employee } }); } catch(e) { console.warn('Failed to queue updateEmployee', e); }
      return res;
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteEmployee = async (id) => {
  try {
    if (await isNetworkMode()) {
      const data = await dbAPI.deleteEmployee(id);
      return handleResponse(data);
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      const res = await ipcRenderer.invoke('db:deleteEmployee', id);
      try { syncQueue.pushOperation({ type: 'deleteEmployee', payload: { id } }); } catch(e) { console.warn('Failed to queue deleteEmployee', e); }
      return res;
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= EMPLOYEE LEAVE =============

export const getEmployeeLeave = async (employeeId) => {
  try {
    if (await isNetworkMode()) {
      // Network API might not have leave functions yet
      console.warn('Employee leave functions not implemented for network mode');
      return { success: false, error: 'Employee leave not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getEmployeeLeave', employeeId);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createLeave = async (leave) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee leave functions not implemented for network mode');
      return { success: false, error: 'Employee leave not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:createLeave', leave);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateLeave = async (id, leave) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee leave functions not implemented for network mode');
      return { success: false, error: 'Employee leave not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:updateLeave', id, leave);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteLeave = async (id) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee leave functions not implemented for network mode');
      return { success: false, error: 'Employee leave not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:deleteLeave', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const calculateAccruedLeave = async (startDate, leavePerMonth = 2) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee leave functions not implemented for network mode');
      return { success: false, error: 'Employee leave not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:calculateAccruedLeave', startDate, leavePerMonth);
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= EMPLOYEE BONUSES =============

export const getEmployeeBonuses = async (employeeId) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee bonus functions not implemented for network mode');
      return { success: false, error: 'Employee bonus not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:getEmployeeBonuses', employeeId);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const createBonus = async (bonus) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee bonus functions not implemented for network mode');
      return { success: false, error: 'Employee bonus not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:createBonus', bonus);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const updateBonus = async (id, bonus) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee bonus functions not implemented for network mode');
      return { success: false, error: 'Employee bonus not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:updateBonus', id, bonus);
    }
  } catch (error) {
    return handleError(error);
  }
};

export const deleteBonus = async (id) => {
  try {
    if (await isNetworkMode()) {
      console.warn('Employee bonus functions not implemented for network mode');
      return { success: false, error: 'Employee bonus not supported in network mode' };
    } else {
      if (!ipcRenderer) return { success: false, error: 'IPC not available' };
      return await ipcRenderer.invoke('db:deleteBonus', id);
    }
  } catch (error) {
    return handleError(error);
  }
};

// ============= SETTINGS =============

export const getSetting = async (key) => {
  // Settings are always local to each machine
  if (!ipcRenderer) return { success: false, error: 'IPC not available' };
  return await ipcRenderer.invoke('db:getSetting', key);
};

export const setSetting = async (key, value) => {
  // Settings are always local to each machine
  if (!ipcRenderer) return { success: false, error: 'IPC not available' };
  return await ipcRenderer.invoke('db:setSetting', key, value);
};

export const getAllSettings = async () => {
  // Settings are always local to each machine
  if (!ipcRenderer) return { success: false, error: 'IPC not available' };
  return await ipcRenderer.invoke('db:getAllSettings');
};

// ============= UTILITY FUNCTIONS =============

// Migrate data from localStorage to database
export const migrateFromLocalStorage = async () => {
  // Migration should only happen in local mode
  if (await isNetworkMode()) {
    return { success: false, error: 'Migration not allowed in network mode' };
  }
  
  if (!ipcRenderer) return { success: false, error: 'IPC not available' };
  
  try {
    // Migrate products
    const products = JSON.parse(localStorage.getItem('products') || '[]');
    for (const product of products) {
      await createProduct(product);
    }
    
    // Migrate invoices
    const invoices = JSON.parse(localStorage.getItem('invoiceHistory') || '[]');
    for (const invoice of invoices) {
      await createInvoice(invoice);
    }
    
    // Migrate supplier invoices
    const supplierInvoices = JSON.parse(localStorage.getItem('supplierInvoices') || '[]');
    for (const invoice of supplierInvoices) {
      await createSupplierInvoice(invoice);
    }
    
    // Migrate employees
    const employees = JSON.parse(localStorage.getItem('employees') || '[]');
    for (const employee of employees) {
      await createEmployee(employee);
    }
    
    console.log('✅ Migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
};
