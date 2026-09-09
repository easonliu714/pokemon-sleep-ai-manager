import assert from 'node:assert/strict';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import {DDL} from '../assets/js/schema.js';
import {applySharedMasterSchema} from '../assets/js/shared-master-schema.js';
import {
  applyPublicPokemonKnowledgeSchema,
  applyPublicPokemonKnowledgeData,
  PUBLIC_EVOLUTION_MASTER,
} from '../assets/js/public-pokemon-knowledge-master.js';
import {
  applyG121AuthoritySchemaMigration,
  seedUnknownEvolutionItemAcquisitionRows,
  normalizeG121PlayerResourceRows,
  upsertG121PlayerResourceState,
  G121_AUTHORITY_SCHEMA_MIGRATION_VERSION,
  G121_EVOLUTION_STATUS,
  G121_PLAYER_RESOURCE_KEYS,
} from '../assets/js/g121-authority.js';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const authoritySource=fs.readFileSync('assets/js/version-authority.js','utf8');
const serviceWorkerSource=fs.readFileSync('service-worker.js','utf8');
assert.match(authoritySource,/app_version:\s*'v0\.4\.27\.55\.3\.3\.5'/);
assert.match(authoritySource,/app_build:\s*'20260908-v042755335-g121a-authority-closure'/);
assert.match(authoritySource,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.55\.3\.3\.5-v042755335-g121a-authority-closure'/);
assert.match(authoritySource,/\/\/ app_version: 'v0\.4\.27\.55\.3\.3\.4'/,'exact .55.3.3.4 predecessor bridge must remain');
assert.match(serviceWorkerSource,/importScripts\('\.\/assets\/js\/version-authority\.js'\)/);
assert.match(serviceWorkerSource,/PokemonSleepVersionAuthority/);

const SQL=await initSqlJs();
const db=new SQL.Database();
db.run(DDL);
applySharedMasterSchema(db);
applyPublicPokemonKnowledgeSchema(db);
applyPublicPokemonKnowledgeData(db);

const beforeRouteColumns=[];
{
  const stmt=db.prepare('PRAGMA table_info("pokemon_evolution_master")');
  while(stmt.step())beforeRouteColumns.push(stmt.getAsObject().name);
  stmt.free();
}
assert.ok(beforeRouteColumns.includes('route_id'),'fresh schema should expose route_id before migration backfill');

const migration=applyG121AuthoritySchemaMigration(db);
assert.equal(migration.migration_version,16);
assert.equal(G121_AUTHORITY_SCHEMA_MIGRATION_VERSION,16);
assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'P0-B6 migration constant must remain frozen at 15');

const rows=(sql,params=[])=>{
  const stmt=db.prepare(sql);stmt.bind(params);const out=[];
  while(stmt.step())out.push(stmt.getAsObject());stmt.free();return out;
};
const scalar=(sql,params=[])=>{const out=rows(sql,params);return out.length?Object.values(out[0])[0]:null;};

assert.equal(Number(scalar('SELECT COUNT(*) FROM schema_migrations WHERE version=16')),1,'migration 16 must be recorded exactly once');
assert.equal(Number(scalar('SELECT COUNT(*) FROM player_resource_state')),4,'four explicit G12 player resources must be seeded');
const playerRows=rows('SELECT * FROM player_resource_state ORDER BY resource_key');
assert.deepEqual(playerRows.map(row=>row.resource_key).sort(),[...G121_PLAYER_RESOURCE_KEYS].sort());
for(const row of playerRows){
  assert.equal(row.knowledge_state,'UNKNOWN',`${row.resource_key} must start UNKNOWN`);
  assert.equal(row.numeric_value,null,`${row.resource_key} must not silently default to zero`);
  assert.equal(row.text_value,null,`${row.resource_key} must not infer a textual state`);
}
const normalized=normalizeG121PlayerResourceRows(playerRows);
for(const key of G121_PLAYER_RESOURCE_KEYS){
  assert.equal(normalized[key].known,false);
  assert.equal(normalized[key].numeric_value,null);
}

const knownZero=upsertG121PlayerResourceState(db,{resource_key:'dream_shards',knowledge_state:'KNOWN',numeric_value:0,updated_at:'2026-09-08T00:00:00.000Z',source_update_id:'fixture'});
assert.equal(knownZero.numeric_value,0,'explicit KNOWN zero must be preserved');
assert.equal(knownZero.knowledge_state,'KNOWN');
const unknownAgain=upsertG121PlayerResourceState(db,{resource_key:'dream_shards',knowledge_state:'UNKNOWN',numeric_value:999,updated_at:'2026-09-08T00:01:00.000Z'});
assert.equal(unknownAgain.numeric_value,null,'UNKNOWN must discard numeric payload rather than infer a value');
assert.throws(()=>upsertG121PlayerResourceState(db,{resource_key:'sleep_points',knowledge_state:'KNOWN',numeric_value:-1}),/g121_invalid_numeric_resource/);
assert.throws(()=>upsertG121PlayerResourceState(db,{resource_key:'diamonds',knowledge_state:'KNOWN',numeric_value:1.5}),/g121_invalid_numeric_resource/);
assert.throws(()=>upsertG121PlayerResourceState(db,{resource_key:'premium_pass_state',knowledge_state:'KNOWN',text_value:'MAYBE'}),/g121_invalid_premium_pass_state/);
const premium=upsertG121PlayerResourceState(db,{resource_key:'premium_pass_state',knowledge_state:'KNOWN',text_value:'ACTIVE',updated_at:'2026-09-08T00:02:00.000Z'});
assert.equal(premium.text_value,'ACTIVE');

const sample=rows('SELECT route_id,evolution_branch_id,from_species,to_species,effective_from,effective_until,confidence,effective_period_status FROM pokemon_evolution_master WHERE from_species=? LIMIT 1',['伊布'])[0];
assert.ok(sample?.route_id?.startsWith('sleep-evolution:伊布→'));
assert.equal(sample.evolution_branch_id,'sleep-evolution-branch:伊布');
assert.equal(sample.effective_from,null);
assert.equal(sample.effective_until,null);
assert.equal(Number(sample.confidence),1);
assert.equal(sample.effective_period_status,'CURRENT_REFERENCE_NO_EFFECTIVE_WINDOW');

assert.equal(Number(scalar('SELECT COUNT(*) FROM pokemon_evolution_master')),PUBLIC_EVOLUTION_MASTER.length);
assert.equal(Number(scalar("SELECT COUNT(*) FROM pokemon_evolution_master WHERE route_id IS NULL OR route_id=''")),0);
assert.equal(Number(scalar("SELECT COUNT(*) FROM pokemon_evolution_master WHERE evolution_branch_id IS NULL OR evolution_branch_id=''")),0);

db.run(`INSERT INTO item_master(item_name,item_category,effect_description_zh_tw,source_type,source_name,source_ref,verified_at,data_version)
  VALUES('測試進化石','evolution','fixture','fixture','fixture',NULL,'2026-09-08','fixture')`);
const seeded=seedUnknownEvolutionItemAcquisitionRows(db,['測試進化石']);
assert.equal(seeded.inserted,1);
const acquisition=rows('SELECT * FROM item_acquisition_master WHERE item_name=?',['測試進化石'])[0];
assert.equal(acquisition.acquisition_type,'unknown');
assert.equal(acquisition.authority_status,'MISSING_AUTHORITY');
assert.equal(acquisition.sleep_point_cost,null);
assert.equal(acquisition.diamond_cost,null);
assert.equal(Number(acquisition.confidence),0);

assert.deepEqual(Object.values(G121_EVOLUTION_STATUS),[
  'ready_now','missing_sleep_hours','missing_level','missing_candy','missing_item',
  'missing_dream_shards','time_window_pending','multiple_requirements_missing',
  'data_incomplete','evolution_not_recommended_yet',
]);

const resourceContext=fs.readFileSync('assets/js/resource-context.js','utf8');
assert.match(resourceContext,/pokemon-sleep-resource-context\/2\.0/);
assert.match(resourceContext,/player_resources:playerResources/);
assert.match(resourceContext,/normalizeG121PlayerResourceRows/);
assert.match(resourceContext,/G121_PLAYER_RESOURCE_AUTHORITY_VERSION/);

console.log(JSON.stringify({
  gate:'G12.1A_AUTHORITY_CLOSURE',
  status:'PASS',
  migration:G121_AUTHORITY_SCHEMA_MIGRATION_VERSION,
  candy_migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
  evolution_routes:PUBLIC_EVOLUTION_MASTER.length,
  player_resource_unknown_rows:playerRows.length,
  item_acquisition_missing_authority_fail_closed:true,
  status_vocabulary:Object.values(G121_EVOLUTION_STATUS),
},null,2));

// G12.1B stays inside the approved Frontend Regression topology: this successor
// contract is executed by the existing G12.1A authority-closure step rather than
// introducing a standalone workflow.
await import('./g121b-deterministic-evolution-status-contract.mjs');
