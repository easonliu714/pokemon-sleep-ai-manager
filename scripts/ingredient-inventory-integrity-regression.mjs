import assert from 'node:assert/strict';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import initSqlJs from 'sql.js';
import {
  applyIngredientInventoryIdentityMigration,
  buildIngredientAbsenceCandidates,
  applyIngredientAbsenceConfirmations,
  validateIngredientAbsenceConfirmationPackage,
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
  {ingredient_name:'好眠番茄',quantity:21},
  {ingredient_name:'窩心洋芋',quantity:7},
];
assert.deepEqual(buildIngredientAbsenceCandidates({coverage:'PARTIAL',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established}),[],'partial capture must never infer missing inventory');
let candidates=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established});
assert.equal(candidates.length,1);assert.equal(candidates[0].ingredient_name,'窩心洋芋');assert.equal(candidates[0].previous_quantity,7);assert.equal(candidates[0].status,'REVIEW_REQUIRED');

const exhausted=[{ingredient_name:'窩心洋芋',previous_quantity:7,resolution:'CONFIRMED_EXHAUSTED',confirmed_by_user:true,confirmed_at:'2026-08-16T00:01:00.000Z'}];
const exhaustedPackage=applyIngredientAbsenceConfirmations(basePackage(),exhausted,{sourceImageRefs:['IMG-001']});
assert.equal(exhaustedPackage.operations.length,2);const zero=exhaustedPackage.operations.find(operation=>operation.key?.ingredient_name==='窩心洋芋');
assert.equal(zero.data.quantity,0);assert.equal(zero.evidence.source_type,'user_confirmed_complete_capture_absence');assert.equal(zero.evidence.previous_quantity,7);assert.equal(zero.evidence.confirmed_by_user,true);
let validation=validateIngredientAbsenceConfirmationPackage(exhaustedPackage,{coverage:'USER_CONFIRMED_COMPLETE'});assert.equal(validation.ok,true);assert.equal(validation.explicit_zero_count,1);
candidates=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄','窩心洋芋'],establishedInventoryRows:established,confirmations:exhaustedPackage.inventory_absence_confirmations});assert.equal(candidates.length,0,'explicit zero operation must remove ingredient from absent set');

const preserve=[{ingredient_name:'窩心洋芋',previous_quantity:7,resolution:'PRESERVE_EXISTING_NOT_CAPTURED',confirmed_by_user:true,confirmed_at:'2026-08-16T00:02:00.000Z'}];
const preservePackage=applyIngredientAbsenceConfirmations(basePackage(),preserve,{sourceImageRefs:['IMG-001']});
assert.equal(preservePackage.operations.length,1,'preserve-existing decision must not fabricate quantity=0');
candidates=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established,confirmations:preservePackage.inventory_absence_confirmations});assert.equal(candidates.length,1);assert.equal(candidates[0].status,'RESOLVED');assert.equal(candidates[0].resolution,'PRESERVE_EXISTING_NOT_CAPTURED');
validation=validateIngredientAbsenceConfirmationPackage(preservePackage,{coverage:'USER_CONFIRMED_COMPLETE'});assert.equal(validation.ok,true);assert.equal(validation.explicit_zero_count,0);
assert.equal(validateIngredientAbsenceConfirmationPackage(exhaustedPackage,{coverage:'PARTIAL'}).ok,false,'absence confirmation must be rejected outside complete coverage');

const SQL=await initSqlJs({locateFile:file=>join(dirname(require.resolve('sql.js')),file)});
const db=new SQL.Database();db.run(`
  CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
  CREATE TABLE settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT NOT NULL);
  CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY,source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL);
  CREATE TABLE ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,source_update_id TEXT);
  INSERT INTO ingredient_master VALUES('特選酪梨','legacy','legacy',NULL,'2026-08-09','legacy');
  INSERT INTO ingredient_master VALUES('嫩亮酪梨','current','current',NULL,'2026-08-15','current');
  INSERT INTO ingredient_inventory VALUES('特選酪梨',5,'2026-08-09','legacy');
  INSERT INTO ingredient_inventory VALUES('嫩亮酪梨',3,'2026-08-15','current');
`);
const migration=applyIngredientInventoryIdentityMigration(db);assert.equal(migration.changed,true);
const scalar=sql=>{const statement=db.prepare(sql);statement.step();const value=Object.values(statement.getAsObject())[0];statement.free();return value;};
assert.equal(scalar("SELECT COUNT(*) FROM ingredient_inventory WHERE ingredient_name='特選酪梨'"),0);
assert.equal(scalar("SELECT quantity FROM ingredient_inventory WHERE ingredient_name='嫩亮酪梨'"),3,'conflicting rows must not be summed');
assert.equal(scalar("SELECT legacy_quantity FROM ingredient_inventory_identity_archive WHERE legacy_name='特選酪梨'"),5,'legacy conflict must be archived');
assert.equal(scalar("SELECT canonical_quantity FROM ingredient_inventory_identity_archive WHERE legacy_name='特選酪梨'"),3);
assert.equal(scalar("SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name='特選酪梨'"),0);
assert.equal(scalar(`SELECT COUNT(*) FROM schema_migrations WHERE version=${INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION}`),1);
assert.equal(scalar('PRAGMA integrity_check'),'ok');db.close();

console.log('PASS ingredient inventory integrity: legacy avocado no-sum migration; complete-capture absence review; explicit zero only after user confirmation; partial capture preserves existing');