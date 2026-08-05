import {inspectDatabaseRecord,loadDatabaseBytes,saveDatabaseBytes,createSnapshot} from './storage.js';
import {DDL,SEED_SQL} from './schema.js';
import {applyAllMigrations} from './migrations.js';
let SQL=null,db=null;

const AUTO_LOAD_MAX_BYTES=48*1024*1024;
const CONFIRM_LOAD_MAX_BYTES=128*1024*1024;
const FORCE_LOAD_KEY='pokemon-sleep-force-database-load-once';
let bootGeneration=0;

const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`${label}逾時（${Math.round(ms/1000)}秒）`)),ms);
  timer?.unref?.();
  Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
});
const emit=(stage,message,status='running',details={},error=null)=>{
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function'){
    globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:startup-progress',{detail:{stage,message,status,details,error:error?.message||error||null}}));
  }
};
const dispatchReady=detail=>{
  if(typeof globalThis.dispatchEvent==='function'&&typeof globalThis.CustomEvent==='function'){
    globalThis.dispatchEvent(new globalThis.CustomEvent('pokemon-sleep:database-ready',{detail}));
  }
};
const safeBootError=(code,message,details={})=>Object.assign(new Error(message),{code,details,safe_boot:true});

function consumeForceLoad(){
  try{
    const enabled=sessionStorage.getItem(FORCE_LOAD_KEY)==='1';
    sessionStorage.removeItem(FORCE_LOAD_KEY);
    return enabled;
  }catch{return false;}
}

export async function inspectDatabaseBoot(){
  const inspection=await timeout(inspectDatabaseRecord(),8000,'本機資料庫 metadata 讀取');
  const byteLength=Number(inspection.metadata?.byte_length||0);
  return {...inspection,byte_length:byteLength,metadata_known:Boolean(inspection.metadata&&byteLength>=0)};
}

export async function initializeDatabase(){
  const generation=++bootGeneration;
  try{
    emit('DATABASE_METADATA_CHECK','正在檢查本機資料庫大小');
    const inspection=await inspectDatabaseBoot();
    const forced=consumeForceLoad();
    emit('DATABASE_METADATA_READY',inspection.exists?(inspection.metadata_known?`本機資料庫大小 ${(inspection.byte_length/1024/1024).toFixed(1)} MB`:'偵測到舊版資料庫，但尚無大小資訊'):'未找到既有資料庫','running',inspection);

    if(inspection.exists&&!forced&&!inspection.metadata_known){
      throw safeBootError('legacy_database_requires_confirmation','為避免手機記憶體不足，舊版資料庫需由使用者確認後再載入',inspection);
    }
    if(inspection.exists&&!forced&&inspection.byte_length>AUTO_LOAD_MAX_BYTES){
      const code=inspection.byte_length>CONFIRM_LOAD_MAX_BYTES?'database_too_large_for_auto_load':'large_database_requires_confirmation';
      throw safeBootError(code,`本機資料庫 ${(inspection.byte_length/1024/1024).toFixed(1)} MB，已停止自動載入`,inspection);
    }

    emit('SQLJS_LOADING','正在載入 SQLite 引擎');
    if(typeof initSqlJs!=='function')throw new Error('sql.js 載入失敗，請確認網路後重新整理');
    SQL=await timeout(initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`}),20000,'SQL.js 初始化');
    if(generation!==bootGeneration)throw safeBootError('stale_boot_generation','較新的資料庫啟動流程已取代本次操作');
    emit('SQLJS_READY','SQLite 引擎載入完成');

    const bytes=inspection.exists?await timeout(loadDatabaseBytes(),30000,'本機 SQLite 讀取'):null;
    if(generation!==bootGeneration)throw safeBootError('stale_boot_generation','資料讀取完成，但本次啟動已取消');
    emit('SQLITE_BYTES_READY',bytes?`本機資料庫讀取完成（${(bytes.byteLength/1024/1024).toFixed(1)} MB）`:'準備建立新資料庫','running',{byte_length:bytes?.byteLength||0,restored:Boolean(bytes),forced});
    emit('SQLITE_OPENING','正在開啟 SQLite 資料庫');
    db=bytes?new SQL.Database(new Uint8Array(bytes)):new SQL.Database();
    emit('SCHEMA_CHECKING','正在檢查資料庫結構');
    db.run(DDL);
    const isNew=(scalar('SELECT COUNT(*) FROM schema_migrations')||0)===0;
    if(isNew){emit('SEED_RUNNING','正在建立全新資料庫的基礎資料');db.run(SEED_SQL);}
    emit('MIGRATION_RUNNING','正在執行資料庫 Migration');
    applyAllMigrations(db);
    emit('MIGRATION_COMPLETED','資料庫 Migration 完成');
    if(!bytes){emit('FIRST_PERSIST_RUNNING','正在儲存全新 SQLite 資料庫');await persist();emit('FIRST_PERSIST_COMPLETED','全新 SQLite 資料庫已儲存');}
    const seeded=isNew;
    dispatchReady({seeded,restored:Boolean(bytes),boot_persist_skipped:Boolean(bytes),byte_length:bytes?.byteLength||0,forced});
    return {seeded};
  }catch(error){
    if(error?.safe_boot){
      emit('DATABASE_RESCUE_REQUIRED',error.message,'warning',{code:error.code,...error.details},error);
    }else{
      emit('DATABASE_FAILED',`資料庫初始化失敗：${error?.message||error}`,'failed',{},error);
    }
    throw error;
  }
}

export function requestForcedDatabaseLoad(){
  try{sessionStorage.setItem(FORCE_LOAD_KEY,'1');}catch{}
  return true;
}
export function cancelDatabaseBoot(){bootGeneration+=1;return bootGeneration;}
export function isDatabaseReady(){return Boolean(db);}
export function rows(sql,params=[]){if(!db)throw new Error('database_not_ready');const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;}
export function scalar(sql,params=[]){const r=rows(sql,params);return r.length?Object.values(r[0])[0]:null;}
export function run(sql,params=[]){if(!db)throw new Error('database_not_ready');db.run(sql,params);}
export async function persist(){if(!db)throw new Error('database_not_ready');emit('SQLITE_PERSIST_RUNNING','正在儲存 SQLite');const exported=db.export();await timeout(saveDatabaseBytes(exported),30000,'SQLite 儲存');emit('SQLITE_PERSIST_COMPLETED','SQLite 儲存完成','running',{byte_length:exported.byteLength});}
export async function snapshot(reason){if(!db)throw new Error('database_not_ready');emit('SQLITE_SNAPSHOT_RUNNING',`正在建立快照：${reason}`);const exported=db.export();const result=await timeout(createSnapshot(exported,reason),30000,'SQLite 快照');emit('SQLITE_SNAPSHOT_COMPLETED',`快照已建立：${reason}`);return result;}
export function exportBytes(){if(!db)throw new Error('database_not_ready');return db.export();}
export async function replaceDatabase(bytes){
  emit('SQLITE_REPLACE_RUNNING','正在驗證並替換 SQLite 資料庫');
  if(db)db.close();
  db=new SQL.Database(bytes);
  const check=rows('PRAGMA integrity_check');
  if(!check.length||check[0].integrity_check!=='ok')throw new Error('SQLite integrity_check 未通過');
  db.run(DDL);
  applyAllMigrations(db);
  dispatchReady({seeded:false,restored:true,replaced:true});
  await persist();
}
export function begin(){run('BEGIN IMMEDIATE');}
export function commit(){run('COMMIT');}
export function rollback(){try{run('ROLLBACK')}catch{}}
