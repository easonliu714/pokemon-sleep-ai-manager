import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
} from '../assets/js/public-master-recognition.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionTuple=value=>{
  const text=String(value||'');
  if(!/^v\d+(?:\.\d+){2,}$/.test(text))return null;
  return text.slice(1).split('.').map(Number);
};
const versionAtLeast=(value,minimum)=>{
  const a=versionTuple(value),b=versionTuple(minimum);if(!a||!b)return false;
  const length=Math.max(a.length,b.length);
  for(let i=0;i<length;i++){const left=a[i]||0,right=b[i]||0;if(left!==right)return left>right;}
  return true;
};
const schema=read('assets/js/schema.js');
const importer=read('assets/js/importer.js');
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
assert.ok(appVersion==='v0.4.13.4'||versionAtLeast(appVersion,'v0.4.13.5'),`unexpected account-capacity hotfix authority: ${appVersion}`);

assert.match(schema,/CREATE TABLE IF NOT EXISTS account_capacity\(capacity_key TEXT PRIMARY KEY,total_capacity INTEGER NOT NULL,used_count INTEGER,updated_at TEXT NOT NULL,source TEXT\)/);
assert.match(importer,/operation\.entity === 'account_capacity' && hasPlayerChange/);
assert.match(importer,/if \(!hasOwn\(data, 'updated_at'\)\) data\.updated_at = localIso\(\);/);
assert.match(importer,/change\.effective_action==='insert'\)write\(operation\.entity,change\.key,change\.data,'insert'\)/);

const managedStart=importer.indexOf('function managedData(');
const managedEnd=importer.indexOf('\nfunction fieldAudit',managedStart);
assert.ok(managedStart>=0&&managedEnd>managedStart,'managedData source extraction failed');
const managedSource=importer.slice(managedStart,managedEnd);
const fixedIso='2026-08-12T07:40:00.000Z';
const hasOwn=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const rows=()=>{throw new Error('account_capacity managedData must not require recipe DB lookup');};
// Successor-aware dependency injection: this historical contract executes only
// the account_capacity branch, so later entity-specific adapters must remain unreachable.
const prepareFirstPartyIngredientObservationStorageData=()=>{throw new Error('account_capacity managedData must not enter E3C-6B adapter');};
const managedData=Function(
  'hasOwn','localIso','rows','FIRST_PARTY_OBSERVATION_UPDATE_ENTITY','prepareFirstPartyIngredientObservationStorageData',
  `${managedSource}; return managedData;`,
)(hasOwn,()=>fixedIso,rows,'ingredient_probability_observations',prepareFirstPartyIngredientObservationStorageData);

const insertData=managedData({entity:'account_capacity'},{capacity_key:'pot'},null,{total_capacity:57},{update_id:'TEST-CAP'});
assert.deepEqual(insertData,{total_capacity:57,updated_at:fixedIso});
assert.equal(Object.hasOwn(insertData,'source_update_id'),false,'account_capacity schema has no source_update_id column');
const explicitIso='2026-08-12T06:00:00.000Z';
assert.equal(managedData({entity:'account_capacity'},{capacity_key:'pot'},null,{total_capacity:57,updated_at:explicitIso},{update_id:'TEST-CAP'}).updated_at,explicitIso,'explicit valid timestamp must be preserved');
const updateData=managedData({entity:'account_capacity'},{capacity_key:'pot'},{capacity_key:'pot',total_capacity:54,updated_at:'old'},{total_capacity:57},{update_id:'TEST-CAP'});
assert.equal(updateData.updated_at,fixedIso,'capacity changes must refresh persistence timestamp');

const snapshot=buildPublicMasterCatalogSnapshot('recipes');
const recipe=snapshot.rows.find(row=>row.recipe_id==='curry_dream_eater')||snapshot.rows[0];
assert.ok(recipe,'recipe fixture required');
const recognition={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'recipe_status_update',
  authority:'recipe_master',
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-08-12T07:33:07.133Z',
  visible_target_count:1,
  observations:[{
    observation_id:'obs-1',status:'MATCHED',observed_text:recipe.recipe_name,
    observed_data:{unlocked:true,recipe_level:16,current_energy:11533},
    canonical_key:{recipe_id:recipe.recipe_id,recipe_name:recipe.recipe_name},canonical_name:recipe.recipe_name,
    source_image_ref:'image-058',confidence:0.99,reason:'EXACT_MATCH',
  }],
  capacity_observations:[{
    capacity_key:'pot',total_capacity:57,source_image_ref:'image-058',confidence:0.99,
    observation_context:'RECIPE_SCREEN_BASE_POT_CAPACITY',
  }],
};
const compiled=compilePublicMasterRecognitionToUpdatePackage(recognition,'recipes',{allowedImageRefs:['image-058']});
assert.equal(compiled.ok,true,compiled.errors.join('\n'));
const workflow=validateWorkflow(compiled.update_package);
assert.equal(workflow.errors.length,0,workflow.errors.join('\n'));
assert.equal(compiled.update_package.operations.length,2);
const capacityOperation=compiled.update_package.operations.find(operation=>operation.entity==='account_capacity');
assert.ok(capacityOperation,'compiled recipe package must contain account_capacity operation');
assert.deepEqual(capacityOperation.data,{total_capacity:57},'recognition compiler should keep observational payload sparse; importer owns DB-managed timestamp');
const persistenceData=managedData(capacityOperation,capacityOperation.key,null,capacityOperation.data,compiled.update_package);
assert.equal(persistenceData.total_capacity,57);
assert.equal(persistenceData.updated_at,fixedIso);
assert.equal(Object.hasOwn(persistenceData,'source_update_id'),false);
const persistenceRecord={...capacityOperation.key,...persistenceData};
assert.deepEqual(Object.keys(persistenceRecord),['capacity_key','total_capacity','updated_at']);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.13.5_ACCOUNT_CAPACITY_APPLY_NOT_NULL_SUCCESSOR_AWARE',
  app_version:appVersion,
  historical_behavior_compatible:true,
  successor_dependency_isolation:true,
  schema_updated_at_not_null:true,
  sparse_compiler_payload:true,
  importer_managed_timestamp:true,
  source_update_id_not_injected:true,
  recipe_plus_capacity_workflow:'PASS',
  insert_record_columns:Object.keys(persistenceRecord),
},null,2));