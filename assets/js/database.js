import {loadDatabaseBytes,saveDatabaseBytes,createSnapshot} from './storage.js';
import {DDL,SEED_SQL} from './schema.js';
import {applyAllMigrations} from './migrations.js';
let SQL=null,db=null;

const timeout=(promise,ms,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`${label}逾時（${Math.round(ms/1000)}秒）`)),ms);
  Promise.resolve(promise).then(
    value=>{clearTimeout(timer);resolve(value);},
    error=>{clearTimeout(timer);reject(error);},
  );
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

export async function initializeDatabase(){
  try{
    emit('SQLJS_LOADING','正在載入 SQLite 引擎');
    if(typeof initSqlJs!=='function') throw new Error('sql.js 載入失敗，請確認網路後重新整理');
    SQL=await timeout(initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`}),20000,'SQL.js 初始化');
    emit('SQLJS_READY','SQLite 引擎載入完成');
    emit('INDEXEDDB_OPENING','正在開啟本機儲存空間');
    const bytes=await timeout(loadDatabaseBytes(),15000,'本機 SQLite 讀取');
    emit('SQLITE_BYTES_READY',bytes?`本機資料庫讀取完成（${Math.round(bytes.byteLength/1024)} KB）`:'未找到既有資料庫，準備建立新資料庫','running',{byte_length:bytes?.byteLength||0,restored:Boolean(bytes)});
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
    dispatchReady({seeded,restored:Boolean(bytes),boot_persist_skipped:Boolean(bytes)});
    return {seeded};
  }catch(error){
    emit('DATABASE_FAILED',`資料庫初始化失敗：${error?.message||error}`,'failed',{},error);
    throw error;
  }
}
export function rows(sql,params=[]){if(!db)throw new Error('database_not_ready');const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;}
export function scalar(sql,params=[]){const r=rows(sql,params);return r.length?Object.values(r[0])[0]:null;}
export function run(sql,params=[]){if(!db)throw new Error('database_not_ready');db.run(sql,params);}
export async function persist(){if(!db)throw new Error('database_not_ready');emit('SQLITE_PERSIST_RUNNING','正在儲存 SQLite');await timeout(saveDatabaseBytes(db.export()),30000,'SQLite 儲存');emit('SQLITE_PERSIST_COMPLETED','SQLite 儲存完成');}
export async function snapshot(reason){if(!db)throw new Error('database_not_ready');emit('SQLITE_SNAPSHOT_RUNNING',`正在建立快照：${reason}`);const result=await timeout(createSnapshot(db.export(),reason),30000,'SQLite 快照');emit('SQLITE_SNAPSHOT_COMPLETED',`快照已建立：${reason}`);return result;}
export function exportBytes(){if(!db)throw new Error('database_not_ready');return db.export();}
export async function replaceDatabase(bytes){
  emit('SQLITE_REPLACE_RUNNING','正在驗證並替換 SQLite 資料庫');
  if(db)db.close();
  db=new SQL.Database(bytes);
  const check=rows('PRAGMA integrity_check');
  if(!check.length||check[0].integrity_check!=='ok') throw new Error('SQLite integrity_check 未通過');
  db.run(DDL);
  applyAllMigrations(db);
  dispatchReady({seeded:false,restored:true,replaced:true});
  await persist();
}
export function begin(){run('BEGIN IMMEDIATE');}
export function commit(){run('COMMIT');}
export function rollback(){try{run('ROLLBACK')}catch{}}
