import assert from 'node:assert/strict';
import fs from 'node:fs';

const provider=fs.readFileSync(new URL('../assets/js/g121d-warroom-recommendation-provider.js',import.meta.url),'utf8');
const candyRead=fs.readFileSync(new URL('../assets/js/g121d-candy-read-authority.js',import.meta.url),'utf8');
const binding=fs.readFileSync(new URL('../assets/js/g121d-warroom-recommendation-binding.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../assets/js/g121d-evolution-recommendation-ui.js',import.meta.url),'utf8');

assert.match(provider,/rows,isDatabaseReady,isRescueReadonly/,'provider must read through canonical database API');
assert.match(provider,/resolveG121DCanonicalCandyRead/,'provider must bind Candy through governed runtime read authority');
assert.match(candyRead,/resolveCandyFamilyStorageForSpecies/,'Candy runtime read authority must derive family identity from P0-B6 governed resolver');
assert.match(provider,/readG121CExplainableEvolutionRecommendation/,'provider must consume G12.1C rather than recompute status in UI');
assert.match(provider,/SELECT pokemon_instance_id,current_species,species,nickname,level,sleep_hours,status/);
assert.match(provider,/FROM pokemon_evolution_master/);
assert.match(provider,/FROM item_inventory/);
assert.match(provider,/FROM item_acquisition_master/);
assert.match(provider,/FROM player_resource_state/);
assert.match(provider,/FROM candy_master WHERE candy_type='species'/,'runtime Candy identity must use canonical species master rows');
assert.match(provider,/FROM candy_inventory ORDER BY candy_id/,'runtime Candy quantity must come from player inventory rows');
assert.doesNotMatch(provider,/candy_family_storage_migration_audit/,'migration audit is historical governance evidence, not runtime mapping authority');
assert.match(provider,/pokemon_instance_id:pokemonInstanceId/);
assert.match(provider,/candy_family_id:candy\.family_id/);
assert.match(provider,/recommendationAuthorityForPokemon\(pokemon\)/);
assert.match(provider,/return \{\};/,'unverified War Room scoring must not be coerced into recommendation authority');
assert.match(provider,/pokemon-sleep:g121c-recommendations-ready/);
assert.match(provider,/read_only:true/);
assert.match(provider,/ai_decision:false/);
assert.doesNotMatch(provider,/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i,'provider must remain SQL read-only');
assert.doesNotMatch(provider,/\b(?:run|persist|begin|commit|rollback)\s*\(/,'provider must not call mutation APIs');
assert.doesNotMatch(provider,/account_total_sleep_time/i,'provider must never substitute account total sleep time');
assert.doesNotMatch(provider,/Gemini|generateContent|fetch\([^)]*api/i,'provider must not invoke AI/network authority');

assert.match(binding,/refreshG121DWarroomRecommendations/,'War Room binding must actually trigger local envelope production');
assert.match(binding,/reason:'warroom-module-load'/);
assert.match(binding,/pokemon-sleep:g121c-recommendations-ready/);
assert.match(ui,/renderG121DRosterRecommendations/,'multiple Pokémon must be grouped by exact individual identity');
assert.match(ui,/if\(identities\.size>1\)return renderG121DRosterRecommendations/);
assert.match(ui,/if\(!groups\.has\(model\.pokemon_instance_id\)\)/);
assert.match(ui,/每個群組內只比較該個體的可驗證進化分支/);
assert.match(ui,/grid-template-columns:repeat\(auto-fit/,'mobile cards must use responsive wrapping');

console.log(JSON.stringify({
  gate:'G12.1D_WARROOM_LOCAL_PROVIDER',
  status:'PASS',
  sqlite_read_only:true,
  g121c_consumer:true,
  pokemon_instance_id_exact:true,
  p0b6_family_candy:true,
  migration_audit_runtime_authority:false,
  canonical_player_inventory_unknown_preserved:true,
  account_sleep_substitution:false,
  ai_decision:false,
  multi_instance_grouping:true,
  responsive_wrapping:true,
},null,2));
