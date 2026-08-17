import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  INGREDIENT_INVENTORY_INTEGRITY_VERSION,
  INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,
  INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,
  buildIngredientAbsenceCandidates,
  applyIngredientAbsenceConfirmations,
  validateIngredientAbsenceConfirmationPackage,
} from '../assets/js/ingredient-inventory-integrity-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.ok(['v0.4.27.2','v0.4.27.3'].includes(authority.app_version),`unexpected v0.4.27.2 successor ${authority.app_version}`);
if(authority.app_version==='v0.4.27.2'){
  assert.equal(authority.app_build,'20260816-v04272-ingredient-unlock-semantics-hotfix');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix');
}else{
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.2'"),'v0.4.27.3 must retain v0.4.27.2 lineage');
  assert.ok(versionSource.includes("// app_build: '20260816-v04272-ingredient-unlock-semantics-hotfix'"));
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix'"));
}
assert.ok(versionSource.includes("// app_version: 'v0.4.27.1'"),'v0.4.27.1 predecessor lineage missing');
assert.equal(INGREDIENT_INVENTORY_INTEGRITY_VERSION,'ingredient-inventory-integrity-2026-08-16-b-unlock-state');
assert.equal(INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,12);
assert.equal(INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,13);

const rows=[
  {ingredient_name:'窩心洋芋',quantity:0,unlocked:1,unlock_state:'UNLOCKED',player_record_exists:1},
  {ingredient_name:'嫩亮酪梨',quantity:0,unlocked:null,unlock_state:'UNKNOWN',player_record_exists:1},
  {ingredient_name:'好眠番茄',quantity:21,unlocked:1,unlock_state:'UNLOCKED',player_record_exists:1},
];
const missing=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:rows});
assert.equal(missing.length,1,'unlocked quantity=0 must not be repeatedly reconciled');
assert.equal(missing[0].ingredient_name,'嫩亮酪梨');
assert.equal(missing[0].review_kind,'UNLOCK_STATE_REVIEW');
assert.deepEqual([...missing[0].available_resolutions],['CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO','PRESERVE_UNLOCK_UNKNOWN']);

const base={schema_version:'1.1',update_id:'v04272-fixture',scenario:'ingredient_inventory_update',generated_at:'2026-08-16T05:00:00.000Z',source:'contract',operations:[{operation_id:'REC-001',entity:'ingredient_inventory',action:'upsert',key:{ingredient_name:'好眠番茄'},data:{quantity:21},clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'IMG-001',confidence:1},review_required:false}]};
const notUnlocked=applyIngredientAbsenceConfirmations(base,[{ingredient_name:'嫩亮酪梨',previous_quantity:0,resolution:'CONFIRMED_NOT_UNLOCKED',confirmed_by_user:true,confirmed_at:'2026-08-16T05:01:00.000Z'}],{sourceImageRefs:['IMG-001']});
const op=notUnlocked.operations.find(row=>row.key?.ingredient_name==='嫩亮酪梨');
assert.deepEqual(op.data,{unlocked:0});
assert.equal(Object.prototype.hasOwnProperty.call(op.data,'quantity'),false,'NOT_UNLOCKED must not fabricate quantity=0 evidence');
const validation=validateIngredientAbsenceConfirmationPackage(notUnlocked,{coverage:'USER_CONFIRMED_COMPLETE'});
assert.equal(validation.ok,true);assert.equal(validation.explicit_zero_count,0);assert.equal(validation.unlock_state_confirmation_count,1);

const schema=read('assets/js/schema.js');assert.ok(schema.includes('quantity INTEGER NOT NULL DEFAULT 0,unlocked INTEGER'));
const shared=read('assets/js/shared-master-schema.js');for(const token of ['stored_unlocked','unlock_state','NO_PLAYER_RECORD','NOT_UNLOCKED','UNKNOWN'])assert.ok(shared.includes(token),`ingredient catalog projection missing ${token}`);
const integrity=read('assets/js/ingredient-inventory-integrity-contract.js');for(const token of ['CONFIRMED_NOT_UNLOCKED','CONFIRMED_UNLOCKED_ZERO','PRESERVE_UNLOCK_UNKNOWN','zero_quantity_implies_not_unlocked:false'])assert.ok(integrity.includes(token),`integrity contract missing ${token}`);
const ui=read('assets/js/ingredient-inventory-integrity-ui.js');for(const token of ['尚未解鎖','已解鎖，目前為 0','本次無法確認 → 保留待確認'])assert.ok(ui.includes(token),`unlock review UI missing ${token}`);
const catalog=read('assets/js/public-catalog-workbench.js');assert.ok(catalog.includes('canonical-ingredient-unlock'));assert.ok(catalog.includes('解鎖狀態'));assert.ok(catalog.includes('尚無玩家證據'));
const editor=read('assets/js/manual-editor.js');assert.ok(editor.includes('quantity=0 never auto-means NOT_UNLOCKED'));assert.ok(editor.includes('unlocked=excluded.unlocked'));
const migration=read('assets/js/ingredient-inventory-integrity-contract.js');assert.ok(migration.includes('ALTER TABLE ingredient_inventory ADD COLUMN unlocked INTEGER'));assert.ok(migration.includes('trg_ingredient_inventory_unlock_positive_insert'));
const predecessor=read('scripts/v0423-predecessor-contract-runner.mjs');assert.ok(predecessor.includes("current==='v0.4.27.2'")&&predecessor.includes("current==='v0.4.27.3'"),'production predecessor bridge missing current successor');
const sw=read('service-worker.js');assert.ok(sw.includes('pokemon-sleep-ai-v0.4.27.2-v04272-ingredient-unlock-semantics-hotfix'),'v0.4.27.2 previous PWA cache marker missing');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.27.2_RELEASE_CONTRACT',
  runtime_successor:authority.app_version,
  identity_migration_version:INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,
  unlock_migration_version:INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION,
  quantity_and_unlock_state_separated:true,
  zero_quantity_not_equal_not_unlocked:true,
  positive_quantity_proves_unlock:true,
  unlocked_zero_absence_requires_no_repeat_review:true,
  explicit_not_unlocked_does_not_fabricate_quantity_zero:true,
  android_pwa_live_validation_required:true,
  production_numeric_authority_changed:false,
  workflow_topology_changed:false,
},null,2));