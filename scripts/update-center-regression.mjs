import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import initSqlJs from 'sql.js';
import {indexedDB, IDBKeyRange} from 'fake-indexeddb';

globalThis.indexedDB=indexedDB;
globalThis.IDBKeyRange=IDBKeyRange;
globalThis.initSqlJs=async()=>initSqlJs();

const database=await import('../assets/js/database.js');
const importer=await import('../assets/js/importer.js');
const storage=await import('../assets/js/storage.js');
const workflow=await import('../assets/js/ai-workflow.js');
const firstParty=await import('../assets/js/ingredient-probability-first-party-observation-update.js');
const observationContract=await import('../assets/js/ingredient-probability-first-party-observation-contract.js');

const invalidWorkflow=workflow.validateWorkflow({operations:'bad'});
assert.ok(invalidWorkflow.errors.length>0,'invalid JSON structure must be rejected');
const reviewPayload={
  schema_version:'1.1',update_id:'TEST-REVIEW',generated_at:'2026-07-31T00:00:00+08:00',source:'ci-fixture',
  operations:[{operation_id:'OP-1',entity:'pokemon',action:'upsert',key:{pokemon_id:'pkm-review'},data:{species:'測試寶可夢'},review_required:true}],
};
const reviewResult=workflow.validateWorkflow(reviewPayload);
assert.equal(reviewResult.review.length,1,'review_required operation must enter review queue');
const approved=workflow.approveReviewed(reviewPayload);
assert.equal(approved.operations[0].review_required,false,'approved review must clear review_required');

await storage.clearAllStorage();
await database.initializeDatabase();

assert.equal(database.scalar('SELECT COUNT(*) FROM schema_migrations WHERE version=10'),0,'migration 10 remains reserved for historical compatibility');
assert.equal(database.scalar('SELECT COUNT(*) FROM schema_migrations WHERE version=11'),1,'E3C-6B local observation migration 11 must be applied');
assert.ok(database.scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='ingredient_probability_observations'")>0,'E3C-6B observation table must exist');
const observationColumns=database.rows('PRAGMA table_info("ingredient_probability_observations")').map(row=>row.name);
for(const forbidden of ['pokemon_id','pokemon_instance_id','nickname','identity_fingerprint','player_name','account_id'])assert.equal(observationColumns.includes(forbidden),false,`private player identity column forbidden: ${forbidden}`);
for(const required of ['observation_id','source_key','status','eligible_for_statistical_aggregation','berry_help_event_count','ingredient_help_event_count','total_help_event_count','ingredient_event_fraction','captured_at','source_update_id'])assert.ok(observationColumns.includes(required),`observation storage column missing: ${required}`);

const ingredientName='好眠番茄';
assert.equal(database.scalar('SELECT COUNT(*) FROM ingredient_master WHERE ingredient_name=?',[ingredientName]),1,'fixture must use a canonical public ingredient');
const payload={
  schema_version:'1.1',
  update_id:'TEST-UPDATE-001',
  generated_at:'2026-07-31T00:00:00+08:00',
  source:'ci-fixture',
  scenario:'ingredient_inventory_update',
  operations:[
    {
      entity:'ingredient_inventory',
      action:'upsert',
      key:{ingredient_name:ingredientName},
      data:{quantity:12,updated_at:'2026-07-31T00:00:00+08:00',source_update_id:'TEST-UPDATE-001'},
    },
  ],
};

const preview=importer.dryRun(payload);
assert.equal(preview.conflict_count,0);
assert.equal(preview.ready_count,1);

const beforeSnapshots=await storage.listSnapshots();
await importer.applyPayload(payload);
const afterSnapshots=await storage.listSnapshots();
assert.equal(afterSnapshots.length,beforeSnapshots.length+1,'apply must create a snapshot');
assert.equal(database.scalar('SELECT quantity FROM ingredient_inventory WHERE ingredient_name=?',[ingredientName]),12);
assert.equal(database.scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?',[payload.update_id]),1);
assert.equal(database.scalar('SELECT COUNT(*) FROM import_changes WHERE update_id=?',[payload.update_id]),1);

assert.throws(()=>importer.dryRun(payload),/update_id 已套用/,'duplicate update_id must be rejected');

// E3C-6B accepted first-party observation: same Update Center, same snapshot/transaction,
// but derived event counts are re-evaluated by Importer immediately before storage.
const observationBase={
  observation_id:'ci-e3c6b-accepted-001',
  observation_source:observationContract.FIRST_PARTY_OBSERVATION_SOURCE,
  observation_mode:observationContract.FIRST_PARTY_OBSERVATION_MODE,
  source_key:'BULBASAUR',
  canonical_species_form_id:'neroli:bulbasaur',
  species_form_identity_confirmed:true,
  player_private_identity_included:false,
  observation_evidence_refs:['ci://manual-window/accepted-001'],
  level:20,
  ingredient_slots:[{unlock_level:1,ingredient_name:'甜甜蜜',quantity:2}],
  individual_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  environment_ingredient_rate_modifier_state:'NONE_ACTIVE_CONFIRMED',
  inventory_empty_at_window_start:true,
  collection_before_inventory_overflow_confirmed:true,
  sneaky_snacking_or_overflow_observed:false,
  helper_whistle_used:false,
  external_extra_help_effect_used:false,
  non_help_item_contamination:false,
  collection_counts_complete:true,
  external_rate_value_used_to_reconstruct_events:false,
  berry_items_collected:20,
  ingredient_items_collected:20,
  berry_items_per_help:1,
  berry_items_per_help_authority:'DETERMINISTIC_PLATFORM_VERIFIED',
  inventory_items_before_collection:40,
  inventory_capacity:50,
};
const acceptedObservation=firstParty.buildFirstPartyIngredientObservationUpdatePackage(observationBase,{
  generatedAt:'2026-08-15T10:00:00.000Z',updateId:'TEST-E3C6B-ACCEPTED',capturedAt:'2026-08-15T09:59:00.000Z',
});
const acceptedWorkflow=workflow.validateWorkflow(acceptedObservation);
assert.deepEqual(acceptedWorkflow.errors,[],'accepted E3C-6B package must pass Update Center structure validation');
assert.deepEqual(acceptedWorkflow.review,[],'E3C-6B deterministic observation status must not enter generic AI review queue');
const acceptedPreview=importer.dryRun(acceptedObservation);
assert.equal(acceptedPreview.conflict_count,0);
assert.equal(acceptedPreview.ready_count,1);
assert.equal(acceptedPreview.changes[0].entity,'ingredient_probability_observations');
assert.equal(acceptedPreview.changes[0].effective_action,'insert');
const snapshotsBeforeAccepted=(await storage.listSnapshots()).length;
await importer.applyPayload(acceptedObservation);
assert.equal((await storage.listSnapshots()).length,snapshotsBeforeAccepted+1,'accepted observation apply must snapshot before transaction');
const acceptedStored=database.rows('SELECT * FROM ingredient_probability_observations WHERE observation_id=?',[observationBase.observation_id])[0];
assert.equal(acceptedStored.status,'ACCEPTED_RAW_OBSERVATION');
assert.equal(acceptedStored.eligible_for_statistical_aggregation,1);
assert.equal(acceptedStored.berry_help_event_count,20);
assert.equal(acceptedStored.ingredient_help_event_count,10);
assert.equal(acceptedStored.total_help_event_count,30);
assert.equal(acceptedStored.ingredient_event_fraction,1/3);
assert.equal(acceptedStored.player_private_identity_included,0);
assert.equal(acceptedStored.source_update_id,acceptedObservation.update_id);
assert.deepEqual(JSON.parse(acceptedStored.observation_evidence_refs),observationBase.observation_evidence_refs);

// Contaminated observations remain useful review evidence but cannot enter statistics.
const rejectedObservation=firstParty.buildFirstPartyIngredientObservationUpdatePackage({...observationBase,observation_id:'ci-e3c6b-rejected-001',helper_whistle_used:true},{
  generatedAt:'2026-08-15T10:02:00.000Z',updateId:'TEST-E3C6B-REJECTED',capturedAt:'2026-08-15T10:01:00.000Z',
});
const rejectedWorkflow=workflow.validateWorkflow(rejectedObservation);
assert.deepEqual(rejectedWorkflow.errors,[],'rejected observation must remain safely storable');
assert.ok(rejectedWorkflow.warnings.some(message=>message.includes('REVIEW_REQUIRED')),'rejected observation must show exclusion warning');
assert.deepEqual(rejectedWorkflow.review,[],'observation REVIEW_REQUIRED is not generic AI review_required');
const rejectedPreview=importer.dryRun(rejectedObservation);
assert.equal(rejectedPreview.conflict_count,0);
await importer.applyPayload(rejectedObservation);
const rejectedStored=database.rows('SELECT * FROM ingredient_probability_observations WHERE observation_id=?',['ci-e3c6b-rejected-001'])[0];
assert.equal(rejectedStored.status,'REVIEW_REQUIRED');
assert.equal(rejectedStored.eligible_for_statistical_aggregation,0);
assert.equal(rejectedStored.ingredient_help_event_count,null);
assert.ok(JSON.parse(rejectedStored.blockers).includes('HELPER_WHISTLE_USED'));

const localAggregate=firstParty.buildDeidentifiedFirstPartyIngredientAggregate(database.rows('SELECT * FROM ingredient_probability_observations ORDER BY captured_at'));
assert.equal(localAggregate.groups.length,1);
assert.equal(localAggregate.groups[0].source_key,'BULBASAUR');
assert.equal(localAggregate.groups[0].observation_count,1,'rejected observation must not contribute to aggregate');
assert.equal(localAggregate.groups[0].total_help_event_count,30);
assert.equal(localAggregate.groups[0].ingredient_help_event_count,10);
assert.equal(localAggregate.activation_authority_granted,false);
assert.equal(localAggregate.sample_sufficiency_for_activation,'NOT_DEFINED');
for(const forbidden of ['pokemon_id','nickname','observation_evidence_refs','ingredient_slots','level'])assert.equal(JSON.stringify(localAggregate).includes(`"${forbidden}"`),false,`aggregate leaked private/raw field: ${forbidden}`);

const tamperedObservation=structuredClone(firstParty.buildFirstPartyIngredientObservationUpdatePackage({...observationBase,observation_id:'ci-e3c6b-tampered-001'},{generatedAt:'2026-08-15T10:03:00.000Z',updateId:'TEST-E3C6B-TAMPERED'}));
tamperedObservation.operations[0].data.ingredient_help_event_count=999;
assert.throws(()=>importer.dryRun(tamperedObservation),/ingredient_help_event_count/,'Importer must re-evaluate and reject tampered derived event counts before storage');
assert.equal(database.scalar('SELECT COUNT(*) FROM ingredient_probability_observations WHERE observation_id=?',['ci-e3c6b-tampered-001']),0);

const selfActivated=structuredClone(firstParty.buildFirstPartyIngredientObservationUpdatePackage({...observationBase,observation_id:'ci-e3c6b-self-activate-001'},{generatedAt:'2026-08-15T10:04:00.000Z',updateId:'TEST-E3C6B-SELF-ACTIVATE'}));
selfActivated.production_boundary.runtime_numeric_activation=true;
assert.throws(()=>importer.dryRun(selfActivated),/runtime_numeric_activation/,'observation package must never self-authorize Production activation');

const backup=database.exportBytes();
database.run('UPDATE ingredient_inventory SET quantity=99 WHERE ingredient_name=?',[ingredientName]);
await database.persist();
await database.replaceDatabase(backup);
assert.equal(database.scalar('SELECT quantity FROM ingredient_inventory WHERE ingredient_name=?',[ingredientName]),12,'restore must recover backup value');
assert.equal(database.scalar('SELECT COUNT(*) FROM ingredient_probability_observations'),2,'restore must preserve E3C-6B local observations');
assert.equal(database.rows('PRAGMA integrity_check')[0].integrity_check,'ok');
assert.equal(database.scalar('SELECT COUNT(*) FROM schema_migrations WHERE version IN (1,2,3,4,5)'),5,'restore must retain/reapply migrations');
assert.equal(database.scalar('SELECT COUNT(*) FROM schema_migrations WHERE version=10'),0,'restore must keep migration 10 reserved');
assert.equal(database.scalar('SELECT COUNT(*) FROM schema_migrations WHERE version=11'),1,'restore must retain/reapply E3C-6B migration 11');
assert.ok(database.scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='recipe_master'")>0,'restore must retain shared knowledge schema');

const rollbackPayload={
  schema_version:'1.1',
  update_id:'TEST-UPDATE-ROLLBACK',
  generated_at:'2026-07-31T00:00:00+08:00',
  source:'ci-fixture',
  operations:[
    {
      entity:'settings',
      action:'insert',
      key:{key:'rollback_marker'},
      data:{value_json:'{"step":1}',updated_at:'2026-07-31T00:00:00+08:00'},
    },
    {
      entity:'settings',
      action:'insert',
      key:{key:'rollback_marker'},
      data:{value_json:'{"step":2}',updated_at:'2026-07-31T00:00:00+08:00'},
    },
  ],
};

let failed=false;
try{
  await importer.applyPayload(rollbackPayload);
}catch{
  failed=true;
}
assert.equal(failed,true,'invalid transactional apply must fail');
assert.equal(database.scalar('SELECT COUNT(*) FROM settings WHERE key=?',['rollback_marker']),0,'rollback must remove partial writes');
assert.equal(database.scalar('SELECT COUNT(*) FROM import_batches WHERE update_id=?',[rollbackPayload.update_id]),0);
assert.equal(database.rows('PRAGMA integrity_check')[0].integrity_check,'ok');

const appSource=await readFile(new URL('../assets/js/app.js',import.meta.url),'utf8');
for(const table of ['recipes','recipe_ingredients','pokemon','pokemon_ingredients','pokemon_subskills','ingredient_inventory','item_inventory','ingredient_probability_observations','import_batches','import_changes']){
  assert.ok(appSource.includes(`'${table}'`),`JSON backup table list missing ${table}`);
}
assert.match(appSource,/pokemon-sleep:local-update-package-ready/,'local deterministic capture must feed the canonical Update Center state');
assert.match(appSource,/pokemon-sleep:update-applied/,'successful apply must notify local evidence UI to refresh aggregation');
assert.match(appSource,/snapshot\('before-restore'\)/,'restore must snapshot current database first');
assert.match(appSource,/replaceDatabase\(/,'restore must call replaceDatabase');

console.log('PASS update center + E3C-6B: validation, reserved migration 10, migration 11, local private observation dry-run/snapshot/apply, deterministic re-validation, rejected evidence exclusion, de-identified aggregate, duplicate/tamper/self-activation guards, rollback, JSON backup, backup/restore, shared data, integrity_check');