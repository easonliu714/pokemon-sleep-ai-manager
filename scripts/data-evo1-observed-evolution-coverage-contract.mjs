import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,
  buildEvolutionCoverageDiagnostic,
  auditPublicPokemonKnowledgeBundle,
} from '../assets/js/public-pokemon-knowledge-coverage.js';
import {
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_EVOLUTION_STATUS_MASTER,
} from '../assets/js/public-pokemon-knowledge-master.js';
import {PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}return true;};

const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(app,'v0.4.8.1'),true,`DATA.EVO.1 requires v0.4.8.1 behavior or later: ${app}`);
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,'pokemon-sleep-evolution-coverage-diagnostic/1.0');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,'data-evo1-evolution-coverage-diagnostic-2026-08-10-a');
assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-08-10-d');

const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));
assert.equal(bundle.manifest.evolution_route_rows,79);
assert.equal(bundle.manifest.evolution_from_species_rows,70);
assert.equal(bundle.manifest.evolution_verified_terminal_rows,68);

const route=(from,to)=>PUBLIC_EVOLUTION_MASTER.find(row=>row.from_species===from&&row.to_species===to);
const psyduck=route('可達鴨','哥達鴨');
assert.ok(psyduck);
assert.equal(psyduck.required_level,25);
assert.equal(psyduck.required_candy,40);
assert.equal(psyduck.verified_at,'2026-08-10');
assert.match(psyduck.source_ref,/\/psyduck\.shtml$/);

const monferno=route('猛火猴','烈焰猴');
assert.ok(monferno);
assert.equal(monferno.required_level,27);
assert.equal(monferno.required_candy,80);
assert.equal(monferno.verified_at,'2026-08-10');

const toxelAmped=route('毒電嬰','顫弦蠑螈（高調的樣子）');
const toxelLowKey=route('毒電嬰','顫弦蠑螈（低調的樣子）');
for(const row of [toxelAmped,toxelLowKey]){
  assert.ok(row,'Toxel branch route missing');
  assert.equal(row.required_level,23);
  assert.equal(row.required_candy,80);
  assert.equal(row.other_requirement,'依性格決定進化型態');
  assert.equal(row.verified_at,'2026-08-10');
  assert.match(row.source_ref,/\/toxel\.shtml$/);
}

const houndour=route('戴魯比','黑魯加');
assert.ok(houndour,'Houndour route missing');
assert.equal(houndour.required_level,18);
assert.equal(houndour.required_candy,40);
assert.equal(houndour.verified_at,'2026-08-10');
assert.match(houndour.source_ref,/\/houndour\.shtml$/);

const terminalSet=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name));
for(const species of [
  '哥達鴨','老翁龍','拉帝亞斯','拉帝歐斯','花療環環','信使鳥','穿山王','烈焰猴',
  '顫弦蠑螈（高調的樣子）','顫弦蠑螈（低調的樣子）','達克萊伊','夢幻','黑魯加',
])assert.ok(terminalSet.has(species),`evidence-backed terminal row missing: ${species}`);
const outgoingSet=new Set(PUBLIC_EVOLUTION_MASTER.map(row=>row.from_species));
for(const species of terminalSet)assert.equal(outgoingSet.has(species),false,`species cannot be both outgoing and terminal: ${species}`);

const rows=[
  {pokemon_id:'PRIVATE-1',current_species:'戴魯比',species:'戴魯比',nature:'勤奮',main_skill:'能量填充M',type:'惡'},
  {pokemon_id:'PRIVATE-2',current_species:'妙蛙花',species:'妙蛙花',nature:'勤奮',main_skill:'活力填充S',type:'草'},
  {pokemon_id:'PRIVATE-3',current_species:'測試未收錄物種',species:'測試未收錄物種',nature:'勤奮',main_skill:'活力填充S',type:'水'},
];
const diagnostic=buildEvolutionCoverageDiagnostic(rows);
assert.equal(diagnostic.public_pokemon_knowledge_version,PUBLIC_POKEMON_KNOWLEDGE_VERSION);
assert.equal(diagnostic.observed_species_count,3);
assert.equal(diagnostic.verified_outgoing_count,1);
assert.equal(diagnostic.verified_terminal_count,1);
assert.equal(diagnostic.unknown_count,1);
assert.deepEqual(diagnostic.verified_outgoing_species,['戴魯比']);
assert.deepEqual(diagnostic.unknown_species,['測試未收錄物種']);
assert.equal(diagnostic.unknown_values_count,diagnostic.unknown_species.length);
assert.equal(diagnostic.count_list_parity,true);
assert.equal(diagnostic.partition_count,3);
assert.equal(diagnostic.partition_parity,true);
assert.deepEqual(diagnostic.privacy,{species_names_only:true,player_ids_exported:false,quantities_exported:false,notes_exported:false});

const serialized=JSON.stringify(diagnostic);
for(const forbidden of ['PRIVATE-1','PRIVATE-2','PRIVATE-3','pokemon_id','quantity','safe_reserve','base_notes'])assert.equal(serialized.includes(forbidden),false,`diagnostic leaked private field/token: ${forbidden}`);

const candyNames=new Set(buildPublicCandyMasterRows().map(row=>row.candy_name));
for(const name of ['哥達鴨的糖果','老翁龍的糖果','烈焰猴的糖果','毒電嬰的糖果','顫弦蠑螈（高調的樣子）的糖果','顫弦蠑螈（低調的樣子）的糖果','戴魯比的糖果','黑魯加的糖果']){
  assert.ok(candyNames.has(name),`Candy Pokémon-name projection missing: ${name}`);
}
assert.equal(candyNames.has('顫弦蠑螈(高調的樣子)的糖果'),false,'canonical zh-TW full-width punctuation must not be normalized into display text');

const ui=read('assets/js/v03993-public-knowledge-coverage-ui.js');
for(const token of [
  '複製 Evolution Coverage 診斷 JSON',
  'count/list parity',
  'partition parity',
  'buildEvolutionCoverageDiagnostic',
  '不含玩家 Pokémon ID',
])assert.ok(ui.includes(token),`coverage UI missing diagnostic contract token: ${token}`);
const coverage=read('assets/js/public-pokemon-knowledge-coverage.js');
for(const token of ['unknown_values_count','count_list_parity','partition_count','partition_parity','species_names_only:true','player_ids_exported:false'])assert.ok(coverage.includes(token),`coverage diagnostic missing: ${token}`);
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'DATA.EVO.1 must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',
  gate:'DATA_EVO1_OBSERVED_EVOLUTION_COVERAGE_ZERO_UNKNOWN_READY',
  current_app_version:app,
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  evolution_routes:bundle.manifest.evolution_route_rows,
  outgoing_species:bundle.manifest.evolution_from_species_rows,
  verified_terminal_species:bundle.manifest.evolution_verified_terminal_rows,
  residual_unknown_closed:'戴魯比',
  houndour_route:{to:'黑魯加',required_level:18,required_candy:40},
  evidence_backed_visible_unknowns_closed:13,
  diagnostic_schema:EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  count_list_parity:true,
  tri_state_partition_parity:true,
  species_names_only:true,
  private_ids_exported:false,
  candy_projection_aligned:true,
  canonical_zh_tw_punctuation_preserved:true,
  sqlite_migration_added:false,
},null,2));
