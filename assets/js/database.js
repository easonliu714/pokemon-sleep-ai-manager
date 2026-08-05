import {loadDatabaseBytes,saveDatabaseBytes,createSnapshot} from './storage.js';
import {DDL,SEED_SQL} from './schema.js';
import {applyAllMigrations} from './migrations.js';
let SQL=null,db=null;

const timeout=(promise,ms,label)=>Promise.race([
  promise,
  new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label}逾時（${Math.round(ms/1000)}秒）`)),ms)),
]);
const dispatchReady=detail=>globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:database-ready',{detail}));

export async function initializeDatabase(){
  if(typeof initSqlJs!=='function') throw new Error('sql.js 載入失敗，請確認網路後重新整理');
  SQL=await timeout(initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`}),20000,'SQL.js 初始化');
  const bytes=await timeout(loadDatabaseBytes(),15000,'本機 SQLite 讀取');
  db=bytes?new SQL.Database(new Uint8Array(bytes)):new SQL.Database();
  db.run(DDL);
  const isNew=(scalar('SELECT COUNT(*) FROM schema_migrations')||0)===0;
  if(isNew)db.run(SEED_SQL);
  applyAllMigrations(db);
  // v0.3.85: existing databases must become usable before any full db.export()/IndexedDB write.
  // Persist a new database immediately; existing databases are persisted only by explicit mutations.
  if(!bytes)await timeout(persist(),20000,'首次 SQLite 儲存');
  const detail={seeded:isNew,restored:Boolean(bytes),boot_persist_skipped:Boolean(bytes)};
  dispatchReady(detail);
  return detail;
}
export function rows(sql,params=[]){if(!db)throw new Error('database_not_ready');const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;}
export function scalar(sql,params=[]){const r=rows(sql,params);return r.length?Object.values(r[0])[0]:null;}
export function run(sql,params=[]){if(!db)throw new Error('database_not_ready');db.run(sql,params);}
export async function persist(){if(!db)throw new Error('database_not_ready');await timeout(saveDatabaseBytes(db.export()),30000,'SQLite 儲存');}
export async function snapshot(reason){if(!db)throw new Error('database_not_ready');return timeout(createSnapshot(db.export(),reason),30000,'SQLite 快照');}
export function exportBytes(){if(!db)throw new Error('database_not_ready');return db.export();}
export async function replaceDatabase(bytes){
  if(db)db.close();
  db=new SQL.Database(bytes);
  const check=rows('PRAGMA integrity_check');
  if(!check.length||check[0].integrity_check!=='ok') throw new Error('SQLite integrity_check 未通過');
  db.run(DDL);
  applyAllMigrations(db);
  await persist();
  dispatchReady({seeded:false,restored:true,replaced:true});
}
export function begin(){run('BEGIN IMMEDIATE');}
export function commit(){run('COMMIT');}
export function rollback(){try{run('ROLLBACK')}catch{}}
