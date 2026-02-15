import dbAPI from './dbAPI.js';
import realtimeSync from './realtimeSync.js';
import syncQueue from './syncQueue.js';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

let handlersRegistered = false;

const buildSnapshot = async () => {
  // Fetch all resources from the server; use Promise.allSettled to be resilient to partial failures
  const promises = await Promise.allSettled([
    dbAPI.getProducts(),
    dbAPI.getLocations(),
    dbAPI.getInvoices(),
    dbAPI.getSupplierInvoices(),
    dbAPI.getEmployees()
  ]);

  const safe = (idx) => (promises[idx] && promises[idx].status === 'fulfilled') ? promises[idx].value : [];

  return {
    products: safe(0) || [],
    locations: safe(1) || [],
    invoices: safe(2) || [],
    supplierInvoices: safe(3) || [],
    employees: safe(4) || []
  };
};

const applyRealtimeHandlers = () => {
  if (handlersRegistered) return;

  realtimeSync.on('product:created', async (product) => {
    try {
      if (!ipcRenderer) return;
      await ipcRenderer.invoke('db:createProduct', product);
      console.log('Local DB: product created via realtime event', product.id);
    } catch (e) { console.error(e); }
  });

  realtimeSync.on('product:updated', async (product) => {
    try {
      if (!ipcRenderer) return;
      await ipcRenderer.invoke('db:updateProduct', product.id, product);
      console.log('Local DB: product updated via realtime event', product.id);
    } catch (e) { console.error(e); }
  });

  realtimeSync.on('product:deleted', async ({ id }) => {
    try {
      if (!ipcRenderer) return;
      await ipcRenderer.invoke('db:deleteProduct', id);
      console.log('Local DB: product deleted via realtime event', id);
    } catch (e) { console.error(e); }
  });

  realtimeSync.on('invoice:created', async (invoice) => {
    try { if (!ipcRenderer) return; await ipcRenderer.invoke('db:createInvoice', invoice); } catch (e) { console.error(e); }
  });
  realtimeSync.on('invoice:deleted', async ({ id }) => { try { if (!ipcRenderer) return; await ipcRenderer.invoke('db:deleteInvoice', id); } catch (e) { console.error(e); } });

  realtimeSync.on('employee:created', async (emp) => { try { if (!ipcRenderer) return; await ipcRenderer.invoke('db:createEmployee', emp); } catch(e){console.error(e);} });
  realtimeSync.on('employee:updated', async (emp) => { try { if (!ipcRenderer) return; await ipcRenderer.invoke('db:updateEmployee', emp.id, emp); } catch(e){console.error(e);} });
  realtimeSync.on('employee:deleted', async ({ id }) => { try { if (!ipcRenderer) return; await ipcRenderer.invoke('db:deleteEmployee', id); } catch(e){console.error(e);} });

  handlersRegistered = true;
};

const removeRealtimeHandlers = () => {
  // No-op for now; realtimeSync.off not implemented for all events in manager.
  handlersRegistered = false;
};

export const startSync = async (serverURL) => {
  try {
    if (!serverURL) serverURL = localStorage.getItem('db_server_url') || 'http://localhost:3001';

    // Try to set the URL (dbAPI will refuse link-local addresses)
    const setOk = dbAPI.setServerURL(serverURL);
    if (!setOk) {
      console.warn('startSync aborted: invalid server URL provided', serverURL);
      localStorage.setItem('db_mode', 'local');
      return { success: false, error: 'invalid-server-url' };
    }

    // Quick reachability probe before attempting heavy sync work
    const reachable = await dbAPI.isReachable(3000);
    if (!reachable) {
      console.warn('Server not reachable at', dbAPI.baseURL, '- falling back to local mode');
      localStorage.setItem('db_mode', 'local');
      try { realtimeSync.disconnect(); } catch(e){}
      return { success: false, error: 'server-unreachable' };
    }

    // Connect to realtime socket
    try { realtimeSync.connect(serverURL); } catch(e){ console.warn('realtime connect failed', e); }

    // Wait for connection (if possible) then process queue and import snapshot
    // First, try processing queued operations
    const qres = await syncQueue.processQueue();
    console.log('Sync queue processed:', qres);

    // Build snapshot from server and import into local DB
    let snapshot = { products: [], locations: [], invoices: [], supplierInvoices: [], employees: [] };
    try {
      snapshot = await buildSnapshot();
    } catch (e) {
      console.error('Failed to build snapshot from server, continuing with empty snapshot:', e.message);
    }

    if (ipcRenderer) {
      try {
        const res = await ipcRenderer.invoke('db:importSnapshot', snapshot);
        console.log('Snapshot import result', res);
      } catch (e) {
        console.error('Import snapshot failed:', e);
      }
    }

    // Register realtime handlers so local DB stays in sync for offline fallback
    applyRealtimeHandlers();

    // Mark mode
    localStorage.setItem('db_mode', 'network');

    return { success: true };
  } catch (error) {
    console.error('startSync error:', error);
    return { success: false, error: error.message };
  }
};

export const stopSync = async () => {
  try {
    removeRealtimeHandlers();
    // Mark mode to local
    localStorage.setItem('db_mode', 'local');
    try { realtimeSync.disconnect(); } catch(e){}
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Auto-init: when realtimeSync connects, start sync; when disconnect, stop sync
try {
  realtimeSync.on('connected', async () => {
    console.log('realtimeSync connected - starting sync');
    await startSync();
  });
  realtimeSync.on('disconnected', async () => {
    console.log('realtimeSync disconnected - stopping sync');
    await stopSync();
  });

  // If realtimeSync signals persistent connection failure, fallback to local mode
  realtimeSync.on('connection-failed', async () => {
    console.warn('realtimeSync: connection-failed received - switching to local mode');
    localStorage.setItem('db_mode', 'local');
    try { realtimeSync.disconnect(); } catch (e) {}
  });
} catch (e) {
  console.warn('syncManager auto-init failed', e);
}

// On module load: if user previously set network mode or enabled realtime sync, attempt to start sync automatically
(async () => {
  try {
    const mode = typeof localStorage !== 'undefined' ? localStorage.getItem('db_mode') : null;
    const url = typeof localStorage !== 'undefined' ? localStorage.getItem('db_server_url') : null;
    const realtimeEnabled = typeof localStorage !== 'undefined' ? localStorage.getItem('realtime_sync') === 'true' : false;

    if ((mode === 'network' || realtimeEnabled) && url) {
      console.log('syncManager auto-start: detected network/realtime preference, probing server reachability for', url);

      // set the URL in dbAPI (will ignore link-local addresses)
      const setOk = dbAPI.setServerURL(url);
      if (!setOk) {
        console.warn('auto-start aborted: invalid server URL:', url);
        localStorage.setItem('db_mode', 'local');
        return;
      }

      const reachable = await dbAPI.isReachable(3000);
      if (reachable) {
        await startSync(url);
      } else {
        console.warn('auto-start aborted: server not reachable at', url, '- staying in local mode');
        localStorage.setItem('db_mode', 'local');
      }
    }
  } catch (e) {
    console.warn('syncManager auto-start initial check failed', e);
  }
})();

export default { startSync, stopSync };