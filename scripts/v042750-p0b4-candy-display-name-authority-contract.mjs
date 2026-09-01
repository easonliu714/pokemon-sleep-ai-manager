import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY,
  currentPublicCandyDisplayNameAuthorityRows,
  resolvePublicCandyDisplayNameForSpecies,
} from '../assets/js/public-candy-display-name-authority.js';
import {PUBLIC_CANDY_MASTER_VERSION,speciesCandyName} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,'public-candy-display-name-authority-2026-08-31-a');
for(const [key,value] of Object.entries({exact_official_zh_tw_string_required:true,structural_root_is_not_display_name_anchor:true,species_name_concatenation_forbidden:true,automatic_display_name_generation:false,unverified_family_fail_closed:true,legacy_candy_master_mutation_authority:false,legacy_candy_id_remap_authority:false,candy_inventory_migration_authority:false,player_quantity_write_authority:false,professor_transfer_write_behavior_changed:false}))assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY[key],value,key);
const rows=currentPublicCandyDisplayNameAuthorityRows();
assert.equal(rows.length,3);assert.equal(rows.every(row=>row.status==='MATCH'),true);assert.deepEqual(rows.map(row=>row.candy_display_name).sort(),['伊布的糖果','妙蛙種子的糖果','皮卡丘的糖果'].sort());
for(const species of ['皮丘','皮卡丘','雷丘'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'皮卡丘的糖果');
for(const species of ['伊布','水伊布'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'伊布的糖果');
for(const species of ['妙蛙種子','妙蛙草'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'妙蛙種子的糖果');
const tinkatink=resolvePublicCandyDisplayNameForSpecies('小鍛匠');assert.equal(tinkatink.status,'REVIEW_REQUIRED');assert.equal(tinkatink.candy_display_name,null);
assert.equal(resolvePublicCandyDisplayNameForSpecies('不存在寶可夢').status,'REVIEW_REQUIRED');
assert.ok(['public-candy-master-2026-09-01-f','public-candy-master-2026-09-01-g'].includes(PUBLIC_CANDY_MASTER_VERSION));
assert.equal(speciesCandyName('皮卡丘'),'皮卡丘的糖果');
const professorSource=read('assets/js/pokemon-professor-transfer.js');assert.match(professorSource,/PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-08-27-p0b1'/);assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);assert.equal(professorSource.includes('public-candy-display-name-authority.js'),false);
const versionSource=read('assets/js/version-authority.js'),serviceWorkerSource=read('service-worker.js'),workflowSource=read('.github/workflows/regression-gate.yml');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'',appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'',cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.50'){assert.equal(appBuild,'20260831-v042750-p0b4-candy-display-name-authority');assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.50-v042750-p0b4-candy-display-name-authority');}
else if(appVersion==='v0.4.27.51'){assert.equal(appBuild,'20260831-v042751-p0b5-candy-quantity-confirmation');assert.ok(versionSource.includes("// app_version: 'v0.4.27.50'"));}
else if(appVersion==='v0.4.27.52'){assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-f');assert.ok(versionSource.includes("// app_version: 'v0.4.27.51'"));}
else if(appVersion==='v0.4.27.53'){assert.equal(appBuild,'20260901-v042753-p0b5-canonical-key-gap-admission-replay');assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.53-v042753-p0b5-canonical-key-gap-admission-replay');assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-f','.53 local admission must not globally bump static master');assert.ok(versionSource.includes("// app_version: 'v0.4.27.52'"));}
else if(appVersion==='v0.4.27.54'){assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion');assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-g');assert.ok(versionSource.includes("// app_version: 'v0.4.27.53'"));}
else assert.fail(`B4 successor release not governed: ${appVersion}`);
assert.ok(versionSource.includes("// app_version: 'v0.4.27.49'"));assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-display-name-authority\.js/g)||[]).length,1);assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-family-authority\.js/g)||[]).length,1);assert.ok(workflowSource.includes('node scripts/v042750-p0b4-candy-display-name-authority-contract.mjs'));
console.log(JSON.stringify({status:'PASS',gate:'V042750_P0B4_PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY',authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,admitted_exact_zh_tw_display_name_rows:rows.length,verified_display_names:rows.map(row=>row.candy_display_name),app_version:appVersion,app_build:appBuild,semantics:{family_level_display_name_resolution:true,exact_official_zh_tw_evidence_only:true,unverified_family_review_required:true,legacy_candy_master_mutation:false,player_inventory_migration:false,professor_transfer_write_change:false,successor_release_exact:true}},null,2));
await import('./v042751-p0b5-candy-quantity-confirmation-contract.mjs');