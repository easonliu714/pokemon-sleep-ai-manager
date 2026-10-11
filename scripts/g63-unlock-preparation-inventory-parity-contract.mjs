import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildRecipeUnlockPreparation,targetPokemonScoreRows} from '../assets/js/recipe-unlock-preparation.js';
import {projectRecipePortfolioContention} from '../assets/js/recipe-portfolio-contention.js';
const verified={lifecycle:'ACTIVE',formula_evidence:'REFERENCE_VERIFIED',pot_fit:true,pot_capacity:63,pot_required:20,hard_constraint_status:'PASS'};
const ingredients=[{ingredient_name:'哞哞鮮奶',required:5,safe_reserve:2},{ingredient_name:'特選蘋果',required:3,safe_reserve:0}];
const locked={...verified,recipe_id:'locked',recipe_name:'未解鎖目標',unlocked:false,player_record_exists:true,candidate_status:'UNLOCK_CANDIDATE_READY',requirements:ingredients.map(x=>({...x})),current_energy:99,base_energy:50};
const known={...locked,recipe_id:'known',recipe_name:'已解鎖料理',unlocked:true,candidate_status:'COOK_NOW_UNLOCKED',current_energy:999};
const unknown={...locked,recipe_id:'unconfirmed',recipe_name:'未確認狀態',player_record_exists:false};
const inventory=[{ingredient_name:'哞哞鮮奶',quantity:12},{ingredient_name:'特選蘋果',quantity:9}];
const params={recipeStrategy:{input_fingerprint:'synthetic',candidates:[known,locked,unknown]},inventory,objective:'unlock_recipes',maxMeals:1};
const plans=projectRecipePortfolioContention(params);
assert.equal(plans.projection_status,'READY');
assert.equal(plans.summary.individually_ready_count,3);
assert.equal(plans.summary.recommendation_candidate_count,1,'unlocked/unknown status cannot be a discovery recommendation');
assert.equal(plans.alternatives[0].steps[0].recipe_id,'locked');
assert.equal(plans.alternatives[0].unlock_count,1);
assert.equal(known.requirements[0].required,5);
const onlyKnown=projectRecipePortfolioContention({...params,recipeStrategy:{candidates:[known]},objective:'unlock_recipes'});
assert.equal(onlyKnown.alternatives.length,0,'no discoverable target must not backfill known low-energy meal');
const cookKnown=projectRecipePortfolioContention({...params,recipeStrategy:{candidates:[known]},objective:'maximize_verified_energy'});
assert.equal(cookKnown.alternatives[0].steps[0].recipe_id,'known','normal cooking remains available in other objectives');
const prep=buildRecipeUnlockPreparation({candidates:[known,locked,unknown],inventory});
assert.equal(prep.summary.target_count,2);
assert.equal(prep.selected.recipe_id,'locked');
assert.equal(prep.selected.stage,'READY_FOR_IN_GAME_PREVIEW');
assert.equal(prep.targets.find(x=>x.recipe_id==='unconfirmed').stage,'REVIEW_UNLOCK_STATE');
assert.equal(prep.targets.find(x=>x.recipe_id==='locked').requirements[0].available,10);
const shortage=buildRecipeUnlockPreparation({candidates:[locked],inventory:[{ingredient_name:'哞哞鮮奶',quantity:4},{ingredient_name:'特選蘋果',quantity:1}]});
assert.equal(shortage.selected.stage,'NEEDS_INGREDIENTS');
assert.equal(shortage.selected.known_deficit_total,5,'shortage is calculated against usable stock after safe reserve');
const absent=buildRecipeUnlockPreparation({candidates:[locked],inventory:[{ingredient_name:'哞哞鮮奶',quantity:12}]});
assert.equal(absent.selected.stage,'REVIEW_INVENTORY','unobserved ingredient is not confirmed 0');
assert.equal(absent.selected.requirements.find(x=>x.ingredient_name==='特選蘋果').deficit,null);
assert.equal(absent.selected.unknown_ingredient_count,1);
const scored=targetPokemonScoreRows({target:shortage.selected,pokemonCandidates:[
 {pokemon_id:'1',weekly_ingredient_demand_covered:0},{pokemon_id:'2',weekly_ingredient_demand_covered:99}],pokemonFeatures:[
 {pokemon_id:'1',unlocked_ingredients:[{ingredient_name:'哞哞鮮奶'},{ingredient_name:'特選蘋果'}]},
 {pokemon_id:'2',unlocked_ingredients:[{ingredient_name:'暖暖薑'}]}]});
assert.equal(scored[0].recipe_target_ingredient_coverage,2);
assert.equal(scored[1].recipe_target_ingredient_coverage,0,'unrelated weekly coverage must not substitute target deficit coverage');
const uc=fs.readFileSync('assets/js/unified-screenshot-update-center.js','utf8');
const publicWork=fs.readFileSync('assets/js/public-catalog-workbench.js','utf8');
const stats=fs.readFileSync('assets/js/v03992-update-center-guided-ux.js','utf8');
const ui=fs.readFileSync('assets/js/war-room-cooking-planner-ui.js','utf8');
const version=fs.readFileSync('assets/js/version-authority.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
assert.match(uc,/for\(const entity of UC_IMG_A_SCENARIOS\[key\]\.entities\)window\.dispatchEvent/,'UC.IMG must emit explicit affected entity');
assert.match(publicWork,/runtime\.prewarmed\.delete\(view\)/,'local projection cache invalidation is mandatory');
assert.match(stats,/COUNT\(\*\) FROM ingredient_inventory/);
assert.match(stats,/SUM\(quantity\)/);
assert.match(ui,/未解鎖料理／精確缺料／專用補貨/);
assert.match(ui,/遊戲內預覽/);
assert.match(ui,/data-g63-target-recipe/);
assert.match(ui,/step\.unlock_opportunity\?/,'feedback cannot appear on already-unlocked meals');
assert.match(sw,/recipe-unlock-preparation\.js/,'offline precache required');
assert.match(version,/app_version: 'v0\.4\.27\.55\.3\.3\.20'/);
assert.match(version,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.19'/);

// Deterministic SQLite read-back parity: reproduce the owner's stale 19/187/12/7
// prewarm and the applied 19/254/17/2 state using the actual production view SQL.
// This fixture is isolated in a temporary SQLite file; no player database is touched.
const sharedSchemaSource=fs.readFileSync('assets/js/shared-master-schema.js','utf8');
const actualIngredientViewSql=sharedSchemaSource.match(/db\.run\(ingredientUnlockProjection\?\x60([\s\S]*?)\x60:\x60/)?.[1];
assert.ok(actualIngredientViewSql,'production ingredient_catalog_state view SQL must be available');
const fixtureDir=fs.mkdtempSync(join(tmpdir(),'g63-ingredient-parity-'));
let fixtureDb=null;
try{
  const fixturePath=join(fixtureDir,'player.sqlite');
  fixtureDb=new DatabaseSync(fixturePath);
  fixtureDb.exec('CREATE TABLE ingredient_master(ingredient_name TEXT PRIMARY KEY,data_version TEXT); CREATE TABLE ingredient_inventory(ingredient_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL,unlocked INTEGER,updated_at TEXT,source_update_id TEXT)');
  fixtureDb.exec(actualIngredientViewSql);
  const beforeQty=[22,...Array(11).fill(15),...Array(7).fill(0)];
  const appliedQty=[30,...Array(16).fill(14),0,0];
  const masterInsert=fixtureDb.prepare('INSERT INTO ingredient_master(ingredient_name,data_version) VALUES (?,?)');
  const playerInsert=fixtureDb.prepare('INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at) VALUES (?,?,?,?)');
  for(let i=0;i<19;i++){
    const name='fixture_'+String(i).padStart(2,'0');
    masterInsert.run(name,'fixture');
    playerInsert.run(name,beforeQty[i],beforeQty[i]>0?1:0,'2026-10-11T00:00:00Z');
  }
  const parity=()=>{
    const scalarSql=sql=>Number(fixtureDb.prepare(sql).get().value);
    const cards={
      kinds:scalarSql('SELECT COUNT(*) AS value FROM ingredient_inventory'),
      total:scalarSql('SELECT COALESCE(SUM(quantity),0) AS value FROM ingredient_inventory'),
      stocked:scalarSql('SELECT COUNT(*) AS value FROM ingredient_inventory WHERE quantity>0'),
    };
    cards.zero=cards.kinds-cards.stocked;
    const tableRows=fixtureDb.prepare('SELECT * FROM ingredient_catalog_state ORDER BY ingredient_name').all();
    const table={kinds:tableRows.length,total:tableRows.reduce((sum,row)=>sum+Number(row.quantity),0),stocked:tableRows.filter(row=>Number(row.quantity)>0).length};
    table.zero=table.kinds-table.stocked;
    assert.deepEqual(table,cards,'summary cards and ingredient detail must share live SQLite read-back');
    return {cards,tableRows};
  };
  const prior=parity();
  assert.deepEqual(prior.cards,{kinds:19,total:187,stocked:12,zero:7});
  fixtureDb.exec('BEGIN');
  const playerUpdate=fixtureDb.prepare('UPDATE ingredient_inventory SET quantity=? WHERE ingredient_name=?');
  for(let i=0;i<19;i++)playerUpdate.run(appliedQty[i],'fixture_'+String(i).padStart(2,'0'));
  fixtureDb.exec('COMMIT');
  assert.equal(prior.tableRows.reduce((sum,row)=>sum+Number(row.quantity),0),187,'prewarmed snapshot must demonstrate stale source');
  const after=parity();
  assert.deepEqual(after.cards,{kinds:19,total:254,stocked:17,zero:2});
  assert.match(uc,/for\(const entity of UC_IMG_A_SCENARIOS\[key\]\.entities\)window\.dispatchEvent/,'post-apply must emit entity-specific change');
  assert.match(publicWork,/runtime\.localRevision\[view\]=\(runtime\.localRevision\[view\]\|\|0\)\+1/,'renderKey must change on local inventory update');
  assert.match(publicWork,/runtime\.prewarmed\.delete\(view\)/,'old table prewarm must be invalidated');
  fixtureDb.close();fixtureDb=null;
  fixtureDb=new DatabaseSync(fixturePath);
  assert.deepEqual(parity().cards,after.cards,'SQLite reload must retain post-apply values without manual Save');
}finally{
  if(fixtureDb)fixtureDb.close();
  fs.rmSync(fixtureDir,{recursive:true,force:true});
}

console.log(JSON.stringify({status:'PASS',gate:'G6_RESCOPED_UNLOCK_TARGET_INVENTORY_PARITY',unlock_only_verified_state:true,no_unknown_to_zero:true,no_unlocked_fallback:true,actual_game_spend_required:false,player_data_write:false,public_master_write:false,sqlite_readback_parity:true,sqlite_reload_parity:true},null,2));
