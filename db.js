const DB_NAME = 'mapaflex-db';
const DB_VERSION = 3;
let dbPromise;

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Transação cancelada'));
    tx.onerror = () => reject(tx.error || new Error('Erro no IndexedDB'));
  });
}

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      let maps;
      if (!db.objectStoreNames.contains('maps')) maps = db.createObjectStore('maps', { keyPath: 'id' });
      else maps = req.transaction.objectStore('maps');
      if (!maps.indexNames.contains('updatedAt')) maps.createIndex('updatedAt', 'updatedAt');

      let attachments;
      if (!db.objectStoreNames.contains('attachments')) attachments = db.createObjectStore('attachments', { keyPath: 'id' });
      else attachments = req.transaction.objectStore('attachments');
      if (!attachments.indexNames.contains('mapId')) attachments.createIndex('mapId', 'mapId');
      if (!attachments.indexNames.contains('nodeId')) attachments.createIndex('nodeId', 'nodeId');
      if (!attachments.indexNames.contains('mapNode')) attachments.createIndex('mapNode', ['mapId', 'nodeId']);

      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function listMaps() {
  const db = await openDatabase();
  const tx = db.transaction('maps', 'readonly');
  const rows = await request(tx.objectStore('maps').getAll());
  return rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getMap(id) {
  const db = await openDatabase();
  const tx = db.transaction('maps', 'readonly');
  return request(tx.objectStore('maps').get(id));
}

export async function putMap(map) {
  const db = await openDatabase();
  const tx = db.transaction('maps', 'readwrite');
  tx.objectStore('maps').put(map);
  await txDone(tx);
  return map;
}

export async function deleteMap(id) {
  const db = await openDatabase();
  const tx = db.transaction(['maps', 'attachments'], 'readwrite');
  tx.objectStore('maps').delete(id);
  const idx = tx.objectStore('attachments').index('mapId');
  const range = IDBKeyRange.only(id);
  const cursorReq = idx.openCursor(range);
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await txDone(tx);
}

export async function putAttachment(item) {
  const db = await openDatabase();
  const tx = db.transaction('attachments', 'readwrite');
  tx.objectStore('attachments').put(item);
  await txDone(tx);
  return item;
}

export async function getAttachments(mapId, nodeId = null) {
  const db = await openDatabase();
  const tx = db.transaction('attachments', 'readonly');
  const store = tx.objectStore('attachments');
  if (nodeId) return request(store.index('mapNode').getAll(IDBKeyRange.only([mapId, nodeId])));
  return request(store.index('mapId').getAll(IDBKeyRange.only(mapId)));
}

export async function getAttachment(id) {
  const db = await openDatabase();
  const tx = db.transaction('attachments', 'readonly');
  return request(tx.objectStore('attachments').get(id));
}

export async function deleteAttachment(id) {
  const db = await openDatabase();
  const tx = db.transaction('attachments', 'readwrite');
  tx.objectStore('attachments').delete(id);
  await txDone(tx);
}

export async function deleteNodeAttachments(mapId, nodeId) {
  const db = await openDatabase();
  const tx = db.transaction('attachments', 'readwrite');
  const req = tx.objectStore('attachments').index('mapNode').openCursor(IDBKeyRange.only([mapId, nodeId]));
  req.onsuccess = () => {
    const cursor = req.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  await txDone(tx);
}

export async function setSetting(key, value) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value, updatedAt: Date.now() });
  await txDone(tx);
}

export async function getSetting(key, fallback = null) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readonly');
  const row = await request(tx.objectStore('settings').get(key));
  return row ? row.value : fallback;
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  return navigator.storage.estimate();
}
