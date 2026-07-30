import {loadDatabaseBytes,saveDatabaseBytes,createSnapshot} from './storage.js';
import {DDL,SEED_SQL} from './schema.js';
let SQL=null,db=null;
export async function initializeDatabase(){
  if(typeof initSqlJs!=='function') throw new Error('sql.js 載入失敗，請確認網路後重新整理');
  SQL=await initSqlJs({locateFile:file=>`https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`});
  const bytes=await loadDatabaseBytes();
  db=bytes?new SQL.Database(new Uint8Array(bytes)):new SQL.Database();
  db.run(DDL);
  if((scalar('SELECT COUNT(*) FROM schema_migrations')||0)===0) db.run(SEED_SQL);
  await persist();
}
export function rows(sql,params=[]){const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;}
export function scalar(sql,params=[]){const r=rows(sql,params);return r.length?Object.values(r[0])[0]:null;}
export function run(sql,params=[]){db.run(sql,params);}
export async function persist(){await saveDatabaseBytes(db.export());}
export async function snapshot(reason){return createSnapshot(db.export(),reason);}
export function exportBytes(){return db.export();}
export async function replaceDatabase(bytes){
  if(db)db.close();
  db=new SQL.Database(bytes);
  const check=rows('PRAGMA integrity_check');
  if(!check.length||check[0].integrity_check!=='ok') throw new Error('SQLite integrity_check 未通過');
  db.run(DDL);await persist();
}
export function begin(){run('BEGIN IMMEDIATE');}
export function commit(){run('COMMIT');}
export function rollback(){try{run('ROLLBACK')}catch{}}
