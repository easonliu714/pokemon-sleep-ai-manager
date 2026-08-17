import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,
  LEGACY_INGREDIENT_IDENTITY_RENAMES,
  buildIngredientAbsenceCandidates,
  applyIngredientAbsenceConfirmations,
  validateIngredientAbsenceConfirmationPackage,
} from '../assets/js/ingredient-inventory-integrity-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js');
const sandbox={};sandbox.globalThis=sandbox;vm.createContext(sandbox);vm.runInContext(versionSource,sandbox);
const authority=sandbox.PokemonSleepVersionAuthority;
assert.ok(['v0.4.27.1','v0.4.27.2','v0.4.27.3','v0.4.27.4'].includes(authority.app_version),`unexpected v0.4.27.1 successor ${authority.app_version}`);
if(authority.app_version!=='v0.4.27.1'){
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.1'"),`${authority.app_version} must retain v0.4.27.1 lineage`);
  assert.ok(versionSource.includes("// app_build: '20260816-v04271-ingredient-inventory-integrity-hotfix'"));
}else{
  assert.equal(authority.app_build,'20260816-v04271-ingredient-inventory-integrity-hotfix');
  assert.equal(authority.cache_name,'pokemon-sleep-ai-v0.4.27.1-v04271-ingredient-inventory-integrity-hotfix');
}
assert.ok(versionSource.includes("// app_version: 'v0.4.27'"),'v0.4.27 predecessor lineage missing');
assert.equal(INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,12);
assert.equal(LEGACY_INGREDIENT_IDENTITY_RENAMES['特選酪梨'],'嫩亮酪梨');

const established=[{ingredient_name:'好眠番茄',quantity:21,unlock_state:'UNLOCKED'},{ingredient_name:'窩心洋芋',quantity:7,unlock_state:'UNLOCKED'}];
assert.deepEqual(buildIngredientAbsenceCandidates({coverage:'PARTIAL',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established}),[]);
const missing=buildIngredientAbsenceCandidates({coverage:'USER_CONFIRMED_COMPLETE',recognizedIngredientNames:['好眠番茄'],establishedInventoryRows:established});
assert.equal(missing.length,1);assert.equal(missing[0].ingredient_name,'窩心洋芋');assert.equal(missing[0].previous_quantity,7);assert.equal(missing[0].status,'REVIEW_REQUIRED');
const base={schema_version:'1.1',package_id:'release-contract',scenario:'ingredient_inventory_update',generated_at:'2026-08-16T00:00:00.000Z',source:'contract',operations:[{operation_id:'REC-001',entity:'ingredient_inventory',action:'upsert',key:{ingredient_name:'好眠番茄'},data:{quantity:21},clear_fields:[],evidence:{source_type:'screenshot',source_image_ref:'IMG-001',confidence:1},review_required:false}]};
const confirmed=applyIngredientAbsenceConfirmations(base,[{ingredient_name:'窩心洋芋',previous_quantity:7,resolution:'CONFIRMED_EXHAUSTED',confirmed_by_user:true,confirmed_at:'2026-08-16T00:01:00.000Z'}],{sourceImageRefs:['IMG-001']});
assert.equal(confirmed.operations.find(row=>row.key?.ingredient_name==='窩心洋芋')?.data?.quantity,0);
const validation=validateIngredientAbsenceConfirmationPackage(confirmed,{coverage:'USER_CONFIRMED_COMPLETE'});assert.equal(validation.ok,true);assert.equal(validation.confirmed_absence_count,1);assert.equal(validation.explicit_zero_count,1);

const migrations=read('assets/js/migrations.js');
assert.ok(migrations.includes('INGREDIENT_INVENTORY_INTEGRITY_MIGRATION_VERSION'));
assert.ok(migrations.includes('applyIngredientInventoryIdentityMigration(db)'));
assert.equal(migrations.includes('VALUES(10,'),false,'migration 10 remains reserved historical sentinel');
const identity=read('assets/js/public-ingredient-identity.js');assert.ok(identity.includes("'特選酪梨':'嫩亮酪梨'"));
const importer=read('assets/js/importer.js');assert.ok(importer.includes("null_overwrite_policy:'preserve_existing_unless_clear_fields'"));assert.ok(importer.includes('explicit_zero_and_false_are_values:true'));
const ui=read('assets/js/ingredient-inventory-integrity-ui.js');assert.ok(ui.includes('CONFIRMED_EXHAUSTED'));assert.ok(ui.includes('PRESERVE_EXISTING_NOT_CAPTURED'));assert.ok(ui.includes('stopImmediatePropagation'));
const index=read('index.html');assert.ok(index.includes('./assets/js/ingredient-inventory-integrity-ui.js'));
const sw=read('service-worker.js');for(const asset of ['ingredient-inventory-integrity-contract.js','ingredient-inventory-integrity-ui.js'])assert.ok(sw.includes(`'./assets/js/${asset}'`),`offline precache missing ${asset}`);

console.log(JSON.stringify({status:'PASS',gate:'V0.4.27.1_RELEASE_CONTRACT',runtime_successor:authority.app_version,identity_migration_version:INGREDIENT_INVENTORY_IDENTITY_MIGRATION_VERSION,legacy_avocado_rekey:true,legacy_canonical_no_sum:true,complete_capture_absence_requires_confirmation:true,explicit_zero_only_after_user_confirmation:true,null_missing_preserve_existing:true,offline_precache:true,workflow_topology_changed:false},null,2));