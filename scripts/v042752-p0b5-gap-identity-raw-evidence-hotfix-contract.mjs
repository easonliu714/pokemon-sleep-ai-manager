import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDY_IDENTITY_MISMATCH_REASON,
  CANDY_PUBLIC_MASTER_GAP_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  applyCandyGovernedRecognitionResolution,
  buildPublicMasterCatalogSnapshot,
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  confirmCandyScreenshotQuantity,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {
  PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_MASTER_VERSION,
  buildPublicCandyMasterRows,
} from '../assets/js/public-candy-master.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA,PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const snapshot=buildPublicMasterCatalogSnapshot('candies');
const chimchar=snapshot.rows.find(row=>row.candy_name==='小火焰猴的糖果');
const monferno=snapshot.rows.find(row=>row.candy_name==='猛火猴的糖果');
assert.ok(chimchar,'source-verified Chimchar legacy Candy candidate must exist');
assert.ok(monferno,'Monferno legacy Candy candidate must remain for compatibility');
assert.notEqual(chimchar.candy_id,monferno.candy_id,'legacy candy IDs must remain distinct until a separate migration gate');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-f');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,1);
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS[0].species_name,'小火焰猴');
assert.ok(buildPublicCandyMasterRows().some(row=>row.candy_name==='小火焰猴的糖果'));

function payload(observation){
  return {
    schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
    recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
    scenario:snapshot.scenario,
    authority:snapshot.authority,
    data_version:snapshot.data_version,
    catalog_snapshot_id:snapshot.catalog_snapshot_id,
    generated_at:'2026-09-01T01:00:00.000Z',
    visible_target_count:1,
    observations:[observation],
  };
}

const geminiWrongCanonical=payload({
  observation_id:'chimchar-wrong-canonical',
  status:'MATCHED',
  observed_text:'小火焰猴的糖果',
  observed_data:{quantity:188},
  canonical_key:{candy_id:monferno.candy_id,candy_name:monferno.candy_name},
  canonical_name:monferno.candy_name,
  source_image_ref:'candy-image-001',
  confidence:0.99,
  reason:'synthetic replay of cross-name canonical selection',
});
const blocked=compileCandyQuantityGovernedRecognitionToUpdatePackage(geminiWrongCanonical,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(blocked.ok,false,'Gemini cross-name MATCH must fail closed');
assert.equal(blocked.update_package.operations.length,0,'cross-name MATCH must compile zero player writes');
assert.equal(blocked.unresolved.length,1);
assert.equal(blocked.unresolved[0].reason,CANDY_IDENTITY_MISMATCH_REASON);
assert.equal(blocked.unresolved[0].review_kind,'candy_identity_confirmation');
assert.equal(blocked.unresolved[0].observed_text,'小火焰猴的糖果');
assert.equal(blocked.unresolved[0].canonical_name,'猛火猴的糖果');

const ambiguous=payload({
  observation_id:'chimchar-human-resolution',
  status:'AMBIGUOUS',
  observed_text:'小火焰猴的糖果',
  observed_data:{quantity:188},
  candidate_names:['小火焰猴的糖果','猛火猴的糖果'],
  source_image_ref:'candy-image-001',
  confidence:0.9,
  reason:'candidate review',
});
const identityResolved=applyCandyGovernedRecognitionResolution(ambiguous,'candies','chimchar-human-resolution','MATCH','小火焰猴的糖果');
assert.equal(identityResolved.observations[0].canonical_name,'小火焰猴的糖果');
assert.equal(identityResolved.observations[0].user_resolution.action,'USER_CONFIRMED_MATCH');
const quantityResolved=confirmCandyScreenshotQuantity(identityResolved,'candies','chimchar-human-resolution',{confirmedAt:'2026-09-01T01:01:00.000Z'});
const resolved=compileCandyQuantityGovernedRecognitionToUpdatePackage(quantityResolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(resolved.ok,true,resolved.errors?.join('\n'));
assert.equal(resolved.update_package.operations.length,1);
assert.deepEqual(resolved.update_package.operations[0].key,{candy_id:chimchar.candy_id});
assert.equal(resolved.update_package.operations[0].data.quantity,188);
assert.equal(resolved.update_package.operations[0].evidence.candy_identity_user_confirmed,true);

const gapRaw=payload({
  observation_id:'unknown-gap',
  status:'UNMATCHED',
  observed_text:'未知但畫面確實存在的糖果',
  observed_data:{quantity:47},
  source_image_ref:'candy-image-001',
  confidence:0.95,
  reason:'PUBLIC_MASTER_NO_RELIABLE_MATCH',
});
const gapResolved=applyCandyGovernedRecognitionResolution(gapRaw,'candies','unknown-gap','MASTER_GAP');
assert.equal(gapResolved.observations[0].user_resolution.action,CANDY_PUBLIC_MASTER_GAP_ACTION);
const gapCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(gapResolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(gapCompile.ok,true,'confirmed Public Master gap must be terminal review, not an endless unresolved blocker');
assert.equal(gapCompile.unresolved.length,0);
assert.equal(gapCompile.update_package.operations.length,0,'Public Master gap must never write player candy quantity');
assert.equal(gapCompile.summary.candy_public_master_gap_confirmed_count,1);
assert.ok(gapCompile.warnings.some(value=>value.includes('Public Master gap')));

assert.equal(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,'candy-quantity-confirmation-authority-2026-09-01-b');
const uiSource=read('assets/js/candy-quantity-screenshot-ui.js');
assert.match(uiSource,/provider_raw:''/);
assert.match(uiSource,/working_raw:''/);
assert.match(uiSource,/state\.provider_raw=String\(analysis\.raw_json/);
assert.match(uiSource,/state\.working_raw=state\.provider_raw/);
assert.match(uiSource,/Gemini Raw JSON（唯讀、immutable）/);
assert.match(uiSource,/Working \/ Resolved Recognition JSON/);
assert.match(uiSource,/Compile \/ Update Package（唯讀）/);
assert.match(uiSource,/readonly/);
assert.match(uiSource,/從 Raw 重設 Working JSON/);
assert.match(uiSource,/已確認 Public Master gap/);
assert.match(uiSource,/EXACT_IDENTITY_MISMATCH/);
assert.ok(!uiSource.includes("state.provider_raw=JSON.stringify(mutator"),'manual resolution must never rewrite provider raw');

const versionSource=read('assets/js/version-authority.js');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(appVersion,'v0.4.27.52');
assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');
assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.52-v042752-p0b5-gap-identity-raw-evidence-hotfix');
assert.ok(versionSource.includes("// app_version: 'v0.4.27.51'"));
assert.ok(versionSource.includes("// app_build: '20260831-v042751-p0b5-candy-quantity-confirmation'"));
assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.51-v042751-p0b5-candy-quantity-confirmation'"));
assert.ok(versionSource.includes("// app_version: 'v0.3.96'"),'full historical parser bridge chain must remain');

const professorSource=read('assets/js/pokemon-professor-transfer.js');
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professorSource.includes('candy-quantity-confirmation-authority.js'),false);

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042752_P0B5_GAP_IDENTITY_RAW_EVIDENCE_HOTFIX',
  app_version:appVersion,
  app_build:appBuild,
  candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  authority_version:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  synthetic_replay:{
    observed_text:'小火焰猴的糖果',
    wrong_canonical:'猛火猴的糖果',
    wrong_auto_match_blocked:true,
    human_resolved_candy_id:chimchar.candy_id,
    confirmed_quantity:188,
  },
  semantics:{
    provider_raw_immutable:true,
    working_json_separate:true,
    compile_json_separate:true,
    master_gap_terminal_nonwrite:true,
    exact_candy_identity_gate:true,
    chimchar_legacy_candidate_added_from_source_verified_family_evidence:true,
    player_quantity_migration:false,
    family_candy_id_consolidation:false,
    professor_semantics_unchanged:true,
  },
},null,2));