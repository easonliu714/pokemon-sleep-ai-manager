const IDB_NAME = "pokemon_sleep_ai_manager";
const DB_STORE = "database";
const SNAPSHOT_STORE = "snapshots";
const LEGACY_SNAPSHOT_META_STORE = "snapshot_metadata";
const META_STORE = "metadata";
const DB_KEY = "primary";
const META_KEY = "primary";
const SNAPSHOT_META_PREFIX = "snapshot:";
const PRIMARY_REVISION_KEY = "revision:primary";
const PRIMARY_REVISION_SCHEME = "g265-atomic-primary-cas-v1";
const PRIMARY_WRITE_LOCK_NAME = "pokemon-sleep-ai-manager:sqlite-primary-exclusive-write";
const PRIMARY_WRITE_LOCK_WAIT_MS = 30000;

// G265: bind each page to the primary SQLite image actually loaded. The raw
// database/primary ArrayBuffer remains unchanged; revision is a metadata peer.
// Never silently adopt a newer durable image into an already-open SQL.js DB.
let primaryBinding = null;
// A production named writer may hold this same lock from pre-SQL admission
// through the primary IDB ACK. The opaque lease cannot be forged by another
// module and is never a substitute for the loaded primary revision binding.
let activePrimaryMutationLease = null;
let primaryMutationSticky = false;
const primaryError = (code,cause)=>Object.assign(new Error(code),{code,cause});
const validPrimaryRevision = r=>r&&Number.isSafeInteger(r.generation)
  &&r.generation>=0&&typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256);
const primaryMetadataToken = meta=>JSON.stringify({
  byte_length:meta?.byte_length??null,updated_at:meta?.updated_at??null,
  format:meta?.format??null,safe_boot_version:meta?.safe_boot_version??null,
  revision_scheme:meta?.revision_scheme??null
});
const primaryRevisionMatches = (current,expected)=>expected===null
  ?current==null
  :validPrimaryRevision(current)&&current.generation===expected.generation
    &&current.sha256===expected.sha256;
async function digestPrimaryBytes(value){
  const bytes=value instanceof ArrayBuffer?new Uint8Array(value)
    :value instanceof Uint8Array?value:null;
  if(!bytes)throw primaryError('SQLITE_PRIMARY_INVALID_RAW_BYTES');
  if(!globalThis.crypto?.subtle?.digest)
    throw primaryError('SQLITE_PRIMARY_CRYPTO_UNAVAILABLE');
  const independent=new Uint8Array(bytes);
  const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',independent));
  return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
async function bindPrimaryImage({bytes,metadata,revision}){
  if(bytes==null){
    if(revision!=null)throw primaryError('SQLITE_PRIMARY_ORPHAN_REVISION_RELOAD_REQUIRED');
    primaryBinding={exists:false,revision:null,metadataToken:primaryMetadataToken(metadata)};
    return;
  }
  if(!(bytes instanceof ArrayBuffer))
    throw primaryError('SQLITE_PRIMARY_LEGACY_BYTES_FORMAT_UNEXPECTED');
  if(revision==null&&metadata?.revision_scheme===PRIMARY_REVISION_SCHEME)
    throw primaryError('SQLITE_PRIMARY_MISSING_REVISION_RELOAD_REQUIRED');
  if(revision!=null){
    if(!validPrimaryRevision(revision))
      throw primaryError('SQLITE_PRIMARY_INVALID_REVISION_RELOAD_REQUIRED');
    const actualHash=await digestPrimaryBytes(bytes);
    if(actualHash!==revision.sha256)
      throw primaryError('SQLITE_PRIMARY_REVISION_BYTES_MISMATCH_RELOAD_REQUIRED');
  }
  primaryBinding={exists:true,
    revision:revision?{generation:revision.generation,sha256:revision.sha256}:null,
    metadataToken:primaryMetadataToken(metadata)};
}


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
      db.onversionchange=()=>{try{db.close();}catch{}if(generation===connectionGeneration){connectionGeneration+=1;connectionPromise=null;primaryBinding=null;}startup('INDEXEDDB_VERSIONCHANGE','偵測到其他分頁變更本機儲存版本；已安全關閉舊連線','warning');};
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
  primaryBinding=null;
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
    tx.oncomplete=()=>{
      const exists=keyReq.result!==undefined,metadata=metaReq?.result||null;
      // A new database may be created only if the same atomic writer later
      // still sees no primary key. Existing images must first be loaded.
      if(!exists)primaryBinding={exists:false,revision:null,metadataToken:primaryMetadataToken(metadata)};
      resolve({exists,metadata,database_version:db.version});
    };
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_metadata_read_failed'));
    tx.onabort=()=>reject(tx.error||new Error('indexeddb_metadata_read_aborted'));
  });
}

// Read the raw SQLite bytes and revision metadata from one IDB snapshot.
export async function loadDatabaseBytes(){
  startup('SQLITE_BYTES_READING','正在讀取本機 SQLite');
  const db=await openIdb();
  const result=await new Promise((resolve,reject)=>{
    const tx=db.transaction([DB_STORE,META_STORE],'readonly');
    const dataReq=tx.objectStore(DB_STORE).get(DB_KEY);
    const metaStore=tx.objectStore(META_STORE);
    const metaReq=metaStore.get(META_KEY),revReq=metaStore.get(PRIMARY_REVISION_KEY);
    tx.oncomplete=()=>resolve({bytes:dataReq.result??null,metadata:metaReq.result??null,revision:revReq.result??null});
    tx.onerror=()=>reject(tx.error||primaryError('SQLITE_PRIMARY_READ_FAILED'));
    tx.onabort=()=>reject(tx.error||primaryError('SQLITE_PRIMARY_READ_ABORTED'));
  });
  await bindPrimaryImage(result);
  startup('SQLITE_BYTES_READY','本機 SQLite 讀取完成','running',{byte_length:result.bytes?.byteLength||0});
  return result.bytes||null;
}

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
    worker.onmessage=event=>{if(!isCurrent())return;const message=event.data||{};if(message.type==='heartbeat'){lastHeartbeat=Date.now();startup(message.stage||'LEGACY_DB_WORKER_HEARTBEAT','玩家 SQLite Worker 運作中','running',{at:message.at,generation});return;}if(message.type==='stage'){lastHeartbeat=Date.now();const labels={LEGACY_DB_READING:'Worker 正在讀取玩家 SQLite',LEGACY_DB_BYTES_READY:'Worker 已取得玩家 SQLite 大小',LEGACY_DB_TRANSFER:'正在安全移交 SQLite'};startup(message.stage,labels[message.stage]||message.stage,'running',{...message,generation});return;}if(message.type==='too_large'){startup('LEGACY_DB_TOO_LARGE',`玩家 SQLite ${(message.byte_length/1048576).toFixed(1)} MB，超過手機安全載入門檻`,'warning',message);finish(reject,Object.assign(new Error('legacy_database_exceeds_mobile_safe_limit'),{code:'legacy_database_exceeds_mobile_safe_limit',details:message}));return;}if(message.type==='cancelled'){finish(reject,Object.assign(new Error('worker_load_cancelled'),{code:'worker_load_cancelled'}));return;}if(message.type==='error'){finish(reject,Object.assign(new Error(message.message||'worker_load_failed'),{code:message.code||'worker_load_failed'}));return;}if(message.type==='result'){
      // The Worker read bytes and metadata in one transaction. Verify the
      // revision's SHA before handing SQL.js an independently copied image.
      bindPrimaryImage({bytes:message.buffer,metadata:message.metadata??null,revision:message.revision??null})
        .then(()=>{if(!isCurrent())return;startup('LEGACY_DB_TRANSFERRED','玩家 SQLite 已由 Worker 安全移交','running',{byte_length:message.byte_length,generation});finish(resolve,message.buffer);},
          error=>{if(isCurrent())finish(reject,error);});
    }};
    startup('LEGACY_DB_WORKER_STARTING','正在啟動玩家 SQLite 隔離載入 Worker','running',{generation});worker.postMessage({type:'load',maxTransferBytes});
  });
}

function asArrayBuffer(bytes){if(!(bytes instanceof Uint8Array))return bytes;if(bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength)return bytes.buffer;return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}
// G265: a single atomic IndexedDB CAS covers every database.persist() caller,
// including legacy modules. It retains the old raw ArrayBuffer primary format,
// requiring no IndexedDB upgrade or SQLite migration. A stale page cannot save
// its older in-memory SQL.js image over a newer revision (including ABA).
// G265 one named production writer admission: acquire the SAME native Web Lock
// BEFORE SQL BEGIN. Compare raw bytes, metadata and monotonic revision to the
// exact image this page loaded; never adopt a competing tab's newer image.
// A failure is sticky for this page. Only a full page reload may re-admit SQL.
export async function withPrimarySqliteMutationLock(callback){
  if(typeof callback!=='function')throw primaryError('SQLITE_PRIMARY_MUTATION_INVALID_CALLBACK');
  if(primaryMutationSticky)throw primaryError('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
  if(activePrimaryMutationLease)throw primaryError('SQLITE_PRIMARY_MUTATION_SESSION_ALREADY_ACTIVE');
  if(!primaryBinding)throw primaryError('SQLITE_PRIMARY_NOT_LOADED_RELOAD_REQUIRED');
  const locks=globalThis.navigator?.locks;
  if(typeof locks?.request!=='function'||typeof globalThis.AbortController!=='function'){
    primaryMutationSticky=true;
    throw primaryError('SQLITE_PRIMARY_MUTATION_WEB_LOCKS_REQUIRED');
  }
  const controller=new globalThis.AbortController();
  let acquired=false,timer=setTimeout(()=>controller.abort(),PRIMARY_WRITE_LOCK_WAIT_MS);
  try{
    return await locks.request(PRIMARY_WRITE_LOCK_NAME,
      {mode:'exclusive',signal:controller.signal},async lock=>{
        clearTimeout(timer);timer=null;
        if(!lock||primaryMutationSticky)throw primaryError('SQLITE_PRIMARY_MUTATION_LOCK_NOT_GRANTED');
        acquired=true;
        const db=await openIdb();
        const latest=await new Promise((resolve,reject)=>{
          const tx=db.transaction([DB_STORE,META_STORE],'readonly');
          const raw=tx.objectStore(DB_STORE).get(DB_KEY);
          const meta=tx.objectStore(META_STORE).get(META_KEY);
          const rev=tx.objectStore(META_STORE).get(PRIMARY_REVISION_KEY);
          tx.oncomplete=()=>resolve({bytes:raw.result??null,metadata:meta.result??null,revision:rev.result??null});
          tx.onerror=()=>reject(tx.error||primaryError('SQLITE_PRIMARY_MUTATION_READ_FAILED'));
          tx.onabort=()=>reject(tx.error||primaryError('SQLITE_PRIMARY_MUTATION_READ_ABORTED'));
        });
        const expected=primaryBinding;
        if(!expected||Boolean(latest.bytes)!==expected.exists
          ||primaryMetadataToken(latest.metadata)!==expected.metadataToken
          ||!primaryRevisionMatches(latest.revision,expected.revision))
          throw primaryError('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
        if(expected.exists){
          if(!(latest.bytes instanceof ArrayBuffer))
            throw primaryError('SQLITE_PRIMARY_LEGACY_BYTES_FORMAT_UNEXPECTED');
          if(expected.revision&&await digestPrimaryBytes(latest.bytes)!==expected.revision.sha256)
            throw primaryError('SQLITE_PRIMARY_REVISION_BYTES_MISMATCH_RELOAD_REQUIRED');
        }
        if(primaryMutationSticky)throw primaryError('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
        const lease=Object.freeze({});
        activePrimaryMutationLease=lease;
        try{return await callback(lease);}
        finally{activePrimaryMutationLease=null;}
      });
  }catch(error){
    primaryMutationSticky=true;
    if(controller.signal.aborted&&!acquired)
      throw primaryError('SQLITE_PRIMARY_MUTATION_LOCK_WAIT_TIMEOUT_RELOAD_REQUIRED',error);
    throw error;
  }finally{if(timer!==null)clearTimeout(timer);}
}

export async function saveDatabaseBytes(bytes,{primaryMutationLease}={}){
  if(primaryMutationSticky)throw primaryError('SQLITE_PRIMARY_MUTATION_UNVERIFIED_RELOAD_REQUIRED');
  if(primaryMutationLease!==undefined&&primaryMutationLease!==activePrimaryMutationLease)
    throw primaryError('SQLITE_PRIMARY_MUTATION_LEASE_INVALID');
  if(activePrimaryMutationLease&&primaryMutationLease!==activePrimaryMutationLease)
    throw primaryError('SQLITE_PRIMARY_MUTATION_SESSION_ACTIVE');
  const buffer=asArrayBuffer(bytes);
  if(!(buffer instanceof ArrayBuffer))throw primaryError('SQLITE_PRIMARY_INVALID_RAW_BYTES');
  if(!primaryBinding)await inspectDatabaseRecord();
  if(!primaryBinding)throw primaryError('SQLITE_PRIMARY_NOT_LOADED_RELOAD_REQUIRED');
  const expected=primaryBinding;
  const hash=await digestPrimaryBytes(buffer);
  const generation=expected.revision?expected.revision.generation+1:0;
  if(!Number.isSafeInteger(generation))throw primaryError('SQLITE_PRIMARY_REVISION_EXHAUSTED');
  const revision={generation,sha256:hash};
  const metadata={byte_length:buffer.byteLength,updated_at:new Date().toISOString(),
    format:'sqlite-arraybuffer',safe_boot_version:2,revision_scheme:PRIMARY_REVISION_SCHEME};
  // G265: a cooperating opt-in writer holds the same native Web Lock for its
  // fresh-durable SQL transaction. A legacy persist must not commit underneath
  // that session. This lock protects the SAVE interval, not the earlier legacy
  // SQL mutation interval; atomic IDB CAS still rejects a stale loaded image.
  const commitAtomic=async()=>{
    const db=await openIdb();
    await new Promise((resolve,reject)=>{
    let tx,failCode=null,settled=false,have=0;
    const rejectOnce=error=>{if(!settled){settled=true;reject(error);}};
    try{
      tx=db.transaction([DB_STORE,META_STORE],'readwrite');
      const rawStore=tx.objectStore(DB_STORE),metaStore=tx.objectStore(META_STORE);
      const keyReq=rawStore.get(DB_KEY),metaReq=metaStore.get(META_KEY),revReq=metaStore.get(PRIMARY_REVISION_KEY);
      const abort=code=>{failCode=code;try{tx.abort();}catch{}};
      const stage=()=>{
        if(++have!==3)return;
        const exists=keyReq.result!==undefined;
        // A foreign or corrupt payload is never accepted as the SQLite image.
        if(exists&&!(keyReq.result instanceof ArrayBuffer)){
          abort('SQLITE_PRIMARY_LEGACY_BYTES_FORMAT_UNEXPECTED');return;
        }
        if(exists!==expected.exists
          ||primaryMetadataToken(metaReq.result)!==expected.metadataToken
          ||!primaryRevisionMatches(revReq.result,expected.revision)){
          abort('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');return;
        }
        // Enqueue all three puts before returning to the IDB event loop.
        // No await or external callback is permitted inside this transaction.
        rawStore.put(buffer,DB_KEY);
        metaStore.put(metadata,META_KEY);
        metaStore.put(revision,PRIMARY_REVISION_KEY);
      };
      keyReq.onsuccess=stage;metaReq.onsuccess=stage;revReq.onsuccess=stage;
      tx.oncomplete=()=>{settled=true;resolve();};
      tx.onerror=()=>rejectOnce(primaryError(failCode||'SQLITE_PRIMARY_SAVE_FAILED',tx.error));
      tx.onabort=()=>rejectOnce(primaryError(failCode||'SQLITE_PRIMARY_SAVE_ABORTED',tx.error));
    }catch(error){rejectOnce(primaryError('SQLITE_PRIMARY_SAVE_FAILED',error));}
    });
    primaryBinding={exists:true,revision,metadataToken:primaryMetadataToken(metadata)};
    return metadata;
  };
  // Reentrant ONLY for the opaque lease passed by the held native lock callback.
  // Every ordinary legacy save still requests the lock and performs the CAS.
  if(primaryMutationLease!==undefined&&primaryMutationLease===activePrimaryMutationLease)
    return commitAtomic();
  const locks=globalThis.navigator?.locks;
  if(typeof locks?.request!=='function'){
    // Version-neutral browser fallback: no unsafe blind write. The mandatory
    // atomic CAS still guards raw bytes; full cross-tab session admission
    // remains a separately tracked Gate on runtimes lacking Web Locks.
    return commitAtomic();
  }
  if(typeof globalThis.AbortController!=='function')
    throw primaryError('SQLITE_PRIMARY_WEB_LOCK_ABORT_UNAVAILABLE_RELOAD_REQUIRED');
  const controller=new globalThis.AbortController();
  let timer=setTimeout(()=>controller.abort(),PRIMARY_WRITE_LOCK_WAIT_MS);
  try{
    return await locks.request(PRIMARY_WRITE_LOCK_NAME,
      {mode:'exclusive',signal:controller.signal},async lock=>{
        clearTimeout(timer);timer=null;
        if(!lock)throw primaryError('SQLITE_PRIMARY_WEB_LOCK_NOT_GRANTED');
        return commitAtomic();
      });
  }catch(error){
    if(error?.code)throw error;
    if(controller.signal.aborted)
      throw primaryError('SQLITE_PRIMARY_WEB_LOCK_TIMEOUT_RELOAD_REQUIRED',error);
    throw primaryError('SQLITE_PRIMARY_WEB_LOCK_ACQUIRE_FAILED',error);
  }finally{if(timer!==null)clearTimeout(timer);}
}
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
    startup('SQLITE_SNAPSHOT_LIST_READY','快照清單已載入（metadata-only）','completed',{snapshot_count:items.length,elapsed_ms:roundedMs(started),snapshot_payload_bytes_materialized:false,version_neutral_idb:true,page_deferred:true,navigation_only:true});
    if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:snapshot-metadata-ready',{detail:{snapshot_count:items.length}}));
    return items;
  })().finally(()=>{snapshotMetadataLoadPromise=null;});
  return snapshotMetadataLoadPromise;
}
export async function listSnapshots({force=false}={}){
  const backupActive=typeof document!=='undefined'&&document.getElementById('backup')?.classList?.contains('active');
  if(!force&&typeof document!=='undefined'&&!backupActive){
    startup('SQLITE_SNAPSHOT_LIST_DEFERRED','快照清單僅在進入備份還原頁時載入','completed',{snapshot_payload_bytes_materialized:false,app_ready_blocked:false,background_load_started:false,navigation_only:true,cached:Boolean(snapshotMetadataCache)});
    return snapshotMetadataCache?[...snapshotMetadataCache]:[];
  }
  return [...await loadSnapshotMetadata()];
}
async function pruneSnapshots(max){const keys=(await request(SNAPSHOT_STORE,'readonly',store=>store.getAllKeys())||[]).map(String).sort((a,b)=>b.localeCompare(a));const remove=keys.slice(max);if(!remove.length)return {removed_count:0};const db=await openIdb();await new Promise((resolve,reject)=>{const stores=[SNAPSHOT_STORE,META_STORE].filter(name=>db.objectStoreNames.contains(name));const tx=db.transaction(stores,'readwrite');const snapshotStore=tx.objectStore(SNAPSHOT_STORE);const metaStore=db.objectStoreNames.contains(META_STORE)?tx.objectStore(META_STORE):null;remove.forEach(id=>{snapshotStore.delete(id);metaStore?.delete(snapshotMetaKey(id));});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('snapshot_prune_failed'));tx.onabort=()=>reject(tx.error||new Error('snapshot_prune_aborted'));});snapshotMetadataCache=null;return {removed_count:remove.length};}
export async function clearAllStorage(){const db=await openIdb();const stores=[DB_STORE,SNAPSHOT_STORE,META_STORE,LEGACY_SNAPSHOT_META_STORE].filter(name=>db.objectStoreNames.contains(name));await new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');stores.forEach(name=>tx.objectStore(name).clear());tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('indexeddb_clear_failed'));tx.onabort=()=>reject(tx.error||new Error('indexeddb_clear_aborted'));});snapshotMetadataCache=[];primaryBinding=null;}
export function closeStorageConnection(){cancelWorkerDatabaseLoad();resetStorageConnection('close_storage_connection');}
