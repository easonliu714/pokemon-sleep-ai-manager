import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_POKEMON_KNOWLEDGE_VERSION,PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER} from '../assets/js/public-pokemon-knowledge-master.js';
import {PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from '../assets/js/public-candy-master.js';
import {auditPublicPokemonKnowledgeBundle} from '../assets/js/public-pokemon-knowledge-coverage.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const build=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
const publicSpeciesAuthoritySuccessor=atLeast(app,'v0.4.27.47');
const candyGapIdentitySuccessor=atLeast(app,'v0.4.27.52');
assert.equal(atLeast(app,'v0.4.8.4'),true,`historical v0.4.8.4 contract cannot run on older release: ${app}`);
if(app==='v0.4.8.4'){
  assert.equal(build,'20260810-v0484-touch-first-camp-containment');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.8.4-v0484-touch-first-camp-containment');
}
assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
const expectedCandyMasterVersion=candyGapIdentitySuccessor?'public-candy-master-2026-09-01-f':publicSpeciesAuthoritySuccessor?'public-candy-master-2026-08-29-e':'public-candy-master-2026-08-10-d';
assert.equal(PUBLIC_CANDY_MASTER_VERSION,expectedCandyMasterVersion);
if(candyGapIdentitySuccessor){
  assert.ok(version.includes("// app_version: 'v0.4.27.51'"),'v0.4.27.52+ must retain .51 predecessor bridge');
  assert.ok(buildPublicCandyMasterRows().some(row=>row.candy_name==='小火焰猴的糖果'),'v0.4.27.52+ targeted Chimchar Candy candidate must remain');
}
const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.ok(bundle.manifest.evolution_route_rows>=79);
assert.ok(bundle.manifest.evolution_from_species_rows>=70);
assert.ok(bundle.manifest.evolution_verified_terminal_rows>=68);
assert.ok(PUBLIC_EVOLUTION_MASTER.some(row=>row.from_species==='戴魯比'&&row.to_species==='黑魯加'));
assert.ok(PUBLIC_EVOLUTION_STATUS_MASTER.some(row=>row.species_name==='黑魯加'));

const camp=read('assets/js/camp-berry-knowledge-ui.js');
assert.ok(camp.includes('#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}'),'Camp Berry outer containment must remain');
assert.ok(camp.includes('camp-berry-scroll'),'contained scroll wrapper must remain');
let mobileCampLayout='UNKNOWN';
if(app==='v0.4.8.4'){
  for(const token of [
    "CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-d'",
    'navigator?.maxTouchPoints',
    "matchMedia?.('(hover: none), (pointer: coarse)')",
    'prefersContainedCards',
    'applyLayoutMode',
    "classList.toggle('camp-berry-contained-cards'",
    '#campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important',
    "dataset.layoutMode=contained?'TOUCH_FIRST_ROW_CARD':'DESKTOP_TABLE'",
  ])assert.ok(camp.includes(token),`exact v0.4.8.4 touch-first containment missing: ${token}`);
  mobileCampLayout='TOUCH_FIRST_ROW_CARD';
}else{
  for(const token of [
    "CAMP_BERRY_MOBILE_CONTAINMENT='COMPACT_CONTAINED_TABLE'",
    'overflow-x:auto!important',
    '#campBerryMasterTable{width:100%;min-width:640px;max-width:100%;table-layout:fixed',
    'margin-left:0!important;margin-right:0!important',
  ])assert.ok(camp.includes(token),`successor compact containment missing: ${token}`);
  assert.equal(camp.includes('camp-berry-contained-cards'),false,'successor compact table must not regress to five-line row cards');
  mobileCampLayout='COMPACT_CONTAINED_TABLE';
}
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.4+ must not add SQLite migration 10');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.8.4_HISTORICAL_CONTAINMENT',current_app_version:app,mobile_camp_layout:mobileCampLayout,outer_containment:true,public_species_authority_successor:publicSpeciesAuthoritySuccessor,candy_gap_identity_successor:candyGapIdentitySuccessor,public_master_changed:candyGapIdentitySuccessor,player_rows_mutated:false,sqlite_migration_added:false},null,2));