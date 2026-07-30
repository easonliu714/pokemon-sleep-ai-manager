const IDB_NAME = "pokemon_sleep_ai_manager";
const IDB_VERSION = 1;
const DB_STORE = "database";
const SNAPSHOT_STORE = "snapshots";
const DB_KEY = "primary";

function openIdb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(IDB_NAME,IDB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if(!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE,{keyPath:"id"});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function tx(store,mode,fn){
  const db=await openIdb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(store,mode);
    const s=t.objectStore(store);
    let result;
    try{result=fn(s)}catch(e){reject(e);return}
    t.oncomplete=()=>resolve(result);
    t.onerror=()=>reject(t.error);
    t.onabort=()=>reject(t.error||new Error("IndexedDB transaction aborted"));
  });
}
export async function loadDatabaseBytes(){
  const db=await openIdb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(DB_STORE,"readonly");
    const r=t.objectStore(DB_STORE).get(DB_KEY);
    r.onsuccess=()=>resolve(r.result||null);
    r.onerror=()=>reject(r.error);
  });
}
export async function saveDatabaseBytes(bytes){
  const copy=bytes instanceof Uint8Array?bytes.slice().buffer:bytes;
  await tx(DB_STORE,"readwrite",s=>s.put(copy,DB_KEY));
}
export async function createSnapshot(bytes,reason){
  const id=`SNAP-${new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)}-${Math.random().toString(16).slice(2,6)}`;
  const item={id,created_at:new Date().toISOString(),reason,bytes:(bytes instanceof Uint8Array?bytes.slice().buffer:bytes)};
  await tx(SNAPSHOT_STORE,"readwrite",s=>s.put(item));
  await pruneSnapshots(10);
  return id;
}
export async function listSnapshots(){
  const db=await openIdb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(SNAPSHOT_STORE,"readonly");
    const r=t.objectStore(SNAPSHOT_STORE).getAll();
    r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
    r.onerror=()=>reject(r.error);
  });
}
async function pruneSnapshots(max){
  const items=await listSnapshots();
  const remove=items.slice(max);
  if(!remove.length)return;
  await tx(SNAPSHOT_STORE,"readwrite",s=>remove.forEach(x=>s.delete(x.id)));
}
export async function clearAllStorage(){
  await Promise.all([tx(DB_STORE,"readwrite",s=>s.clear()),tx(SNAPSHOT_STORE,"readwrite",s=>s.clear())]);
}
