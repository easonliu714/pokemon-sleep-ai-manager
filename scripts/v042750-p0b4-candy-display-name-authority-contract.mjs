import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY,
  currentPublicCandyDisplayNameAuthorityRows,
  resolvePublicCandyDisplayNameForSpecies,
} from '../assets/js/public-candy-display-name-authority.js';
import {
  PUBLIC_CANDY_MASTER_VERSION,
  speciesCandyName,
} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');

assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,'public-candy-display-name-authority-2026-08-31-a');
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.exact_official_zh_tw_string_required,true);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.structural_root_is_not_display_name_anchor,true);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.species_name_concatenation_forbidden,true);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.automatic_display_name_generation,false);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.unverified_family_fail_closed,true);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.legacy_candy_master_mutation_authority,false);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.legacy_candy_id_remap_authority,false);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.candy_inventory_migration_authority,false);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.player_quantity_write_authority,false);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.professor_transfer_write_behavior_changed,false);

const rows=currentPublicCandyDisplayNameAuthorityRows();
assert.equal(rows.length,3);
assert.equal(rows.every(row=>row.status==='MATCH'),true,'all admitted evidence rows must bind to a governed Candy family');
assert.deepEqual(rows.map(row=>row.candy_display_name).sort(),['伊布的糖果','妙蛙種子的糖果','皮卡丘的糖果'].sort());
assert.equal(rows.every(row=>row.source_type==='OFFICIAL_POKEMON_SLEEP_ZH_TW_EXACT_STRING'),true);

const pikachu=resolvePublicCandyDisplayNameForSpecies('皮卡丘');
const pichu=resolvePublicCandyDisplayNameForSpecies('皮丘');
const raichu=resolvePublicCandyDisplayNameForSpecies('雷丘');
assert.equal(pikachu.status,'MATCH');
assert.equal(pikachu.candy_display_name,'皮卡丘的糖果');
assert.equal(pichu.status,'MATCH');
assert.equal(pichu.family_id,pikachu.family_id);
assert.equal(pichu.candy_display_name,'皮卡丘的糖果');
assert.equal(raichu.status,'MATCH');
assert.equal(raichu.family_id,pikachu.family_id);
assert.equal(raichu.candy_display_name,'皮卡丘的糖果');

const eevee=resolvePublicCandyDisplayNameForSpecies('伊布');
const vaporeon=resolvePublicCandyDisplayNameForSpecies('水伊布');
assert.equal(eevee.status,'MATCH');
assert.equal(eevee.candy_display_name,'伊布的糖果');
assert.equal(vaporeon.status,'MATCH');
assert.equal(vaporeon.family_id,eevee.family_id);
assert.equal(vaporeon.candy_display_name,'伊布的糖果');

const bulbasaur=resolvePublicCandyDisplayNameForSpecies('妙蛙種子');
const ivysaur=resolvePublicCandyDisplayNameForSpecies('妙蛙草');
assert.equal(bulbasaur.status,'MATCH');
assert.equal(bulbasaur.candy_display_name,'妙蛙種子的糖果');
assert.equal(ivysaur.status,'MATCH');
assert.equal(ivysaur.family_id,bulbasaur.family_id);
assert.equal(ivysaur.candy_display_name,'妙蛙種子的糖果');

const tinkatink=resolvePublicCandyDisplayNameForSpecies('小鍛匠');
const tinkatuff=resolvePublicCandyDisplayNameForSpecies('巧鍛匠');
assert.equal(tinkatink.status,'REVIEW_REQUIRED');
assert.equal(tinkatink.reason,'OFFICIAL_ZH_TW_CANDY_DISPLAY_NAME_NOT_VERIFIED');
assert.equal(tinkatink.candy_display_name,null);
assert.equal(tinkatuff.status,'REVIEW_REQUIRED');
assert.equal(tinkatuff.family_id,tinkatink.family_id);
assert.equal(tinkatuff.candy_display_name,null);

const unknown=resolvePublicCandyDisplayNameForSpecies('不存在寶可夢');
assert.equal(unknown.status,'REVIEW_REQUIRED');
assert.equal(unknown.candy_display_name,null);

assert.ok(['public-candy-master-2026-08-29-e','public-candy-master-2026-09-01-f'].includes(PUBLIC_CANDY_MASTER_VERSION));
assert.equal(speciesCandyName('皮卡丘'),'皮卡丘的糖果');
const professorSource=read('assets/js/pokemon-professor-transfer.js');
assert.match(professorSource,/PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-08-27-p0b1'/);
assert.equal(professorSource.includes('public-candy-display-name-authority.js'),false);
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);

const versionSource=read('assets/js/version-authority.js');
const serviceWorkerSource=read('service-worker.js');
const workflowSource=read('.github/workflows/regression-gate.yml');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.50'){
  assert.equal(appBuild,'20260831-v042750-p0b4-candy-display-name-authority');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.50-v042750-p0b4-candy-display-name-authority');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.49'"));
}else if(appVersion==='v0.4.27.51'){
  assert.equal(appBuild,'20260831-v042751-p0b5-candy-quantity-confirmation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.51-v042751-p0b5-candy-quantity-confirmation');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.50'"),'v0.4.27.50 predecessor version bridge must remain');
  assert.ok(versionSource.includes("// app_build: '20260831-v042750-p0b4-candy-display-name-authority'"),'v0.4.27.50 predecessor build bridge must remain');
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.50-v042750-p0b4-candy-display-name-authority'"),'v0.4.27.50 predecessor cache bridge must remain');
}else if(appVersion==='v0.4.27.52'){
  assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.52-v042752-p0b5-gap-identity-raw-evidence-hotfix');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.51'"),'v0.4.27.51 predecessor version bridge must remain');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.50'"),'v0.4.27.50 predecessor version bridge must remain');
  assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-f','v0.4.27.52 must carry the targeted legacy Candy candidate hotfix');
}else{
  assert.fail(`B4 successor release not governed: ${appVersion}`);
}
assert.ok(versionSource.includes("// app_version: 'v0.4.27.49'"),'v0.4.27.49 predecessor version bridge must remain');
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-display-name-authority\.js/g)||[]).length,1,'Candy display-name authority must be precached exactly once');
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-family-authority\.js/g)||[]).length,1,'Candy family predecessor authority must remain precached exactly once');
assert.ok(workflowSource.includes('node scripts/v042750-p0b4-candy-display-name-authority-contract.mjs'));

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042750_P0B4_PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY',
  authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  admitted_exact_zh_tw_display_name_rows:rows.length,
  verified_display_names:rows.map(row=>row.candy_display_name),
  app_version:appVersion,
  app_build:appBuild,
  offline_precache:true,
  semantics:{
    family_level_display_name_resolution:true,
    exact_official_zh_tw_evidence_only:true,
    unverified_family_review_required:true,
    structural_root_auto_naming:false,
    legacy_candy_master_mutation:false,
    player_inventory_migration:false,
    professor_transfer_write_change:false,
    predecessor_b3_exact_bridge_preserved:true,
    successor_release_exact:true,
  },
},null,2));

await import('./v042751-p0b5-candy-quantity-confirmation-contract.mjs');