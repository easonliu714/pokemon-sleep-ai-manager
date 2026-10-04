import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';

globalThis.indexedDB=indexedDB;
globalThis.IDBKeyRange=IDBKeyRange;
globalThis.initSqlJs=async()=>initSqlJs();

const storage=await import('../assets/js/storage.js');
const database=await import('../assets/js/database.js');
const importer=await import('../assets/js/importer.js');
const workflow=await import('../assets/js/ai-workflow.js');
const {buildUpdatePackageJsonSchema}=await import('../assets/js/update-package-contract.js');

await storage.clearAllStorage();
await database.initializeDatabase();

const schema=buildUpdatePackageJsonSchema({scenario:'recipe_status_update',entities:['recipes']});
const operationSchema=schema.properties.operations.items.properties;
assert.deepEqual(Object.keys(operationSchema.data.properties).sort(),['current_energy','notes','recipe_level','unlocked']);
assert.equal(operationSchema.data.additionalProperties,false);
assert.deepEqual(operationSchema.clear_fields.items.enum.slice().sort(),['current_energy','notes','recipe_level']);

const master=database.rows('SELECT recipe_id,recipe_name,category,total_ingredients FROM recipe_master ORDER BY recipe_id LIMIT 2');
assert.ok(master.length>=2,'fixture requires at least two canonical recipes');
const target=master[0],other=master[1];
const masterBefore=database.rows('SELECT * FROM recipe_master WHERE recipe_id=?',[target.recipe_id])[0];

const payload={
  schema_version:'1.1',
  update_id:'G52-STATE-001',
  generated_at:'2026-10-04T16:00:00.000Z',
  source:'ai_screenshot_analysis',
  scenario:'recipe_status_update',
  operations:[{
    operation_id:'REC-001',
    entity:'recipes',
    action:'upsert',
    key:{recipe_id:target.recipe_id,recipe_name:target.recipe_name},
    data:{unlocked:true,recipe_level:12,current_energy:3456,notes:'owner-observed'},
    clear_fields:[],
    evidence:{source_type:'screenshot',source_image_ref:'image-g52-001',confidence:1},
    review_required:false,
  }],
};

const workflowResult=workflow.validateWorkflow(structuredClone(payload));
assert.deepEqual(workflowResult.errors,[],'canonical recipe player-state package must pass workflow validation');
assert.deepEqual(workflowResult.review,[]);

const preview=importer.dryRun(structuredClone(payload));
assert.equal(preview.conflict_count,0);
assert.equal(preview.ready_count,1);
assert.equal(preview.changes[0].entity,'recipes');
assert.ok(['insert','update'].includes(preview.changes[0].effective_action));
assert.equal(preview.changes[0].after.recipe_id,target.recipe_id);
assert.equal(preview.changes[0].after.recipe_name,target.recipe_name,'identity copied only from Public Master');
assert.equal(preview.changes[0].after.category,target.category,'category copied only from Public Master');
assert.equal(preview.changes[0].after.total_ingredients,target.total_ingredients,'formula metadata copied only from Public Master');
assert.equal(preview.changes[0].after.unlocked,1);
assert.equal(preview.changes[0].after.recipe_level,12);
assert.equal(preview.changes[0].after.current_energy,3456);
assert.equal(preview.changes[0].after.updated_at,payload.generated_at,'recipe Dry Run must use deterministic package timestamp');

await importer.applyPayload(structuredClone(payload));
const stored=database.rows('SELECT * FROM recipes WHERE recipe_id=?',[target.recipe_id])[0];
assert.equal(stored.unlocked,1);
assert.equal(stored.recipe_level,12);
assert.equal(stored.current_energy,3456);
assert.equal(stored.notes,'owner-observed');
assert.equal(stored.recipe_name,target.recipe_name);
assert.equal(stored.category,target.category);
assert.equal(stored.total_ingredients,target.total_ingredients);
assert.equal(stored.updated_at,payload.generated_at,'Apply must persist the same deterministic after-state shown by Dry Run');

const audit=database.rows('SELECT after_json,status FROM import_changes WHERE update_id=? AND operation_index=0',[payload.update_id])[0];
assert.equal(audit.status,'applied');
assert.deepEqual(JSON.parse(audit.after_json),preview.changes[0].after,'Dry Run and Apply change-set must be identical');
assert.deepEqual(database.rows('SELECT * FROM recipe_master WHERE recipe_id=?',[target.recipe_id])[0],masterBefore,'player-state import must not mutate Public Recipe Master');
assert.throws(()=>importer.dryRun(structuredClone(payload)),/update_id 已套用/,'duplicate update_id must fail closed');

const correction=structuredClone(payload);
correction.update_id='G52-STATE-002';
correction.generated_at='2026-10-04T16:01:00.000Z';
correction.operations[0].data={unlocked:false,recipe_level:13,current_energy:4567};
delete correction.operations[0].data.notes;
correction.operations[0].clear_fields=['notes'];
const correctionPreview=importer.dryRun(correction);
assert.equal(correctionPreview.conflict_count,0);
await importer.applyPayload(correction);
const corrected=database.rows('SELECT * FROM recipes WHERE recipe_id=?',[target.recipe_id])[0];
assert.equal(corrected.unlocked,0,'new update_id may precisely correct player state');
assert.equal(corrected.recipe_level,13);
assert.equal(corrected.current_energy,4567);
assert.equal(corrected.notes,null,'explicit clear may clear only allowlisted player-state metadata');

for(const forbiddenField of ['recipe_name','category','total_ingredients','ingredients','formula']){
  const bad=structuredClone(payload);
  bad.update_id=`G52-FORBIDDEN-${forbiddenField}`;
  bad.operations[0].data={[forbiddenField]:'tamper'};
  const result=workflow.validateWorkflow(bad);
  assert.ok(result.errors.some(message=>message.includes(`data.${forbiddenField}`)),`workflow must reject recipe master field ${forbiddenField}`);
  assert.throws(()=>importer.dryRun(bad),/不屬於玩家狀態/,`Importer must reject recipe master field ${forbiddenField}`);
}

const badClear=structuredClone(payload);
badClear.update_id='G52-BAD-CLEAR';
badClear.operations[0].data={};
badClear.operations[0].clear_fields=['unlocked'];
assert.ok(workflow.validateWorkflow(badClear).errors.some(message=>message.includes('clear_fields 不允許 unlocked')));
assert.throws(()=>importer.dryRun(badClear),/clear_fields 不允許 unlocked/);

for(const action of ['insert','update','archive','delete']){
  const bad=structuredClone(payload);
  bad.update_id=`G52-BAD-ACTION-${action}`;
  bad.operations[0].action=action;
  assert.ok(workflow.validateWorkflow(bad).errors.some(message=>message.includes('recipes 玩家狀態只允許 upsert')));
  assert.throws(()=>importer.dryRun(bad),/recipes 玩家狀態只允許 upsert/);
}

const mismatch=structuredClone(payload);
mismatch.update_id='G52-MISMATCH';
mismatch.operations[0].key={recipe_id:target.recipe_id,recipe_name:other.recipe_name};
const mismatchPreview=importer.dryRun(mismatch);
assert.equal(mismatchPreview.conflict_count,1);
assert.match(mismatchPreview.changes[0].message,/recipe_id\/name 不一致/);

const unknownId=structuredClone(payload);
unknownId.update_id='G52-UNKNOWN-ID';
unknownId.operations[0].key={recipe_id:'recipe-does-not-exist'};
const unknownIdPreview=importer.dryRun(unknownId);
assert.equal(unknownIdPreview.conflict_count,1);
assert.match(unknownIdPreview.changes[0].message,/找不到公版料理 recipe_id/);
assert.equal(database.scalar('SELECT COUNT(*) FROM recipes WHERE recipe_id=?',['recipe-does-not-exist']),0);

const unknownName=structuredClone(payload);
unknownName.update_id='G52-UNKNOWN-NAME';
unknownName.operations[0].key={recipe_name:'不存在的料理名稱'};
const unknownNamePreview=importer.dryRun(unknownName);
assert.equal(unknownNamePreview.conflict_count,1);
assert.match(unknownNamePreview.changes[0].message,/找不到公版料理/);

const safeAlias=database.rows("SELECT a.alias_value,a.recipe_id,m.recipe_name FROM recipe_master_alias a JOIN recipe_master m ON m.recipe_id=a.recipe_id WHERE a.is_auto_replace_safe=1 AND a.alias_type='legacy_recipe_name' ORDER BY a.alias_value LIMIT 1")[0]||null;
if(safeAlias){
  const aliasPayload=structuredClone(payload);
  aliasPayload.update_id='G52-SAFE-ALIAS';
  aliasPayload.operations[0].key={recipe_name:safeAlias.alias_value};
  aliasPayload.operations[0].data={unlocked:true};
  const aliasPreview=importer.dryRun(aliasPayload);
  assert.equal(aliasPreview.conflict_count,0,'approved unique Public Master alias must resolve');
  assert.equal(aliasPreview.changes[0].key.recipe_id,safeAlias.recipe_id);
}

console.log(JSON.stringify({
  gate:'G5_2_CANONICAL_RECIPE_STATE_JSON_IMPORT_HARDENING',
  status:'PASS',
  canonical_master_revalidation:true,
  player_state_only:['unlocked','recipe_level','current_energy','notes'],
  recipe_actions:['upsert'],
  public_master_mutation:false,
  duplicate_update_id_fail_closed:true,
  dry_run_apply_parity:true,
  unmatched_fail_closed:true,
  mismatched_id_name_fail_closed:true,
  approved_alias_resolution:Boolean(safeAlias),
},null,2));
