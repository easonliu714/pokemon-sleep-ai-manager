import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_POKEMON_KNOWLEDGE_VERSION,
} from '../assets/js/public-pokemon-knowledge-master.js';
import {
  PUBLIC_ITEM_MASTER,
  PUBLIC_ITEM_MASTER_VERSION,
} from '../assets/js/public-item-master.js';
import {RESOURCE_CONTEXT_VERSION} from '../assets/js/resource-context.js';
import {CANDY_FAMILY_STORAGE_MIGRATION_VERSION} from '../assets/js/candy-family-storage-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const schema=read('assets/js/schema.js');
const migrations=read('assets/js/migrations.js');
const pokemonKnowledge=read('assets/js/public-pokemon-knowledge-master.js');
const itemMaster=read('assets/js/public-item-master.js');
const sharedMasterSchema=read('assets/js/shared-master-schema.js');
const resourceContext=read('assets/js/resource-context.js');

const STATUS=Object.freeze({READY:'READY',PARTIAL:'PARTIAL',MISSING:'MISSING'});

function fieldsOf(rows){
  const fields=new Set();
  for(const row of rows)for(const key of Object.keys(row||{}))fields.add(key);
  return fields;
}
const evoFields=fieldsOf(PUBLIC_EVOLUTION_MASTER);
const itemFields=fieldsOf(PUBLIC_ITEM_MASTER);
const evolutionItems=PUBLIC_ITEM_MASTER.filter(row=>row.item_category==='evolution');

const audit={
  schema:'pokemon-sleep-g121a-readiness-audit/1.0',
  gate:'G12.1A_READINESS_AUDIT',
  mode:'READ_ONLY',
  versions:{
    pokemon_knowledge:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
    item_master:PUBLIC_ITEM_MASTER_VERSION,
    resource_context:RESOURCE_CONTEXT_VERSION,
    candy_family_storage_migration:CANDY_FAMILY_STORAGE_MIGRATION_VERSION,
  },
  dependencies:{
    public_evolution_master:{
      status:STATUS.PARTIAL,
      present:[
        'from_species','to_species','required_level','required_sleep_hours','required_candy',
        'required_item','other_requirement','source_ref','verified_at','data_version',
      ],
      missing:['route_id/evolution_branch_id','effective_from','effective_until','confidence'],
      minimum_next_change:'extend versioned public evolution route schema without inferring missing values',
    },
    public_item_identity:{
      status:STATUS.READY,
      evidence:{evolution_item_count:evolutionItems.length,total_item_count:PUBLIC_ITEM_MASTER.length},
      minimum_next_change:null,
    },
    public_item_acquisition_authority:{
      status:STATUS.MISSING,
      missing:[
        'acquisition_type','shop_type','sleep_point_cost','diamond_cost','exchange_limit',
        'premium_only','mission_or_achievement','event_limited','bundle_name',
        'available_from','available_until','confidence',
      ],
      minimum_next_change:'add a separate versioned acquisition authority with effective-period/source governance',
    },
    player_pokemon_identity:{
      status:STATUS.READY,
      evidence:['pokemon.pokemon_instance_id','unique idx_pokemon_instance_id'],
      fail_closed_requirement:'missing/duplicate pokemon_instance_id => data_incomplete',
    },
    player_instance_sleep_hours:{
      status:STATUS.READY,
      evidence:['Migration 7 pokemon.sleep_hours'],
      fail_closed_requirement:'NULL/unknown sleep_hours must remain unknown; account-level sleep time must never substitute',
    },
    canonical_family_candy:{
      status:STATUS.READY,
      evidence:['P0-B6 candy family storage','resource_context.candies'],
      fail_closed_requirement:'legacy per-species Candy must not be double-counted',
    },
    player_item_inventory:{
      status:STATUS.READY,
      evidence:['item_inventory.quantity','item_inventory.safe_reserve','resource_context.items.available'],
    },
    dream_shards:{
      status:STATUS.MISSING,
      minimum_next_change:'add explicit player-local resource field/table and expose nullable/known semantics in resource snapshot',
    },
    sleep_points:{
      status:STATUS.MISSING,
      minimum_next_change:'add explicit player-local resource field/table and expose nullable/known semantics in resource snapshot',
    },
    diamonds:{
      status:STATUS.MISSING,
      minimum_next_change:'add explicit player-local resource field/table and expose nullable/known semantics in resource snapshot',
    },
    premium_pass_state:{
      status:STATUS.MISSING,
      minimum_next_change:'add explicit player-local tri-state/known semantics; never infer from shop availability',
    },
    shared_player_isolation:{
      status:STATUS.READY,
      evidence:['public master tables are projected separately from player inventory tables','resource snapshot joins read-side only'],
    },
    g121_status_vocabulary:{
      status:STATUS.MISSING,
      required:[
        'ready_now','missing_sleep_hours','missing_level','missing_candy','missing_item',
        'missing_dream_shards','time_window_pending','multiple_requirements_missing',
        'data_incomplete','evolution_not_recommended_yet',
      ],
      minimum_next_change:'freeze deterministic status enum before recommendation/AI layers',
    },
  },
};

assert.equal(CANDY_FAMILY_STORAGE_MIGRATION_VERSION,15,'P0-B6 Migration 15 must remain frozen');
assert.ok(PUBLIC_EVOLUTION_MASTER.length>0,'public evolution routes must exist');
for(const field of ['from_species','to_species','required_level','required_sleep_hours','required_candy','required_item','other_requirement','source_ref','verified_at','data_version']){
  assert.ok(evoFields.has(field),`evolution master missing expected baseline field: ${field}`);
}
for(const field of ['effective_from','effective_until','confidence']){
  assert.equal(evoFields.has(field),false,`G12.1A baseline unexpectedly gained ${field}; update audit classification intentionally`);
}
assert.match(pokemonKnowledge,/CREATE TABLE IF NOT EXISTS pokemon_evolution_master/);
assert.match(pokemonKnowledge,/required_sleep_hours REAL/);
assert.match(schema,/pokemon_instance_id TEXT/);
assert.match(migrations,/addColumnIfMissing\(db,'pokemon','sleep_hours','REAL'\)/);
assert.match(migrations,/CREATE UNIQUE INDEX IF NOT EXISTS idx_pokemon_instance_id/);
assert.match(schema,/CREATE TABLE IF NOT EXISTS item_inventory\(item_name TEXT PRIMARY KEY,quantity INTEGER NOT NULL DEFAULT 0,safe_reserve INTEGER NOT NULL DEFAULT 0/);
assert.match(resourceContext,/ingredients,items,candies/);
assert.match(resourceContext,/safe_reserve:number\(row\.safe_reserve\)/);
assert.doesNotMatch(resourceContext,/dream_shards|sleep_points|diamonds|premium_pass/i,'current resource snapshot must still classify these G12 inputs as missing until explicitly implemented');
assert.match(sharedMasterSchema,/CREATE TABLE IF NOT EXISTS item_master/);
for(const field of ['item_name','item_category','effect_description_zh_tw','source_type','source_name','source_ref','verified_at','data_version']){
  assert.ok(itemFields.has(field),`item master missing expected baseline field: ${field}`);
}
for(const field of ['acquisition_type','sleep_point_cost','diamond_cost','exchange_limit','premium_only','available_from','available_until','confidence']){
  assert.equal(itemFields.has(field),false,`item acquisition baseline unexpectedly gained ${field}; update audit classification intentionally`);
}

const counts=Object.values(audit.dependencies).reduce((acc,row)=>{
  acc[row.status]=(acc[row.status]||0)+1;return acc;
},{READY:0,PARTIAL:0,MISSING:0});

assert.equal(audit.dependencies.public_evolution_master.status,STATUS.PARTIAL);
assert.equal(audit.dependencies.public_item_acquisition_authority.status,STATUS.MISSING);
assert.equal(audit.dependencies.player_pokemon_identity.status,STATUS.READY);
assert.equal(audit.dependencies.player_instance_sleep_hours.status,STATUS.READY);
assert.equal(audit.dependencies.canonical_family_candy.status,STATUS.READY);
assert.equal(audit.dependencies.dream_shards.status,STATUS.MISSING);
assert.equal(audit.dependencies.sleep_points.status,STATUS.MISSING);
assert.equal(audit.dependencies.diamonds.status,STATUS.MISSING);
assert.equal(audit.dependencies.premium_pass_state.status,STATUS.MISSING);
assert.equal(audit.dependencies.g121_status_vocabulary.status,STATUS.MISSING);

console.log(JSON.stringify({...audit,summary:counts},null,2));
