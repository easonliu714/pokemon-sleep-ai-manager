import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_EVOLUTION_STATUS_MASTER,
} from '../assets/js/public-pokemon-knowledge-master.js';
import {
  EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  buildEvolutionCoverageDiagnostic,
  auditPublicPokemonKnowledgeBundle,
} from '../assets/js/public-pokemon-knowledge-coverage.js';
import {PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const build=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(app,'v0.4.8.3'),true,`historical v0.4.8.3 contract cannot run on older release: ${app}`);
if(app==='v0.4.8.3'){
  assert.equal(build,'20260810-v0483-houndour-camp-mobile-containment');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.8.3-v0483-houndour-camp-mobile-containment');
}

assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-08-10-d');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,'pokemon-sleep-evolution-coverage-diagnostic/1.0');
const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.ok(bundle.manifest.evolution_route_rows>=79);
assert.ok(bundle.manifest.evolution_from_species_rows>=70);
assert.ok(bundle.manifest.evolution_verified_terminal_rows>=68);

const route=PUBLIC_EVOLUTION_MASTER.find(row=>row.from_species==='戴魯比'&&row.to_species==='黑魯加');
assert.ok(route,'戴魯比 -> 黑魯加 route missing');
assert.equal(route.required_level,18);
assert.equal(route.required_candy,40);
assert.match(route.source_ref,/\/houndour\.shtml$/);
const terminal=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name));
assert.ok(terminal.has('黑魯加'),'黑魯加 terminal evidence missing');
const outgoing=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>row.from_species));
for(const species of terminal)assert.equal(outgoing.has(species),false,`outgoing/terminal collision: ${species}`);

const diagnostic=buildEvolutionCoverageDiagnostic([
  {pokemon_id:'PRIVATE-HOUNDOUR',current_species:'戴魯比',species:'戴魯比'},
  {pokemon_id:'PRIVATE-VENUSAUR',current_species:'妙蛙花',species:'妙蛙花'},
]);
assert.equal(diagnostic.unknown_count,0);
assert.deepEqual(diagnostic.unknown_species,[]);
assert.equal(diagnostic.count_list_parity,true);
assert.equal(diagnostic.partition_parity,true);
assert.equal(JSON.stringify(diagnostic).includes('PRIVATE-HOUNDOUR'),false,'diagnostic must not export player IDs');
const candyNames=new Set(buildPublicCandyMasterRows().map(row=>row.candy_name));
assert.ok(candyNames.has('戴魯比的糖果'));
assert.ok(candyNames.has('黑魯加的糖果'));

const camp=read('assets/js/camp-berry-knowledge-ui.js');
assert.ok(camp.includes('#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}'));
let mobileContainment='UNKNOWN';
if(app==='v0.4.8.3'){
  for(const token of [
    "CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-c'",
    '@media(max-width:700px)',
    '#campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important',
    '#campBerryMasterTable td::before{content:attr(data-label)',
  ])assert.ok(camp.includes(token),`exact v0.4.8.3 row-card token missing: ${token}`);
  mobileContainment='ROW_CARD_CONTAINED';
}else if(atLeast(app,'v0.4.8.5')){
  for(const token of [
    "CAMP_BERRY_MOBILE_CONTAINMENT='COMPACT_CONTAINED_TABLE'",
    'overflow-x:auto!important',
    '#campBerryMasterTable{width:100%;min-width:640px;max-width:100%;table-layout:fixed',
    'margin-left:0!important;margin-right:0!important',
  ])assert.ok(camp.includes(token),`v0.4.8.5+ compact containment missing: ${token}`);
  assert.equal(camp.includes('camp-berry-contained-cards'),false,'compact successor must not use five-line row cards');
  mobileContainment='COMPACT_CONTAINED_TABLE';
}else{
  for(const token of ['camp-berry-contained-cards','prefersContainedCards','applyLayoutMode'])assert.ok(camp.includes(token),`v0.4.8.4 touch-first containment missing: ${token}`);
  mobileContainment='TOUCH_FIRST_ROW_CARD';
}
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.3+ must remain migration-10 free');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.8.3_RELEASE_HISTORICAL_CONTRACT',current_app_version:app,houndour_evidence_closed:true,target_live_unknown_expected:0,mobile_containment_preserved:true,mobile_containment_strategy:mobileContainment,sqlite_migration_added:false},null,2));