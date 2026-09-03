const IDB_NAME = "pokemon_sleep_ai_manager";
const DB_STORE = "database";
const SNAPSHOT_STORE = "snapshots";
const LEGACY_SNAPSHOT_META_STORE = "snapshot_metadata";
const META_STORE = "metadata";
const DB_KEY = "primary";
const META_KEY = "primary";
const SNAPSHOT_META_PREFIX = "snapshot:";

let connectionPromise = null;
let connectionGeneration = 0;
let sqliteLoadWorker = null;
let sqliteLoadWorkerGeneration = 0;
let snapshotMetadataCache = null;
let snapshotMetadataLoadPromise = null;

function startup(stage,message,status='running',details={}){
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function'){
    globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details}}));
  }
}
const perfNow=()=>globalThis.performance?.now?.()??Date.now();
const roundedMs=started=>Math.round((perfNow()-started)*10)/10;
const snapshotMetaKey=id=>`${SNAPSHOT_META_PREFIX}${String(id)}`;

function ensureFreshStores(db){
  if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE);
  if(!db.objectStoreNames.contains(SNAPSHOT_STORE))db.createObjectStore(SNAPSHOT_STORE,{keyPath:'id'});
  if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE);
}

function openIdb(){
  if(connectionPromise)return connectionPromise;
  const generation=++connectionGeneration;
  let localPromise=null;
  localPromise=new Promise((resolve,reject)=>{
    startup('INDEXEDDB_OPENING','正在開啟本機儲存空間','running',{version_neutral:true,generation});
    const req=indexedDB.open(IDB_NAME);
    let settled=false;
    const fail=error=>{if(settled)return;settled=true;if(generation===connectionGeneration&&connectionPromise===localPromise)connectionPromise=null;reject(error);};
    req.onupgradeneeded=()=>ensureFreshStores(req.result);
    req.onblocked=()=>{startup('INDEXEDDB_BLOCKED','本機儲存空間暫時被其他分頁占用','warning',{version_neutral:true,generation});fail(Object.assign(new Error('indexeddb_blocked'),{code:'indexeddb_blocked',retryable:true}));};
    req.onsuccess=()=>{
      const db=req.result;
      if(generation!==connectionGeneration){try{db.close();}catch{}fail(Object.assign(new Error('indexeddb_open_superseded'),{code:'indexeddb_open_superseded',retryable:true}));return;}
      if(settled){try{db.close();}catch{}return;}
      settled=true;
      db.onversionchange=()=>{try{db.close();}catch{}if(generation===connectionGeneration){connectionGeneration+=1;connectionPromise=null;}startup('INDEXEDDB_VERSIONCHANGE','偵測到其他分頁變更本機儲存版本；已安全關閉舊連線','warning');};
      startup('INDEXEDDB_READY','本機儲存空間已開啟','running',{database_version:db.version,version_neutral:true,generation,legacy_snapshot_metadata_store_present:db.objectStoreNames.contains(LEGACY_SNAPSHOT_META_STORE)});
      resolve(db);
    };
    req.onerror=()=>fail(req.error||new Error('indexeddb_open_failed'));
  });
  connectionPromise=localPromise;
  return localPromise;
}

export function resetStorageConnection(reason='manual_reset'){
  const previous=connectionPromise;
  connectionGeneration+=1;
  connectionPromise=null;
  Promise.resolve(previous).then(db=>{try{db?.close?.();}catch{}}).catch(()=>{});
  startup('INDEXEDDB_CONNECTION_RESET','已丟棄舊的本機儲存連線嘗試','warning',{reason,generation:connectionGeneration});
  return connectionGeneration;
}

async function request(store,mode,action){
  const db=await openIdb();
  return new Promise((resolve,reject)=>{
    let tx;try{tx=db.transaction(store,mode);}catch(error){reject(error);return;}
    const objectStore=tx.objectStore(store);let req;
    try{req=action(objectStore,tx);}catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(req?.result);
    tx.onerror=()=>reject(tx.error||req?.error||new Error('indexeddb_transaction_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_transaction_aborted'));
  });
}

export async function inspectDatabaseRecord(){
  const db=await openIdb();
  const stores=[DB_STORE,META_STORE].filter(name=>db.objectStoreNames.contains(name));
  if(!stores.includes(DB_STORE))return {exists:false,metadata:null,database_version:db.version};
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,'readonly');const dbStore=tx.objectStore(DB_STORE);const keyReq=dbStore.getKey(DB_KEY);let metaReq=null;
    if(db.objectStoreNames.contains(META_STORE))metaReq=tx.objectStore(META_STORE).get(META_KEY);
    tx.oncomplete=()=>resolve({exists:keyReq.result!==undefined,metadata:metaReq?.result||null,database_version:db.version});
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_metadata_read_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_metadata_read_aborted'));
  });
}

export async function loadDatabaseBytes(){startup('SQLITE_BYTES_READING','正在讀取本機 SQLite');const value=await request(DB_STORE,'readonly',store=>store.get(DB_KEY));startup('SQLITE_BYTES_READY','本機 SQLite 讀取完成','running',{byte_length:value?.byteLength||0});return value||null;}

export function cancelWorkerDatabaseLoad(){const worker=sqliteLoadWorker;if(!worker)return false;sqliteLoadWorkerGeneration+=1;if(sqliteLoadWorker===worker)sqliteLoadWorker=null;try{worker.postMessage({type:'cancel'});}catch{}setTimeout(()=>{try{worker.terminate();}catch{}},100);startup('LEGACY_DB_LOAD_CANCELLED','已取消玩家 SQLite 載入','warning');return true;}
export function loadDatabaseBytesInWorker({maxTransferBytes=48*1024*1024,hardTimeoutMs=60000,heartbeatTimeoutMs=6000}={}){
  cancelWorkerDatabaseLoad();
  return new Promise((resolve,reject)=>{
    const generation=++sqliteLoadWorkerGeneration;const worker=new Worker(new URL('./sqlite-load-worker.js',import.meta.url));sqliteLoadWorker=worker;let settled=false;let lastHeartbeat=Date.now();
    const isCurrent=()=>sqliteLoadWorker===worker&&sqliteLoadWorkerGeneration===generation;
    const cleanup=()=>{clearInterval(watchdog);clearTimeout(hardTimer);try{worker.terminate();}catch{}if(isCurrent())sqliteLoadWorker=null;};
    const finish=(fn,value)=>{if(settled)return;settled=true;cleanup();fn(value);};
    const watchdog=setInterval(()=>{if(!isCurrent()){finish(reject,Object.assign(new Error('legacy_db_worker_superseded'),{code:'legacy_db_worker_superseded'}));return;}if(Date.now()-lastHeartbeat>heartbeatTimeoutMs){startup('LEGACY_DB_WORKER_UNRESPONSIVE','SQLite 載入 Worker 心跳中斷，已終止載入','warning');finish(reject,Object.assign(new Error('legacy_db_worker_unresponsive'),{code:'legacy_db_worker_unresponsive'}));}},1000);
    const hardTimer=setTimeout(()=>{startup('LEGACY_DB_WORKER_TIMEOUT','SQLite 載入超時，已終止 Worker','warning');finish(reject,Object.assign(new Error('legacy_db_worker_timeout'),{code:'legacy_db_worker_timeout'}));},hardTimeoutMs);watchdog?.unref?.();hardTimer?.unref?.();
    worker.onerror=event=>{if(!isCurrent())return;finish(reject,Object.assign(new Error(event.message||'legacy_db_worker_error'),{code:'legacy_db_worker_error'}));};
    worker.onmessage=event=>{if(!isCurrent())return;const message=event.data||{};if(message.type==='heartbeat'){lastHeartbeat=Date.now();startup(message.stage||'LEGACY_DB_WORKER_HEARTBEAT','玩家 SQLite Worker 運作中','running',{at:message.at,generation});return;}if(message.type==='stage'){lastHeartbeat=Date.now();const labels={LEGACY_DB_READING:'Worker 正在讀取玩家 SQLite',LEGACY_DB_BYTES_READY:'Worker 已取得玩家 SQLite 大小',LEGACY_DB_TRANSFER:'正在安全移交 SQLite'};startup(message.stage,labels[message.stage]||message.stage,'running',{...message,generation});return;}if(message.type==='too_large'){startup('LEGACY_DB_TOO_LARGE',`玩家 SQLite ${(message.byte_length/1048576).toFixed(1)} MB，超過手機安全載入門檻`,'warning',message);finish(reject,Object.assign(new Error('legacy_database_exceeds_mobile_safe_limit'),{code:'legacy_database_exceeds_mobile_safe_limit',details:message}));return;}if(message.type==='cancelled'){finish(reject,Object.assign(new Error('worker_load_cancelled'),{code:'worker_load_cancelled'}));return;}if(message.type==='error'){finish(reject,Object.assign(new Error(message.message||'worker_load_failed'),{code:message.code||'worker_load_failed'}));return;}if(message.type==='result'){startup('LEGACY_DB_TRANSFERRED','玩家 SQLite 已由 Worker 安全移交','running',{byte_length:message.byte_length,generation});finish(resolve,message.buffer);}};
    startup('LEGACY_DB_WORKER_STARTING','正在啟動玩家 SQLite 隔離載入 Worker','running',{generation});worker.postMessage({type:'load',maxTransferBytes});
  });
}

function asArrayBuffer(bytes){if(!(bytes instanceof Uint8Array))return bytes;if(bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength)return bytes.buffer;return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
export async function saveDatabaseBytes(bytes){const buffer=asArrayBuffer(bytes);const metadata={byte_length:buffer?.byteLength||0,updated_at:new Date().toISOString(),format:'sqlite-arraybuffer',safe_boot_version:2};const db=await openIdb();await new Promise((resolve,reject)=>{const tx=db.transaction([DB_STORE,META_STORE],'readwrite');tx.objectStore(DB_STORE).put(buffer,DB_KEY);tx.objectStore(META_STORE).put(metadata,META_KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('indexeddb_save_failed'));tx.onabort=()=>reject(tx.error||new Error('indexeddb_save_aborted'));});return metadata;}
function snapshotCreatedAtFromId(id){const match=String(id||'').match(/^SNAP-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/);if(!match)return null;const [,year,month,day,hour,minute,second]=match;return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;}
async function readSnapshotMetadata(db,snapshotKeys){if(!db.objectStoreNames.contains(META_STORE))return new Map();const ids=(snapshotKeys||[]).map(String);return new Promise((resolve,reject)=>{const tx=db.transaction(META_STORE,'readonly');const store=tx.objectStore(META_STORE);const byId=new Map();for(const id of ids){const req=store.get(snapshotMetaKey(id));req.onsuccess=()=>{if(req.result)byId.set(id,req.result);};}tx.oncomplete=()=>resolve(byId);tx.onerror=()=>reject(tx.error||new Error('snapshot_metadata_read_failed'));tx.onabort=()=>reject(tx.error||new Error('snapshot_metadata_read_aborted'));});}
export async function createSnapshot(bytes,reason){const createdAt=new Date().toISOString();const id=`SNAP-${createdAt.replace(/[-:.TZ]/g,'').slice(0,14)}-${Math.random().toString(16).slice(2,6)}`;const buffer=asArrayBuffer(bytes);const item={id,created_at:createdAt,reason,bytes:buffer};const metadata={id,created_at:createdAt,reason,byte_length:buffer?.byteLength||0};const db=await openIdb();const putStarted=perfNow();await new Promise((resolve,reject)=>{const tx=db.transaction([SNAPSHOT_STORE,META_STORE],'readwrite');tx.objectStore(SNAPSHOT_STORE).put(item);tx.objectStore(META_STORE).put(metadata,snapshotMetaKey(id));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('snapshot_write_failed'));tx.onabort=()=>reject(tx.error||new Error('snapshot_write_aborted'));});const putMs=roundedMs(putStarted);snapshotMetadataCache=null;const pruneStarted=perfNow();const pruneResult=await pruneSnapshots(10);const pruneMs=roundedMs(pruneStarted);startup('SQLITE_SNAPSHOT_STORAGE_COMPLETED','SQLite 快照已寫入本機儲存','completed',{id,byte_length:metadata.byte_length,idb_put_ms:putMs,prune_ms:pruneMs,pruned_count:pruneResult.removed_count,metadata_only_prune:true,snapshot_metadata_namespace:'metadata:snapshot'});return id;}
async function loadSnapshotMetadata(){
  if(snapshotMetadataLoadPromise)return snapshotMetadataLoadPromise;
  const started=perfNow();
  snapshotMetadataLoadPromise=(async()=>{
    const db=await openIdb();
    const snapshotKeys=(await request(SNAPSHOT_STORE,'readonly',store=>store.getAllKeys())||[]).map(String);
    const metadataById=await readSnapshotMetadata(db,snapshotKeys);
    const items=snapshotKeys.map(id=>{const metadata=metadataById.get(id);return metadata||{id,created_at:snapshotCreatedAtFromId(id),reason:'Legacy snapshot（metadata unavailable）',byte_length:null,legacy_metadata:true};}).sort((a,b)=>String(b.created_at||b.id).localeCompare(String(a.created_at||a.id)));
    snapshotMetadataCache=items;
    startup('SQLITE_SNAPSHOT_LIST_READY','快照清單已載入（metadata-only）','completed',{snapshot_count:items.length,elapsed_ms:roundedMs(started),snapshot_payload_bytes_materialized:false,version_neutral_idb:true,page_deferred:true});
    if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:snapshot-metadata-ready',{detail:{snapshot_count:items.length}}));
    return items;
  })().finally(()=>{snapshotMetadataLoadPromise=null;});
  return snapshotMetadataLoadPromise;
}
export async function listSnapshots({force=false}={}){
  const backupActive=typeof document!=='undefined'&&document.getElementById('backup')?.classList?.contains('active');
  if(!force&&typeof document!=='undefined'&&!backupActive){
    if(!snapshotMetadataCache)setTimeout(()=>{void loadSnapshotMetadata().catch(error=>startup('SQLITE_SNAPSHOT_LIST_DEFERRED_FAILED','背景載入快照 metadata 失敗','warning',{message:error?.message||String(error)}));},0);
    startup('SQLITE_SNAPSHOT_LIST_DEFERRED','快照清單延後至備份頁載入','completed',{snapshot_payload_bytes_materialized:false,app_ready_blocked:false,cached:Boolean(snapshotMetadataCache)});
    return snapshotMetadataCache?[...snapshotMetadataCache]:[];
  }
  return [...await loadSnapshotMetadata()];
}
async function pruneSnapshots(max){const keys=(await request(SNAPSHOT_STORE,'readonly',store=>store.getAllKeys())||[]).map(String).sort((a,b)=>b.localeCompare(a));const remove=keys.slice(max);if(!remove.length)return {removed_count:0};const db=await openIdb();await new Promise((resolve,reject)=>{const stores=[SNAPSHOT_STORE,META_STORE].filter(name=>db.objectStoreNames.contains(name));const tx=db.transaction(stores,'readwrite');const snapshotStore=tx.objectStore(SNAPSHOT_STORE);const metaStore=db.objectStoreNames.contains(META_STORE)?tx.objectStore(META_STORE):null;remove.forEach(id=>{snapshotStore.delete(id);metaStore?.delete(snapshotMetaKey(id));});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('snapshot_prune_failed'));tx.onabort=()=>reject(tx.error||new Error('snapshot_prune_aborted'));});snapshotMetadataCache=null;return {removed_count:remove.length};}
export async function clearAllStorage(){const db=await openIdb();const stores=[DB_STORE,SNAPSHOT_STORE,META_STORE,LEGACY_SNAPSHOT_META_STORE].filter(name=>db.objectStoreNames.contains(name));await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');stores.forEach(name=>tx.objectStore(name).clear());tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('indexeddb_clear_failed'));tx.onabort=()=>reject(tx.error||new Error('indexeddb_clear_aborted'));});snapshotMetadataCache=[];}
export function closeStorageConnection(){cancelWorkerDatabaseLoad();resetStorageConnection('close_storage_connection');}
