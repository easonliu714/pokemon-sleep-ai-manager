import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_EVOLUTION_STATUS_MASTER,
} from '../assets/js/public-pokemon-knowledge-master.js';
import {
  EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,
  auditPublicPokemonKnowledgeBundle,
} from '../assets/js/public-pokemon-knowledge-coverage.js';
import {PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};
const version=read('assets/js/version-authority.js');
const currentVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const currentBuild=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const currentCache=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(currentVersion,'v0.4.8.2'),true,`historical v0.4.8.2 contract cannot run on older release: ${currentVersion}`);
if(currentVersion==='v0.4.8.2'){
  assert.equal(currentBuild,'20260810-v0482-evolution-coverage-evidence-diagnostic');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.8.2-v0482-evolution-coverage-evidence-diagnostic');
}

assert.match(PUBLIC_POKEMON_KNOWLEDGE_VERSION,/^pokemon-knowledge-/);
assert.match(PUBLIC_CANDY_MASTER_VERSION,/^public-candy-master-/);
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,'pokemon-sleep-evolution-coverage-diagnostic/1.0');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,'data-evo1-evolution-coverage-diagnostic-2026-08-10-a');

const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.ok(bundle.manifest.evolution_route_rows>=78);
assert.ok(bundle.manifest.evolution_from_species_rows>=69);
assert.ok(bundle.manifest.evolution_verified_terminal_rows>=67);

const route=(from,to)=>PUBLIC_EVOLUTION_MASTER.find(row=>row.from_species===from&&row.to_species===to);
for(const [from,to] of [
  ['可達鴨','哥達鴨'],
  ['猛火猴','烈焰猴'],
  ['毒電嬰','顫弦蠑螈（高調的樣子）'],
  ['毒電嬰','顫弦蠑螈（低調的樣子）'],
])assert.ok(route(from,to),`v0.4.8.2 route missing: ${from} -> ${to}`);
const terminal=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name));
for(const species of ['老翁龍','拉帝亞斯','拉帝歐斯','花療環環','信使鳥','穿山王','烈焰猴','達克萊伊','夢幻'])assert.ok(terminal.has(species),`v0.4.8.2 terminal evidence missing: ${species}`);
const outgoing=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>row.from_species));
for(const species of terminal)assert.equal(outgoing.has(species),false,`outgoing/terminal collision: ${species}`);

const candyNames=new Set(buildPublicCandyMasterRows().map(row=>row.candy_name));
assert.ok(candyNames.has('顫弦蠑螈（高調的樣子）的糖果'));
assert.ok(candyNames.has('顫弦蠑螈（低調的樣子）的糖果'));
assert.equal(candyNames.has('顫弦蠑螈(高調的樣子)的糖果'),false,'release must preserve canonical zh-TW full-width punctuation');

const coverage=read('assets/js/public-pokemon-knowledge-coverage.js');
for(const token of ['buildEvolutionCoverageDiagnostic','count_list_parity','partition_parity','species_names_only:true'])assert.ok(coverage.includes(token),`diagnostic release token missing: ${token}`);
const ui=read('assets/js/v03993-public-knowledge-coverage-ui.js');
for(const token of ['複製 Evolution Coverage 診斷 JSON','UNKNOWN count/list parity','三態 partition parity'])assert.ok(ui.includes(token),`diagnostic UI token missing: ${token}`);
const candy=read('assets/js/public-candy-master.js');
for(const token of ['displayText','normalizeKey','must never be','canonical full-width'])assert.ok(candy.includes(token),`Candy punctuation guard missing: ${token}`);

const migrations=read('assets/js/migrations.js');
assert.ok(migrations.includes("if(force||applied.pokemon_knowledge!==expected.pokemon_knowledge){applyPublicPokemonKnowledgeData(db);updated.push('pokemon_knowledge');}"),'existing DB must sync changed public Pokémon knowledge by authority version');
assert.ok(migrations.includes("if(force||applied.candy!==expected.candy||updated.includes('shared')||updated.includes('pokemon_knowledge'))"),'Candy Master must resync when Pokémon knowledge changes');
assert.equal(migrations.includes('VALUES(10,'),false,'v0.4.8.2 historical behavior must remain migration-10 free');

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes("url.pathname.endsWith('.js')"));
assert.ok(sw.includes('caches.open(CACHE).then(cache=>cache.put(event.request,copy))'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.8.2_RELEASE_HISTORICAL_CONTRACT',
  current_app_version:currentVersion,
  exact_release_authority_enforced:currentVersion==='v0.4.8.2',
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  minimum_evolution_routes:78,
  minimum_outgoing_species:69,
  minimum_verified_terminal_species:67,
  diagnostic_copy_json:true,
  exact_count_list_parity_contract:true,
  canonical_zh_tw_punctuation_preserved:true,
  public_master_sync_existing_db:true,
  sqlite_migration_added:false,
},null,2));
