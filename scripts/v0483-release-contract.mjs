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
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8.3');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0483-houndour-camp-mobile-containment');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.8.3-v0483-houndour-camp-mobile-containment');

assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-08-10-d');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,'pokemon-sleep-evolution-coverage-diagnostic/1.0');

const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.equal(bundle.manifest.evolution_route_rows,79);
assert.equal(bundle.manifest.evolution_from_species_rows,70);
assert.equal(bundle.manifest.evolution_verified_terminal_rows,68);

const route=PUBLIC_EVOLUTION_MASTER.find(row=>row.from_species==='戴魯比'&&row.to_species==='黑魯加');
assert.ok(route,'戴魯比 -> 黑魯加 route missing');
assert.equal(route.required_level,18);
assert.equal(route.required_candy,40);
assert.equal(route.required_sleep_hours,null);
assert.equal(route.required_item,null);
assert.equal(route.verified_at,'2026-08-10');
assert.match(route.source_ref,/\/houndour\.shtml$/);
const terminal=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name));
assert.ok(terminal.has('黑魯加'),'黑魯加 terminal evidence missing');
const outgoing=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>row.from_species));
for(const species of terminal)assert.equal(outgoing.has(species),false,`outgoing/terminal collision: ${species}`);

const diagnostic=buildEvolutionCoverageDiagnostic([
  {pokemon_id:'PRIVATE-HOUNDOUR',current_species:'戴魯比',species:'戴魯比',nature:'勤奮',main_skill:'能量填充M',type:'惡'},
  {pokemon_id:'PRIVATE-VENUSAUR',current_species:'妙蛙花',species:'妙蛙花',nature:'勤奮',main_skill:'活力填充S',type:'草'},
]);
assert.equal(diagnostic.observed_species_count,2);
assert.equal(diagnostic.verified_outgoing_count,1);
assert.equal(diagnostic.verified_terminal_count,1);
assert.equal(diagnostic.unknown_count,0);
assert.deepEqual(diagnostic.unknown_species,[]);
assert.equal(diagnostic.count_list_parity,true);
assert.equal(diagnostic.partition_parity,true);
assert.equal(JSON.stringify(diagnostic).includes('PRIVATE-HOUNDOUR'),false,'diagnostic must not export player IDs');

const candyNames=new Set(buildPublicCandyMasterRows().map(row=>row.candy_name));
assert.ok(candyNames.has('戴魯比的糖果'));
assert.ok(candyNames.has('黑魯加的糖果'));
assert.equal(candyNames.has('顫弦蠑螈(高調的樣子)的糖果'),false,'canonical zh-TW punctuation regression');

const camp=read('assets/js/camp-berry-knowledge-ui.js');
for(const token of [
  "CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-c'",
  '#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}',
  '#campBerryMasterTable{display:block;width:100%!important;min-width:0!important;max-width:100%!important',
  '#campBerryMasterTable thead{display:none;}',
  '#campBerryMasterTable td::before{content:attr(data-label)',
  'data-label="營地"',
  'data-label="樹果／規則"',
  '手機版改用框內卡片避免超出外框',
])assert.ok(camp.includes(token),`mobile Camp Berry containment token missing: ${token}`);

const migrations=read('assets/js/migrations.js');
assert.ok(migrations.includes("if(force||applied.pokemon_knowledge!==expected.pokemon_knowledge){applyPublicPokemonKnowledgeData(db);updated.push('pokemon_knowledge');}"));
assert.ok(migrations.includes("if(force||applied.candy!==expected.candy||updated.includes('shared')||updated.includes('pokemon_knowledge'))"));
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.8.3 must not add SQLite migration 10');

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
assert.ok(sw.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.8.3_RELEASE_CONTRACT',
  app_version:'v0.4.8.3',
  build:'20260810-v0483-houndour-camp-mobile-containment',
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  evolution_routes:79,
  outgoing_species:70,
  verified_terminal_species:68,
  houndour_evidence_closed:true,
  target_live_unknown_expected:0,
  mobile_camp_layout:'ROW_CARD_CONTAINED',
  player_rows_mutated:false,
  sqlite_migration_added:false,
},null,2));
