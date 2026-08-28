import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_MASTER_VERSION,
  PUBLIC_CANDY_FIXED_MASTER,
  SPECIES_CANDY_NAME_RULE_VERSION,
  buildPublicCandyMasterRows,
  speciesCandyName,
  parseSpeciesCandyName,
  publicPokemonNamesForCandy,
  typeCandyTargetIsKnown,
} from '../assets/js/public-candy-master.js';
import {buildScenarioTemplate,PROMPT_CATALOG} from '../assets/js/prompt-catalog.js';
import {validateWorkflow} from '../assets/js/ai-workflow.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const versionSource=read('assets/js/version-authority.js');
const currentVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const professorObservedDeltaWriter=atLeast(currentVersion,'v0.4.27.46');
const masterRows=buildPublicCandyMasterRows();
const byName=new Map(masterRows.map(row=>[row.candy_name,row]));

assert.match(PUBLIC_CANDY_MASTER_VERSION,/^public-candy-master-\d{4}-\d{2}-\d{2}-[a-z]$/,'Candy public master must remain versioned even when Pokémon-name projection expands');
assert.equal(SPECIES_CANDY_NAME_RULE_VERSION,'species-candy-name-rule-zh-tw-2026-08-10-a');
assert.ok(PUBLIC_CANDY_FIXED_MASTER.length>=10,'fixed Candy Master should contain source-verified official/game rows');
for(const name of ['萬能糖果S','萬能糖果M','火屬性的糖果S','火屬性的糖果M','水屬性的糖果S','水屬性的糖果M','飛行屬性的糖果S','飛行屬性的糖果M','幽靈屬性的糖果S','幽靈屬性的糖果M','超能力屬性的糖果S','超能力屬性的糖果M','龍屬性的糖果S']){
  assert.ok(byName.has(name),`verified fixed candy missing: ${name}`);
}
assert.ok(PUBLIC_CANDY_FIXED_MASTER.every(row=>!Object.hasOwn(row,'quantity')&&!Object.hasOwn(row,'safe_reserve')),'Public Candy Master must never contain player balances');
assert.ok(PUBLIC_CANDY_FIXED_MASTER.every(row=>row.source_ref&&row.verification_status),'every fixed candy row requires provenance');
for(const row of PUBLIC_CANDY_FIXED_MASTER.filter(row=>row.candy_type==='type'))assert.equal(typeCandyTargetIsKnown(row.target_type_name),true,`unknown public type candy target: ${row.target_type_name}`);

const pokemonNames=publicPokemonNamesForCandy();
assert.ok(pokemonNames.length>0,'Pokémon name projection source must not be empty');
const sampleSpecies=pokemonNames[0];
const sampleCandy=speciesCandyName(sampleSpecies);
assert.equal(parseSpeciesCandyName(sampleCandy),sampleSpecies,'species candy naming must round-trip');
const projected=byName.get(sampleCandy);
assert.ok(projected,'species candy must be projected from public Pokémon names');
assert.equal(projected.target_species_name,sampleSpecies);
assert.equal(projected.verification_status,'DERIVED_FROM_PUBLIC_POKEMON_CANONICAL_NAME');
assert.equal(projected.name_rule,SPECIES_CANDY_NAME_RULE_VERSION);

const template=buildScenarioTemplate('candies');
assert.equal(PROMPT_CATALOG.candies.scenario,'candy_inventory_update');
assert.equal(template.scenario,'candy_inventory_update');
assert.equal(template.operations.length,1);
assert.equal(template.operations[0].entity,'candy_inventory');
assert.equal(template.operations[0].action,'upsert');
assert.equal(template.operations[0].key.candy_name,'萬能糖果S');

const validPayload=JSON.parse(JSON.stringify(template));
validPayload.operations[0].data.quantity=0;
validPayload.operations[0].data.safe_reserve=0;
validPayload.operations[0].review_required=false;
validPayload.operations[0].user_audit.accepted_current_observation=true;
const workflow=validateWorkflow(validPayload);
assert.deepEqual(workflow.errors,[],'quantity=0 and safe_reserve=0 must remain valid candy observations');
assert.equal(workflow.summary.entity_counts.candy_inventory,1);

for(const [field,value] of [['quantity',-1],['safe_reserve',-1],['quantity',1.5]]){
  const bad=JSON.parse(JSON.stringify(validPayload));
  bad.operations[0].data[field]=value;
  assert.ok(validateWorkflow(bad).errors.some(error=>error.includes(field)),`${field}=${value} must fail validation`);
}
const deleteAttempt=JSON.parse(JSON.stringify(validPayload));
deleteAttempt.operations[0].action='delete';
assert.ok(validateWorkflow(deleteAttempt).errors.length>=1,'candy inventory delete must be blocked');
const crossScenario=JSON.parse(JSON.stringify(validPayload));
crossScenario.operations.push({operation_id:'OP-X',entity:'item_inventory',action:'upsert',key:{item_name:'寶可沙布蕾'},data:{quantity:1},review_required:false});
assert.ok(validateWorkflow(crossScenario).errors.some(error=>error.includes('不屬於 scenario=candy_inventory_update')),'candy scenario must not mutate item inventory');

const schema=read('assets/js/schema.js');
assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS candy_inventory'));
assert.ok(schema.includes('candy_id TEXT PRIMARY KEY'));
assert.equal(schema.includes("INSERT INTO candy_inventory"),false,'fresh schema must not seed player candy rows');

const migrations=read('assets/js/migrations.js');
for(const token of ['applyCandyInventoryMigration','VALUES(9,datetime(\'now\'))','PUBLIC_CANDY_MASTER_VERSION','public_candy_master_version','syncPublicCandyMaster'])assert.ok(migrations.includes(token),`migration/public authority contract missing: ${token}`);
assert.ok(migrations.includes("if(!hasMigration(db,9))"),'existing DB must receive non-destructive candy migration');

const importer=read('assets/js/importer.js');
for(const token of ["candy_inventory: ['candy_id']","operation.action !== 'upsert'","SELECT candy_id FROM candy_master WHERE candy_name=?","找不到公版糖果","!conflict && !before"])assert.ok(importer.includes(token),`guarded importer candy contract missing: ${token}`);
assert.equal(importer.includes('saveCandy'),false,'generic importer must not expose manual candy shortcut');

const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['scenario=candy_inventory_update','只代表玩家目前實際持有量','不得輸出推算後數量','不得由 AI 自造 stable ID'])assert.ok(prompt.includes(token),`Candy prompt contract missing: ${token}`);

const resource=read('assets/js/resource-context.js');
for(const token of ["CANDY_CONVERSION_RULE_STATUS='NOT_YET_VERIFIED'",'included_in_physical_totals:false','derived_options:[]','candy_catalog_state'])assert.ok(resource.includes(token),`resource double-counting guard missing: ${token}`);

const ui=read('assets/js/candy-inventory-ui.js');
for(const token of ['candy_catalog_state','buildPublicCandyMasterRows','Resource fingerprint'])assert.ok(ui.includes(token),`Candy UI contract missing: ${token}`);
assert.equal(ui.includes('saveCandy'),false,'Candy quantity UI must remain read-only');
const index=read('index.html');
assert.ok(index.includes('./assets/js/candy-inventory-ui.js'),'Candy UI module must load in browser runtime');

const professorTransfer=read('assets/js/pokemon-professor-transfer.js');
const professorTransferUi=read('assets/js/pokemon-professor-transfer-ui.js');
if(professorObservedDeltaWriter){
  for(const token of ['玩家數量可由 JSON 更新中心匯入','遊戲實際觀測糖果數量增量寫入','USER_DIRECT_OBSERVATION_ONLY','自動推算：<b>停用</b>'])assert.ok(ui.includes(token),`v0.4.27.46+ governed Candy UI token missing: ${token}`);
  for(const token of ["PROFESSOR_TRANSFER_CANDY_AUTHORITY='USER_DIRECT_OBSERVATION_ONLY'",'if(candyQuantity!==null)','quantity=candy_inventory.quantity+excluded.quantity',"inventory_mutation:candyInventoryApplied?'OBSERVED_DELTA_INCREMENT':'NO_MUTATION'",'automatic_quantity_inference:false'])assert.ok(professorTransfer.includes(token),`v0.4.27.46+ Professor observed-delta authority missing: ${token}`);
  assert.ok(professorTransferUi.includes('留空＝只完成送博士狀態，不自行猜糖果數量'),'blank Professor observation must not mutate candy inventory');
  assert.ok(index.includes('./assets/js/pokemon-professor-transfer-ui.js'),'Professor transfer UI must be loaded for the governed writer');
}else{
  assert.ok(ui.includes('玩家數量只接受 JSON 更新中心匯入'),'pre-v0.4.27.46 WAR3A must retain historical JSON-only Candy authority');
}

for(const file of ['assets/js/app.js','assets/js/backup-truth-restore.js'])assert.ok(read(file).includes("'candy_inventory'"),`${file} must include candy in JSON/verified backup scope`);

const canonical=read('assets/js/canonical-registry.js');
assert.ok(canonical.includes("['candy','candy_master','candy_name']"),'Candy terminology must join canonical registry');
const docs=read('docs/PUBLIC_MASTER_DATABASE_VERSION_CONTRACT.md');
for(const token of ['PUBLIC_CANDY_MASTER_VERSION','public_candy_master_version','candy_inventory.quantity','species candy naming','Candy Master rows contain no player quantity'])assert.ok(docs.includes(token),`normative Candy Master contract missing: ${token}`);

const manual=read('assets/js/manual-editor.js');
assert.equal(manual.includes('saveCandy'),false,'player candy quantity must not gain a parallel arbitrary manual writer');

console.log(JSON.stringify({
  status:'PASS',
  gate:'WAR3A_CANDY_INVENTORY_CONTRACT',
  current_app_version:currentVersion,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  fixed_verified_count:PUBLIC_CANDY_FIXED_MASTER.length,
  species_projection_count:masterRows.length-PUBLIC_CANDY_FIXED_MASTER.length,
  player_quantity_in_public_master:false,
  player_write_authority:professorObservedDeltaWriter?['UPDATE_CENTER_JSON','PROFESSOR_USER_DIRECT_OBSERVATION_DELTA']:'UPDATE_CENTER_JSON_ONLY',
  arbitrary_manual_candy_writer:false,
  professor_observed_delta_successor:professorObservedDeltaWriter,
  automatic_professor_reward_inference:false,
  candy_inventory_migration:9,
  physical_vs_convertible_double_count_guard:true,
  candy_conversion_rule_status:'NOT_YET_VERIFIED',
  pokemon_name_projection:true,
  unknown_candy_fail_closed:true,
  backup_scope_includes_candy:true,
},null,2));
