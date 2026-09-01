import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY,
  PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_MASTER_VERSION,
  buildPublicCandyMasterRows,
} from '../assets/js/public-candy-master.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,
  commitPublicCandyLocalAdmission,
  preparePublicCandyLocalAdmission,
  publicCandyLocalAdmissionRows,
} from '../assets/js/public-candy-local-admission-authority.js';
import {resolvePublicPokemonSpeciesAuthority} from '../assets/js/public-pokemon-species-authority.js';
import {
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  replayCandyRecognitionAgainstCurrentMaster,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const expectedSpecies=['草苗龜','木守宮','小鍛匠','波加曼','水躍魚','摔角鷹人','火稚雞','菊草葉'];
const normalize=value=>String(value??'').trim().normalize('NFKC');
const expectedNames=expectedSpecies.map(name=>`${name}的糖果`);

assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-g');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,1,'historical Chimchar compatibility evidence remains exactly one');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS[0].species_name,'小火焰猴');
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.trust_tier,'OFFICIAL_EQUIVALENT_FOR_VISIBLE_IN_GAME_IDENTITY');
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.public_species_exact_authority_required,true);
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.player_quantity_promoted,false);
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.screenshot_bytes_committed,false);
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.private_raw_json_committed,false);
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_POLICY.family_id_consolidation,false);
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS.length,8);
assert.deepEqual(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS.map(row=>row.species_name).sort(),[...expectedSpecies].sort());
for(const row of PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS){
  const authority=resolvePublicPokemonSpeciesAuthority(row.species_name);
  assert.equal(authority.status,'MATCH',`screenshot promotion requires exact Public Species Authority: ${row.species_name}`);
  assert.equal(normalize(authority.display_name_zh_tw),normalize(row.species_name));
  assert.equal(row.verification_status,'GAME_SCREENSHOT_VERIFIED');
  assert.match(row.source_ref,/^project-evidence:2026-09-01-p0b5-ingame-candy#obs_/);
  assert.equal(Object.prototype.hasOwnProperty.call(row,'quantity'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(row,'observed_data'),false);
}

// Fresh-profile proof: source-controlled rows must exist with no local admission.
globalThis.localStorage?.clear?.();
assert.equal(publicCandyLocalAdmissionRows().length,0);
const freshRows=buildPublicCandyMasterRows();
for(const candyName of expectedNames){
  const matches=freshRows.filter(row=>normalize(row.candy_name)===normalize(candyName));
  assert.equal(matches.length,1,`fresh profile must expose exactly one global row: ${candyName}`);
  const row=matches[0];
  assert.equal(row.verification_status,'GAME_SCREENSHOT_VERIFIED_SOURCE_CONTROLLED');
  assert.equal(row.source_type,'game_screenshot_verified');
  assert.equal(row.source_name,'User-confirmed Pokémon Sleep in-game screenshot');
  assert.equal(Object.prototype.hasOwnProperty.call(row,'quantity'),false,'global Public Candy row must never carry player quantity');
}

// Replay an old-provider style set containing only names/evidence, deliberately
// omitting private player quantities. All eight formerly-unmatched identities
// must become MATCHED from the source-controlled master without local admission.
const snapshot=buildPublicMasterCatalogSnapshot('candies');
const oldLike={
  schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
  recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
  scenario:'candy_inventory_update',
  authority:'candy_master',
  data_version:'historical-public-candy-master-before-v042754',
  catalog_snapshot_id:'historical-candy-master-before-v042754',
  generated_at:'2026-09-01T03:00:00.000Z',
  visible_target_count:expectedNames.length,
  observations:expectedNames.map((name,index)=>({observation_id:`promotion-${index+1}`,status:'UNMATCHED',observed_text:name,observed_data:{},source_image_ref:'synthetic-promotion-image',confidence:1})),
};
const oldBytes=JSON.stringify(oldLike);
const replay=replayCandyRecognitionAgainstCurrentMaster(oldLike,'candies');
assert.equal(JSON.stringify(oldLike),oldBytes,'global promotion replay must not mutate provider Raw');
assert.equal(replay.replayed_count,8);
assert.equal(replay.payload.data_version,PUBLIC_CANDY_MASTER_VERSION);
for(const observation of replay.payload.observations){
  assert.equal(observation.status,'MATCHED');
  assert.equal(normalize(observation.observed_text),normalize(observation.canonical_name));
  assert.deepEqual(Object.keys(observation.canonical_key),['candy_id']);
}
const noQuantityCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(replay.payload,'candies',{allowedImageRefs:['synthetic-promotion-image']});
assert.equal(noQuantityCompile.update_package.operations.length,0,'global identity promotion must never auto-write player quantity');

// Existing-device migration safety: an old .53 local admission for an identity
// now global must be tolerated as an exact duplicate, with the global row winning.
const promotedObservation={observation_id:'old-local-promoted',status:'UNMATCHED',observed_text:'波加曼的糖果',observed_data:{},source_image_ref:'synthetic-old-local-image',confidence:1};
const promotedLocal=preparePublicCandyLocalAdmission({observation:promotedObservation,confirmedAt:'2026-09-01T03:01:00.000Z'});
commitPublicCandyLocalAdmission(promotedLocal);
assert.ok(globalThis.localStorage?.getItem?.(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));
const withDuplicate=buildPublicCandyMasterRows();
const piplupRows=withDuplicate.filter(row=>normalize(row.candy_name)===normalize('波加曼的糖果'));
assert.equal(piplupRows.length,1,'global promotion must absorb an exact legacy local duplicate without collision');
assert.equal(piplupRows[0].source_type,'game_screenshot_verified','source-controlled global authority must win over local duplicate');

// Future gap fallback remains available after .54 and its .55 successor.
globalThis.localStorage?.clear?.();
const futureName='托戈德瑪爾的糖果';
assert.equal(buildPublicCandyMasterRows().some(row=>normalize(row.candy_name)===normalize(futureName)),false,'fixture must remain outside the .54 promotion set');
const futureObservation={observation_id:'future-local-gap',status:'UNMATCHED',observed_text:futureName,observed_data:{},source_image_ref:'synthetic-future-gap-image',confidence:1};
const futureLocal=preparePublicCandyLocalAdmission({observation:futureObservation,confirmedAt:'2026-09-01T03:02:00.000Z'});
commitPublicCandyLocalAdmission(futureLocal);
assert.equal(buildPublicCandyMasterRows().some(row=>normalize(row.candy_name)===normalize(futureName)),true,'.53 local admission fallback must remain operational');

const masterSource=read('assets/js/public-candy-master.js');
assert.equal(masterSource.includes('0.4.27.52_Gemini.json'),false,'private Gemini JSON filename must not become repository provenance');
assert.equal(masterSource.includes('0.4.27.53_Gemini.json'),false,'private Gemini JSON filename must not become repository provenance');
assert.equal(masterSource.includes('observed_data:{quantity'),false,'Public Master source must not embed player quantity observations');
assert.match(masterSource,/player_quantity_promoted:false/);
assert.match(masterSource,/screenshot_bytes_committed:false/);
assert.match(masterSource,/private_raw_json_committed:false/);

const professor=read('assets/js/pokemon-professor-transfer.js');
assert.match(professor,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professor.includes('PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS'),false);
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.54'){
  assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion');
}else if(appVersion==='v0.4.27.55'){
  assert.equal(appBuild,'20260901-v042755-p0b6-candy-family-storage-reconciliation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation');
  assert.ok(version.includes("// app_version: 'v0.4.27.54'"));
  assert.ok(version.includes("// app_build: '20260901-v042754-p0b5-ingame-candy-master-promotion'"));
  assert.ok(version.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion'"));
}else assert.fail(`.54 promotion successor release not governed: ${appVersion}`);
assert.ok(version.includes("// app_version: 'v0.4.27.53'"));
assert.ok(version.includes("// app_version: 'v0.3.96'"));
assert.equal(fs.existsSync('.github/workflows/v042754-p0b5-ingame-candy-master-promotion.yml'),false,'no standalone .54 workflow may bypass governed consolidated CI topology');

console.log(JSON.stringify({status:'PASS',gate:'V042754_P0B5_INGAME_CANDY_MASTER_PROMOTION',predecessor_app_version:'v0.4.27.54',current_app_version:appVersion,candy_master_version:PUBLIC_CANDY_MASTER_VERSION,promotion_count:PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS.length,promoted_species:expectedSpecies,semantics:{ingame_visible_identity_official_equivalent:true,public_species_prerequisite:true,fresh_profile_global_rows:true,private_quantity_promoted:false,screenshot_bytes_committed:false,private_raw_json_committed:false,provider_raw_immutable:true,local_duplicate_absorbed_by_global_authority:true,future_local_admission_fallback_preserved:true,family_id_consolidation:false,player_inventory_migration_owned_by_this_phase:false,professor_semantics_unchanged:true,successor_p0b6_allowed:appVersion==='v0.4.27.55'}},null,2));