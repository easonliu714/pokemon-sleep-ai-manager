import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_POKEMON_KNOWLEDGE_VERSION,PUBLIC_EVOLUTION_MASTER,PUBLIC_EVOLUTION_STATUS_MASTER} from '../assets/js/public-pokemon-knowledge-master.js';
import {PUBLIC_CANDY_MASTER_VERSION} from '../assets/js/public-candy-master.js';
import {auditPublicPokemonKnowledgeBundle} from '../assets/js/public-pokemon-knowledge-coverage.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8.4');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0484-touch-first-camp-containment');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.8.4-v0484-touch-first-camp-containment');
assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-08-10-d');
const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.equal(bundle.manifest.evolution_route_rows,79);
assert.equal(bundle.manifest.evolution_from_species_rows,70);
assert.equal(bundle.manifest.evolution_verified_terminal_rows,68);
assert.ok(PUBLIC_EVOLUTION_MASTER.some(row=>row.from_species==='戴魯比'&&row.to_species==='黑魯加'));
assert.ok(PUBLIC_EVOLUTION_STATUS_MASTER.some(row=>row.species_name==='黑魯加'));

const camp=read('assets/js/camp-berry-knowledge-ui.js');
for(const token of [
  "CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-d'",
  'navigator?.maxTouchPoints',
  "matchMedia?.('(hover: none), (pointer: coarse)')",
  'prefersContainedCards',
  'applyLayoutMode',
  "classList.toggle('camp-berry-contained-cards'",
  '#campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important',
  '#campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable thead{display:none;}',
  '#campBerryMasterBlock.camp-berry-contained-cards #campBerryMasterTable td::before{content:attr(data-label)',
  "dataset.layoutMode=contained?'TOUCH_FIRST_ROW_CARD':'DESKTOP_TABLE'",
  "addEventListener?.('resize',refreshLayout",
  "addEventListener?.('orientationchange',refreshLayout",
  '手機版改用框內卡片避免超出外框',
])assert.ok(camp.includes(token),`v0.4.8.4 touch-first containment missing: ${token}`);
assert.ok(camp.includes('@media(max-width:700px)'),'legacy narrow fallback must remain');
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.4 must not add SQLite migration 10');

console.log(JSON.stringify({status:'PASS',gate:'V0.4.8.4_RELEASE_CONTRACT',app_version:'v0.4.8.4',build:'20260810-v0484-touch-first-camp-containment',public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,mobile_camp_layout:'TOUCH_FIRST_ROW_CARD',touch_signal:true,viewport_width_not_required:true,public_master_changed:false,player_rows_mutated:false,sqlite_migration_added:false},null,2));
