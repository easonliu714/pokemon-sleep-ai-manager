import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,
  buildEvolutionCoverageDiagnostic,
  auditPublicPokemonKnowledgeBundle,
} from '../assets/js/public-pokemon-knowledge-coverage.js';
import {PUBLIC_POKEMON_KNOWLEDGE_VERSION} from '../assets/js/public-pokemon-knowledge-master.js';

const read=path=>fs.readFileSync(path,'utf8');

const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8.1','behavior phase must not bump central release before DATA.EVO.1 gate is green');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,'pokemon-sleep-evolution-coverage-diagnostic/1.0');
assert.equal(EVOLUTION_COVERAGE_DIAGNOSTIC_VERSION,'data-evo1-evolution-coverage-diagnostic-2026-08-10-a');

const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('\n'));

const rows=[
  {pokemon_id:'PRIVATE-1',current_species:'妙蛙種子',species:'妙蛙種子',nature:'勤奮',main_skill:'活力填充S',type:'草'},
  {pokemon_id:'PRIVATE-2',current_species:'妙蛙花',species:'妙蛙花',nature:'勤奮',main_skill:'活力填充S',type:'草'},
  {pokemon_id:'PRIVATE-3',current_species:'可達鴨',species:'可達鴨',nature:'勤奮',main_skill:'活力填充S',type:'水'},
];
const diagnostic=buildEvolutionCoverageDiagnostic(rows);
assert.equal(diagnostic.public_pokemon_knowledge_version,PUBLIC_POKEMON_KNOWLEDGE_VERSION);
assert.equal(diagnostic.observed_species_count,3);
assert.equal(diagnostic.verified_outgoing_count,1);
assert.equal(diagnostic.verified_terminal_count,1);
assert.equal(diagnostic.unknown_count,1);
assert.deepEqual(diagnostic.unknown_species,['可達鴨']);
assert.equal(diagnostic.unknown_values_count,diagnostic.unknown_species.length);
assert.equal(diagnostic.count_list_parity,true);
assert.equal(diagnostic.partition_count,3);
assert.equal(diagnostic.partition_parity,true);
assert.deepEqual(diagnostic.privacy,{species_names_only:true,player_ids_exported:false,quantities_exported:false,notes_exported:false});

const serialized=JSON.stringify(diagnostic);
for(const forbidden of ['PRIVATE-1','PRIVATE-2','PRIVATE-3','pokemon_id','quantity','safe_reserve','base_notes'])assert.equal(serialized.includes(forbidden),false,`diagnostic leaked private field/token: ${forbidden}`);

const ui=read('assets/js/v03993-public-knowledge-coverage-ui.js');
for(const token of [
  '複製 Evolution Coverage 診斷 JSON',
  'count/list parity',
  'partition parity',
  'buildEvolutionCoverageDiagnostic',
  'player_ids_exported:false',
])assert.ok(ui.includes(token),`coverage UI missing diagnostic contract token: ${token}`);
const coverage=read('assets/js/public-pokemon-knowledge-coverage.js');
for(const token of ['unknown_values_count','count_list_parity','partition_count','partition_parity','species_names_only:true'])assert.ok(coverage.includes(token),`coverage diagnostic missing: ${token}`);
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'DATA.EVO.1A must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',
  gate:'DATA_EVO1_OBSERVED_EVOLUTION_COVERAGE_DIAGNOSTIC',
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  diagnostic_schema:EVOLUTION_COVERAGE_DIAGNOSTIC_SCHEMA,
  count_list_parity:true,
  tri_state_partition_parity:true,
  species_names_only:true,
  private_ids_exported:false,
  sqlite_migration_added:false,
  release_bump_deferred:true,
},null,2));
