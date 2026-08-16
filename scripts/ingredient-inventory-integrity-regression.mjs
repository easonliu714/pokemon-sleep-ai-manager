import assert from 'node:assert/strict';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import initSqlJs from 'sql.js';
import {
  applyIngredientInventoryIdentityMigration,
  buildIngredientAbsenceCandidates,
  applyIngredientAbsenceConfirmations,
  validateIngredientAbsenceConfirmationPackage,
  INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,
  INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,
} from '../assets/js/ingredient-inventory-integrity-contract.js';

const require=createRequire(import.meta.url);
const basePackage=()=>({
  schema_version:'1.1',
  package_id:'fixture-ingredient-complete',
  scenario:'ingredient_inventory_update',
  generated_at:'2026-08-16T00:00:00.000Z',
  source:'fixture',
  operations:[
    {operation_id:'REC-001',entity:'ingredient_inventory',action:'upsert',key:{ingredient_name:'好眠番茄'},data:{quantity:21},clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'IMG-001',confidence:1},review_required:false},
  ],
});

const established=[
  {ingredient_name:'好眠番茄',quantity:21,unlocked:1,unlock_state:'UNLOCKED'},
  {ingredient_name:'窩心洋芋',quantity:7,unlocked:1,unlock_state:'UNLOCKED'},
  {ingredient_name:'嫩亮酪梨',quantity:0,unlocked:null,unlock_state:'UNKNOWN'},
];
assert.deepEqual(buildIngredientAbsenceCandidates({coverage:'PARTIAL',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established}),[],'partial capture must never infer missing inventory or unlock state');
let candidates=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established});
assert.equal(candidates.length,2);
const potato=candidates.find(row=>row.ingredient_name==='窩心洋芋');const avocado=candidates.find(row=>row.ingredient_name==='嫩亮酪梨');
assert.equal(potato.review_kind,'INVENTORY_QUANTITY_REVIEW');assert.equal(potato.previous_quantity,7);
assert.equal(avocado.review_kind,'UNLOCK_STATE_REVIEW');assert.equal(avocado.previous_quantity,0);assert.equal(avocado.unlock_state,'UNKNOWN');

const confirmations=[
  {ingredient_name:'窩心洋芋',previous_quantity:7,resolution:'CONFIRMED_EXHAUSTED',confirmed_by_user:true,confirmed_at:'2026-08-16T00:01:00.000Z'},
  {ingredient_name:'嫩亮酪梨',previous_quantity:0,resolution:'CONFIRMED_NOT_UNLOCKED',confirmed_by_user:true,confirmed_at:'2026-08-16T00:01:30.000Z'},
];
const reconciled=applyIngredientAbsenceConfirmations(basePackage(),confirmations,{sourceImageRefs:['IMG-001']});
assert.equal(reconciled.operations.length,3);
const zero=reconciled.operations.find(operation=>operation.key?.ingredient_name==='窩心洋芋');
assert.equal(zero.data.quantity,0);assert.equal(zero.data.unlocked,1);assert.equal(zero.evidence.source_type,'user_confirmed_complete_capture_absence');assert.equal(zero.evidence.confirmed_by_user,true);
const locked=reconciled.operations.find(operation=>operation.key?.ingredient_name==='嫩亮酪梨');
assert.equal(locked.data.unlocked,0);assert.equal(Object.prototype.hasOwnProperty.call(locked.data,'quantity'),false,'not-unlocked confirmation must not fabricate quantity=0 observation');assert.equal(locked.evidence.source_type,'user_confirmed_ingredient_unlock_state');
let validation=validateIngredientAbsenceConfirmationPackage(reconciled,{coverage:'USER_CONFIRMED_COMPLETE'});assert.equal(validation.ok,true);assert.equal(validation.explicit_zero_count,1);assert.equal(validation.unlock_state_confirmation_count,1);
candidates=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established,confirmations:reconciled.inventory_absence_confirmations});assert.ok(candidates.every(row=>row.status==='RESOLVED'));

const unlockedZero=applyIngredientAbsenceConfirmations(basePackage(),[{ingredient_name:'嫩亮酪梨',previous_quantity:0,resolution:'CONFIRMED_UNLOCKED_ZERO',confirmed_by_user:true,confirmed_at:'2026-08-16T00:02:00.000Z'}],{sourceImageRefs:['IMG-001']});
const unlockOp=unlockedZero.operations.find(operation=>operation.key?.ingredient_name==='嫩亮酪梨');assert.deepEqual(unlockOp.data,{unlocked:1});assert.equal(validateIngredientAbsenceConfirmationPackage(unlockedZero,{coverage:'USER_CONFIRMED_COMPLETE'}).ok,true);
const unknownPreserved=applyIngredientAbsenceConfirmations(basePackage(),[{ingredient_name:'嫩亮酪梨',previous_quantity:0,resolution:'PRESERVE_UNLOCK_UNKNOWN',confirmed_by_user:true,confirmed_at:'2026-08-16T00:03:00.000Z'}],{sourceImageRefs:['IMG-001']});
assert.equal(unknownPreserved.operations.length,1);assert.equal(unknownPreserved.inventory_capture_reconciliation.preserved_unknown_count,1);
assert.equal(validateIngredientAbsenceConfirmationPackage(reconciled,{coverage:'PARTIAL'}).ok,false,'absence confirmation must be rejected outside complete coverage');

const SQL=await initSqlJs({locateFile:file=>join(dirname(require.resolve('sql.js')),file)});
const db=new SQL.Database();db.run(`
  CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
  CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT NOT NULL);
  CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY,source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL);
  CREATE TABLE ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,source_update_id TEXT);
  INSERT INTO ingredient_master VALUES('特選酪梨','legacy','legacy',NULL,'2026-08-09','legacy');
  INSERT INTO ingredient_master VALUES('嫩亮酪梨','current','current',NULL,'2026-08-15','current');
  INSERT INTO ingredient_master VALUES('窩心洋芋','current','current',NULL,'2026-08-15','current');
  INSERT INTO ingredient_inventory VALUES('特選酪梨',5,'2026-08-09','legacy');
  INSERT INTO ingredient_inventory VALUES('嫩亮酪梨',3,'2026-08-15','current');
  INSERT INTO ingredient_inventory VALUES('窩心洋芋',0,'2026-08-15','legacy-zero');
`);
const migration=applyIngredientInventoryIdentityMigration(db);assert.equal(migration.changed,true);
const scalar=sql=>{const statement=db.prepare(sql);statement.step();const value=Object.values(statement.getAsObject())[0];statement.free();return value;};
assert.equal(scalar("SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='特選酪梨'"),0);
assert.equal(scalar("SELECT quantity FROM ingredient_inventory WHERE ingredient_name='嫩亮酪梨'"),3,'conflicting rows must not be summed');
assert.equal(scalar("SELECT unlocked FROM ingredient_inventory WHERE ingredient_name='嫩亮酪梨'"),1,'positive quantity must deterministically promote unlock');
assert.equal(scalar("SELECT unlocked FROM ingredient_inventory WHERE ingredient_name='窩心洋芋'"),null,'legacy zero must stay UNKNOWN rather than become NOT_UNLOCKED');
assert.equal(scalar("SELECT unlock_state FROM ingredient_catalog_state WHERE ingredient_name='窩心洋芋'"),'UNKNOWN');
assert.equal(scalar("SELECT legacy_quantity FROM ingredient_inventory_identity_archive WHERE legacy_name='特選酪梨'"),5,'legacy conflict must be archived');
assert.equal(scalar("SELECT canonical_quantity FROM ingredient_inventory_identity_archive WHERE legacy_name='特選酪梨'"),3);
assert.equal(scalar("SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name='特選酪梨'"),0);
assert.equal(scalar(`SELECT COUNT(*) FROM schema_migrations WHERE version=${INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION}`),1);
assert.equal(scalar(`SELECT COUNT(*) FROM schema_migrations WHERE version=${INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION}`),1);
db.run("INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at,source_update_id) VALUES('好眠番茄',2,0,'2026-08-16','trigger-test')");
assert.equal(scalar("SELECT unlocked FROM ingredient_inventory WHERE ingredient_name='好眠番茄'"),1,'positive quantity trigger must enforce unlocked=1');
assert.equal(scalar('PRAGMA integrity_check'),'ok');db.close();

console.log('PASS ingredient inventory integrity: migration 12 identity/no-sum + migration 13 tri-state unlock; positive quantity=>UNLOCKED; zero=>UNKNOWN until explicit confirmation; complete-capture quantity and unlock reviews remain separate');
