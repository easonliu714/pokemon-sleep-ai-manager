const IDB_NAME = "pokemon_sleep_ai_manager";
const IDB_VERSION = 2;
const DB_STORE = "database";
const SNAPSHOT_STORE = "snapshots";
const META_STORE = "metadata";
const DB_KEY = "primary";
const META_KEY = "primary";

let connectionPromise = null;

function startup(stage,message,status='running',details={}){
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function'){
    globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details}}));
  }
}

function openIdb(){
  if(connectionPromise)return connectionPromise;
  connectionPromise=new Promise((resolve,reject)=>{
    startup('INDEXEDDB_OPENING','正在開啟本機儲存空間');
    const req=indexedDB.open(IDB_NAME,IDB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE);
      if(!db.objectStoreNames.contains(SNAPSHOT_STORE))db.createObjectStore(SNAPSHOT_STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE);
    };
    req.onblocked=()=>{
      startup('INDEXEDDB_BLOCKED','本機儲存空間被其他分頁占用','warning');
      reject(new Error('indexeddb_blocked'));
      connectionPromise=null;
    };
    req.onsuccess=()=>{
      const db=req.result;
      db.onversionchange=()=>{db.close();connectionPromise=null;};
      startup('INDEXEDDB_READY','本機儲存空間已開啟');
      resolve(db);
    };
    req.onerror=()=>{connectionPromise=null;reject(req.error||new Error('indexeddb_open_failed'));};
  });
  return connectionPromise;
}

async function request(store,mode,action){
  const db=await openIdb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);
    const objectStore=tx.objectStore(store);
    let req;
    try{req=action(objectStore,tx);}catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(req?.result);
    tx.onerror=()=>reject(tx.error||req?.error||new Error('indexeddb_transaction_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_transaction_aborted'));
  });
}

export async function inspectDatabaseRecord(){
  const db=await openIdb();
  const stores=[DB_STORE,META_STORE].filter(name=>db.objectStoreNames.contains(name));
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,'readonly');
    const dbStore=tx.objectStore(DB_STORE);
    const keyReq=dbStore.getKey(DB_KEY);
    let metaReq=null;
    if(db.objectStoreNames.contains(META_STORE))metaReq=tx.objectStore(META_STORE).get(META_KEY);
    tx.oncomplete=()=>resolve({exists:keyReq.result!==undefined,metadata:metaReq?.result||null});
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_metadata_read_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_metadata_read_aborted'));
  });
}

export async function loadDatabaseBytes(){
  startup('SQLITE_BYTES_READING','正在讀取本機 SQLite');
  const value=await request(DB_STORE,'readonly',store=>store.get(DB_KEY));
  startup('SQLITE_BYTES_READY','本機 SQLite 讀取完成','running',{byte_length:value?.byteLength||0});
  return value||null;
}

export async function saveDatabaseBytes(bytes){
  const buffer=bytes instanceof Uint8Array?bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):bytes;
  const metadata={byte_length:buffer?.byteLength||0,updated_at:new Date().toISOString(),format:'sqlite-arraybuffer',safe_boot_version:1};
  const db=await openIdb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([DB_STORE,META_STORE],'readwrite');
    tx.objectStore(DB_STORE).put(buffer,DB_KEY);
    tx.objectStore(META_STORE).put(metadata,META_KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_save_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_save_aborted'));
  });
  return metadata;
}

export async function createSnapshot(bytes,reason){
  const id=`SNAP-${new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${Math.random().toString(16).slice(2,6)}`;
  const buffer=bytes instanceof Uint8Array?bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):bytes;
  const item={id,created_at:new Date().toISOString(),reason,bytes:buffer};
  await request(SNAPSHOT_STORE,'readwrite',store=>store.put(item));
  await pruneSnapshots(10);
  return id;
}

export async function listSnapshots(){
  const result=await request(SNAPSHOT_STORE,'readonly',store=>store.getAll());
  return (result||[]).sort((a,b)=>b.created_at.localeCompare(a.created_at));
}

async function pruneSnapshots(max){
  const items=await listSnapshots();
  const remove=items.slice(max);
  if(!remove.length)return;
  const db=await openIdb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(SNAPSHOT_STORE,'readwrite');
    const store=tx.objectStore(SNAPSHOT_STORE);
    remove.forEach(item=>store.delete(item.id));
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('snapshot_prune_failed'));
  });
}

export async function clearAllStorage(){
  const db=await openIdb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([DB_STORE,SNAPSHOT_STORE,META_STORE],'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.objectStore(SNAPSHOT_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_clear_failed'));
  });
}

export function closeStorageConnection(){
  Promise.resolve(connectionPromise).then(db=>db?.close?.()).catch(()=>{});
  connectionPromise=null;
}
