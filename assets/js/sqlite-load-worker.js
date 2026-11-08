const IDB_NAME='pokemon_sleep_ai_manager';
const IDB_VERSION=2;
const DB_STORE='database';
const META_STORE='metadata';
const DB_KEY='primary';
const META_KEY='primary';
const PRIMARY_REVISION_KEY='revision:primary';
let cancelled=false;
let activeTx=null;
let heartbeatTimer=null;

function post(type,detail={}){self.postMessage({type,...detail});}
function heartbeat(stage){post('heartbeat',{stage,at:Date.now()});}
function startHeartbeat(stage){clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>heartbeat(stage),750);heartbeat(stage);}
function stopHeartbeat(){clearInterval(heartbeatTimer);heartbeatTimer=null;}

self.onmessage=event=>{
  const message=event.data||{};
  if(message.type==='cancel'){
    cancelled=true;
    try{activeTx?.abort();}catch{}
    stopHeartbeat();
    post('cancelled',{reason:'user_cancelled'});
    return;
  }
  if(message.type==='load')load(message).catch(error=>{
    stopHeartbeat();
    post('error',{message:error?.message||String(error),code:error?.code||'worker_load_failed'});
  });
};

async function load({maxTransferBytes=48*1024*1024}={}){
  cancelled=false;
  startHeartbeat('WORKER_STARTING');
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(IDB_NAME,IDB_VERSION);
    request.onblocked=()=>reject(Object.assign(new Error('indexeddb_blocked'),{code:'indexeddb_blocked'}));
    request.onerror=()=>reject(request.error||new Error('indexeddb_open_failed'));
    request.onsuccess=()=>resolve(request.result);
  });
  if(cancelled){db.close();return;}
  post('stage',{stage:'LEGACY_DB_READING'});
  startHeartbeat('LEGACY_DB_READING');
  // G265: the worker must transfer the exact raw image and paired durable
  // revision from one read transaction, not a version taken at a later time.
  const record=await new Promise((resolve,reject)=>{
    const tx=db.transaction([DB_STORE,META_STORE],'readonly');activeTx=tx;
    const request=tx.objectStore(DB_STORE).get(DB_KEY);
    const meta=tx.objectStore(META_STORE);
    const metadataReq=meta.get(META_KEY),revisionReq=meta.get(PRIMARY_REVISION_KEY);
    tx.oncomplete=()=>resolve({value:request.result||null,metadata:metadataReq.result||null,revision:revisionReq.result||null});
    tx.onerror=()=>reject(tx.error||new Error('indexeddb_read_failed'));
    tx.onabort=()=>reject(Object.assign(new Error(cancelled?'worker_load_cancelled':'indexeddb_transaction_aborted'),{code:cancelled?'worker_load_cancelled':'indexeddb_transaction_aborted'}));
  });
  activeTx=null;db.close();
  if(cancelled)return;
  const {value,metadata,revision}=record;
  if(!value)throw Object.assign(new Error('player_database_missing'),{code:'player_database_missing'});
  const buffer=value instanceof ArrayBuffer?value:(value.buffer instanceof ArrayBuffer?value.buffer:null);
  if(!buffer)throw Object.assign(new Error('unsupported_database_record'),{code:'unsupported_database_record'});
  const byteLength=Number(value.byteLength||buffer.byteLength||0);
  post('stage',{stage:'LEGACY_DB_BYTES_READY',byte_length:byteLength});
  if(byteLength>maxTransferBytes){
    stopHeartbeat();
    post('too_large',{byte_length:byteLength,max_transfer_bytes:maxTransferBytes});
    return;
  }
  startHeartbeat('LEGACY_DB_TRANSFER');
  const transferable=buffer.slice(0);
  stopHeartbeat();
  self.postMessage({type:'result',byte_length:byteLength,buffer:transferable,metadata,revision},[transferable]);
}
