import dbAPI from './dbAPI.js';

const QUEUE_KEY = 'pos_sync_queue';

const loadQueue = () => {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const saveQueue = (queue) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const pushOperation = (op) => {
  // op: { type: 'createProduct'|'updateProduct'|'deleteProduct'|..., payload }
  const queue = loadQueue();
  queue.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2,8), op });
  saveQueue(queue);
  return queue.length;
};

export const getQueue = () => loadQueue();
export const clearQueue = () => saveQueue([]);

export const processQueue = async () => {
  const queue = loadQueue();
  if (!queue.length) return { success: true, processed: 0 };
  let processed = 0;
  for (const item of queue.slice()) {
    const { op } = item;
    try {
      switch (op.type) {
        case 'createProduct':
          await dbAPI.createProduct(op.payload);
          break;
        case 'updateProduct':
          await dbAPI.updateProduct(op.payload.id, op.payload);
          break;
        case 'deleteProduct':
          await dbAPI.deleteProduct(op.payload.id);
          break;
        case 'createInvoice':
          await dbAPI.createInvoice(op.payload);
          break;
        case 'deleteInvoice':
          await dbAPI.deleteInvoice(op.payload.id);
          break;
        case 'createSupplierInvoice':
          await dbAPI.createSupplierInvoice(op.payload);
          break;
        case 'createEmployee':
          await dbAPI.createEmployee(op.payload);
          break;
        case 'updateEmployee':
          await dbAPI.updateEmployee(op.payload.id, op.payload);
          break;
        case 'deleteEmployee':
          await dbAPI.deleteEmployee(op.payload.id);
          break;
        default:
          console.warn('Unknown sync op type:', op.type);
      }

      // If succeeded, remove from queue
      const newQueue = loadQueue().filter(q => q.id !== item.id);
      saveQueue(newQueue);
      processed++;
    } catch (error) {
      console.error('Failed to process sync op', item, error);
      // stop processing further to avoid repeated errors; caller can retry later
      return { success: false, processed };
    }
  }
  return { success: true, processed };
};

export default {
  pushOperation,
  getQueue,
  clearQueue,
  processQueue
};