// G265 canonical Legacy Direct Writer: analysis-confirmation-workbench.js::applyConfirmed().
// Source-bound, disposable SQL.js VM sessions with synthetic existing Pokémon only.
// Reproduces two acknowledged analysis confirmations where stale full-image persist erases
// a different tab's committed evidence, ingredient, subskill and history.
// Expected UNSAFE negative PASS; never wire this fixture to production/player data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import initSqlJs from 'sql.js';

const source=fs.readFileSync(new URL('../assets/js/analysis-confirmation-workbench.js',import.meta.url),'utf8');
function exactSlice(start,end){
  assert.equal(source.split(start).length,2,'production start boundary changed: '+start);
  assert.equal(source.split(end).length,2,'production end boundary changed: '+end);
  return source.slice(source.indexOf(start),source.indexOf(end));
}
const writer=exactSlice('async function applyConfirmed(', '\nfunction activateGroup(');
for(const marker of [/await snapshot\(/,/begin\(\)/,/UPDATE pokemon SET/,/pokemon_subskills/,/pokemon_ingredients/,/writeObservation\(/,/INSERT INTO pokemon_history/,/commit\(\);await persist\(\)/])
  assert.match(writer,marker,'must execute unchanged production confirmation writer');
assert.doesNotMatch(writer,/runSqliteWriteSession|createSqliteCrossTabWriteAdmission|navigator\.locks/);
const helpers=[
  exactSlice('const text=', 'const meaningful='),
  exactSlice('const meaningful=', 'const objectText='),
  exactSlice('function canonical(', 'function canonicalBadge('),
  exactSlice('function dispatchConfirmationTerminal(', 'function navigationState('),
  exactSlice('function patchValue(', 'function observationId('),
  exactSlice('function observationId(', 'function writeObservation('),
  exactSlice('function writeObservation(', 'async function applyConfirmed(')
].join('\n');
console.log('PASS G265_ANALYSIS_CONFIRMATION_CANONICAL_EXACT_LEGACY_APPLY_WRITER_SOURCE_BOUND');

const SQL=await initSqlJs();
const seed=new SQL.Database();
const columnMatch=writer.match(/const columns=(\[[^\]]+\]);/);
assert.ok(columnMatch,'production field inventory changed');
const productionColumns=vm.runInNewContext('('+columnMatch[1]+')');
const extra=['pokemon_id','pokemon_instance_id','status','current_species','original_species','original_label','identity_confidence','last_updated_at','source_update_id','field_evidence_json','source_image_refs_json','identity_review_required'];
const all=[...new Set([...extra,...productionColumns])];
seed.run('CREATE TABLE pokemon('+all.map(name=>'"'+name+'" TEXT').join(',')+',PRIMARY KEY(pokemon_id))');
seed.run('CREATE TABLE pokemon_subskills(pokemon_id TEXT,unlock_level INTEGER,subskill_name TEXT,is_unlocked INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_ingredients(pokemon_id TEXT,unlock_level INTEGER,ingredient_name TEXT,quantity INTEGER,PRIMARY KEY(pokemon_id,unlock_level))');
seed.run('CREATE TABLE pokemon_analysis_observation(observation_id TEXT PRIMARY KEY,pokemon_id TEXT,identity_group_key TEXT,source_image_ref TEXT,analysis_id TEXT,revision_no INTEGER,observed_json TEXT,canonical_json TEXT,conflict_json TEXT,created_at TEXT,applied_at TEXT)');
seed.run('CREATE TABLE pokemon_history(pokemon_id TEXT,event_at TEXT,event_type TEXT,before_json TEXT,after_json TEXT,reason TEXT,source_update_id TEXT)');
seed.run('CREATE TABLE canonical_term(term_id TEXT,entity_type TEXT,canonical_name_zh_tw TEXT,is_active INTEGER)');
seed.run('CREATE TABLE canonical_term_alias(term_id TEXT,alias_text TEXT,locale TEXT,is_auto_replace_safe INTEGER)');
seed.run('CREATE TABLE synthetic_public_master(id TEXT PRIMARY KEY,value TEXT NOT NULL)');
seed.run("INSERT INTO canonical_term VALUES('ingredient-fixture','ingredient','SyntheticIngredient',1),('subskill-fixture','subskill','SyntheticSubskill',1)");
seed.run("INSERT INTO pokemon(pokemon_id,status,species,nickname,source_image_refs_json,field_evidence_json) VALUES('synthetic_A','active','Synthetic_A','baseline_A','[]','{}'),('synthetic_B','active','Synthetic_B','baseline_B','[]','{}')");
seed.run("INSERT INTO synthetic_public_master VALUES('public','IMMUTABLE')");
let durable=new Uint8Array(seed.export());seed.close();

const rowObjects=(db,sql,params=[])=>{
  const result=db.exec(sql,params);
  if(!result.length)return [];
  return result[0].values.map(values=>Object.fromEntries(result[0].columns.map((name,i)=>[name,values[i]])));
};
const scalar=(db,sql)=>db.exec(sql)[0].values[0][0];
let releaseFirst,signalFirst;
const firstPersistEntered=new Promise(resolve=>{signalFirst=resolve;});
let acknowledgments=0,snapshots=0,rollbackCalls=0,successfulUi=0,successEvents=0;
function makeTab(label,hold){
  const local=new SQL.Database(new Uint8Array(durable));
  const pokemonId='synthetic_'+label;
  const revision={analysis_id:'synthetic-analysis-'+label,revision_no:1,source_image_ref:'synthetic-image-'+label};
  const draft={
    species:'Synthetic_'+label,nickname:'confirmed_'+label,level:30,sp:1234,confidence:0.95,
    source_refs:['synthetic-source-'+label],field_evidence:{level:'synthetic-review-'+label},
    ingredients:[{unlock_level:1,ingredient_name:'SyntheticIngredient',quantity:2}],
    subskills:[{unlock_level:10,subskill_name:'SyntheticSubskill',is_unlocked:true}],conflicts:[]
  };
  const status={className:'notice',textContent:''};
  const emitted=[];
  const root={
    querySelector:selector=>{
      if(selector==='#analysisConfirmationStatus')return status;
      if(selector==='input[name="analysisTarget"]:checked')return {value:'existing'};
      if(selector==='#analysisExistingPokemon')return {value:pokemonId};
      return {disabled:false};
    },
    querySelectorAll:()=>[]
  };
  const context=vm.createContext({
    __draft:draft,__root:root,
    rows:(sql,params=[])=>rowObjects(local,sql,params),
    run:(sql,params=[])=>local.run(sql,params),
    begin:()=>local.run('BEGIN IMMEDIATE'),
    commit:()=>local.run('COMMIT'),
    rollback:()=>{rollbackCalls++;try{local.run('ROLLBACK');}catch{}},
    snapshot:async reason=>{
      assert.equal(reason,'before_analysis_confirmation_'+revision.analysis_id);
      snapshots++;return {status:'SYNTHETIC_ONLY'};
    },
    persist:async()=>{
      const bytes=new Uint8Array(local.export());
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;signalFirst();});
      durable=bytes;acknowledgments++;
    },
    ensureRoot:()=>root,
    readDraft:()=>draft,
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    dispatchEvent:event=>{emitted.push(event);successEvents++;return true;},
    console
  });
  vm.runInContext('let currentRevision='+JSON.stringify(revision)+';\nlet currentGroupId='+JSON.stringify('synthetic-group-'+label)+';\nconst makeId=()=>'+JSON.stringify('synthetic-generated-'+label)+';\n'+helpers+'\n'+writer+'\nglobalThis.__apply=applyConfirmed;',context,{timeout:5000});
  return {
    apply:async()=>{
      await context.__apply();
      assert.equal(status.className,'notice success',status.textContent);
      assert.match(status.textContent,/已疊加更新/);
      assert.equal(emitted.filter(e=>e.type==='pokemon-sleep:analysis-confirmed-applied').length,1);
      assert.equal(emitted.filter(e=>e.type==='pokemon-sleep:analysis-confirmation-terminal').length,1);
      successfulUi++;
    },
    close:()=>local.close()
  };
}
const first=makeTab('A',true);
const pending=first.apply();
await firstPersistEntered;
assert.equal(acknowledgments,0,'A must not ACK before its held durable write');
const second=makeTab('B',false);
await second.apply();
assert.equal(acknowledgments,1,'B must ACK its durable image');
let reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_B'"),'confirmed_B');
assert.equal(scalar(reloaded,"SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_B'"),'analysis:synthetic-analysis-B');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='synthetic_B'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_B'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_analysis_observation WHERE pokemon_id='synthetic_B'"),1);
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B' AND event_type='analysis_sparse_patch_update'"),1);
reloaded.close();

releaseFirst();
await pending;
assert.equal(acknowledgments,2,'both uncoordinated Legacy confirmations ACK');
assert.equal(snapshots,2);
assert.equal(successfulUi,2);
assert.equal(successEvents,4);
assert.equal(rollbackCalls,0);
reloaded=new SQL.Database(durable);
assert.equal(scalar(reloaded,"SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_A'"),'confirmed_A');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_A'"),1);
assert.equal(scalar(reloaded,"SELECT nickname FROM pokemon WHERE pokemon_id='synthetic_B'"),'baseline_B','B acknowledged nickname lost');
assert.equal(scalar(reloaded,"SELECT source_update_id FROM pokemon WHERE pokemon_id='synthetic_B'"),null,'B acknowledged provenance lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_ingredients WHERE pokemon_id='synthetic_B'"),0,'B acknowledged ingredient lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_subskills WHERE pokemon_id='synthetic_B'"),0,'B acknowledged subskill lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_analysis_observation WHERE pokemon_id='synthetic_B'"),0,'B acknowledged observation lost');
assert.equal(scalar(reloaded,"SELECT COUNT(*) FROM pokemon_history WHERE pokemon_id='synthetic_B'"),0,'B acknowledged history lost');
assert.equal(scalar(reloaded,"SELECT value FROM synthetic_public_master WHERE id='public'"),'IMMUTABLE');
reloaded.close();first.close();second.close();
console.log('PASS G265_ANALYSIS_CONFIRMATION_TWO_ACK_STALE_REVIEW_OBSERVATION_CHILD_HISTORY_LOST_NEGATIVE');
console.log('HOLD G265_ANALYSIS_CONFIRMATION_LEGACY_UNADMITTED_NO_ANDROID_OWNER_DOD');
