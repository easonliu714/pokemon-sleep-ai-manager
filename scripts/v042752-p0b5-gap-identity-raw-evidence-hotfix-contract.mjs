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
import {PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS,PUBLIC_CANDY_MASTER_VERSION,buildPublicCandyMasterRows} from '../assets/js/public-candy-master.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA,PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const patch=Number(appVersion.match(/^v0\.4\.27\.(\d+)(?:\.\d+)*$/)?.[1]||-1);
const hotfix55=Number(appVersion.match(/^v0\.4\.27\.55\.(\d+)(?:\.\d+)*$/)?.[1]||0);
const successor54=patch>=54;
const successor53=patch>=53;
const successor55=patch>=55;
const localGapDurabilitySuccessor=patch>55||(patch===55&&hotfix55>=2);
const snapshot=buildPublicMasterCatalogSnapshot('candies');
const chimchar=snapshot.rows.find(row=>row.candy_name==='小火焰猴的糖果');
const monferno=snapshot.rows.find(row=>row.candy_name==='猛火猴的糖果');
assert.ok(chimchar);assert.ok(monferno);assert.notEqual(chimchar.candy_id,monferno.candy_id);
assert.equal(PUBLIC_CANDY_MASTER_VERSION,successor54?'public-candy-master-2026-09-01-g':'public-candy-master-2026-09-01-f');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,1,'legacy compatibility additions remain exactly one');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS[0].species_name,'小火焰猴');
assert.ok(buildPublicCandyMasterRows().some(row=>row.candy_name==='小火焰猴的糖果'));

function payload(observation){return {schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:snapshot.scenario,authority:snapshot.authority,data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-09-01T01:00:00.000Z',visible_target_count:1,observations:[observation]};}

const geminiWrongCanonical=payload({observation_id:'chimchar-wrong-canonical',status:'MATCHED',observed_text:'小火焰猴的糖果',observed_data:{quantity:188},canonical_key:{candy_id:monferno.candy_id},canonical_name:monferno.candy_name,source_image_ref:'candy-image-001',confidence:0.99,reason:'synthetic replay'});
const blocked=compileCandyQuantityGovernedRecognitionToUpdatePackage(geminiWrongCanonical,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(blocked.ok,false);assert.equal(blocked.errors.length,0,blocked.errors.join('\n'));assert.equal(blocked.update_package.operations.length,0);assert.equal(blocked.unresolved[0].reason,CANDY_IDENTITY_MISMATCH_REASON);

const ambiguous=payload({observation_id:'chimchar-human-resolution',status:'AMBIGUOUS',observed_text:'小火焰猴的糖果',observed_data:{quantity:188},candidate_names:['小火焰猴的糖果','猛火猴的糖果'],source_image_ref:'candy-image-001',confidence:0.9,reason:'candidate review'});
const identityResolved=applyCandyGovernedRecognitionResolution(ambiguous,'candies','chimchar-human-resolution','MATCH','小火焰猴的糖果');
const quantityResolved=confirmCandyScreenshotQuantity(identityResolved,'candies','chimchar-human-resolution',{confirmedAt:'2026-09-01T01:01:00.000Z'});
const resolved=compileCandyQuantityGovernedRecognitionToUpdatePackage(quantityResolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(resolved.ok,true,resolved.errors?.join('\n'));assert.deepEqual(resolved.update_package.operations[0].key,{candy_id:chimchar.candy_id});assert.equal(resolved.update_package.operations[0].data.quantity,188);

// Historical .52 terminal gap behavior remains valid for old Working JSON. .53+
// UI no longer requires this intermediate action before local admission.
const gapRaw=payload({observation_id:'unknown-gap',status:'UNMATCHED',observed_text:'未知但畫面確實存在的糖果',observed_data:{quantity:47},source_image_ref:'candy-image-001',confidence:0.95,reason:'PUBLIC_MASTER_NO_RELIABLE_MATCH'});
const gapResolved=applyCandyGovernedRecognitionResolution(gapRaw,'candies','unknown-gap','MASTER_GAP');
assert.equal(gapResolved.observations[0].user_resolution.action,CANDY_PUBLIC_MASTER_GAP_ACTION);
const gapCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(gapResolved,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(gapCompile.ok,true);assert.equal(gapCompile.unresolved.length,0);assert.equal(gapCompile.update_package.operations.length,0);

assert.equal(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,successor53?'candy-quantity-confirmation-authority-2026-09-01-c':'candy-quantity-confirmation-authority-2026-09-01-b');
const uiSource=read('assets/js/candy-quantity-screenshot-ui.js');
assert.match(uiSource,/provider_raw:''/);assert.match(uiSource,/working_raw:''/);assert.match(uiSource,/Gemini Raw JSON（唯讀、immutable）/);assert.match(uiSource,/EXACT_IDENTITY_MISMATCH/);assert.ok(!uiSource.includes('state.provider_raw=JSON.stringify(mutator'));
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.55.3'){
  assert.equal(appBuild,'20260902-v0427553-mobile-snapshot-candy-ui-performance');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.3-v0427553-mobile-snapshot-candy-ui-performance');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55.2'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.54'"));
}else if(appVersion==='v0.4.27.55.2'){
  assert.equal(appBuild,'20260902-v0427552-local-gap-field-precedence');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.2-v0427552-local-gap-field-precedence');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55'"));
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.54'"));
}else if(appVersion==='v0.4.27.55.1'){
  assert.equal(appBuild,'20260902-v0427551-visible-target-count-confirmation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55.1-v0427551-visible-target-count-confirmation');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55'"));
}else if(appVersion==='v0.4.27.55'){
  assert.equal(appBuild,'20260901-v042755-p0b6-candy-family-storage-reconciliation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.54'"));
}else if(appVersion==='v0.4.27.54'){
  assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.53'"));
}else if(appVersion==='v0.4.27.53'){
  assert.equal(appBuild,'20260901-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.53-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.52'"));
}else{
  assert.equal(appVersion,'v0.4.27.52');assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');
}
assert.ok(versionSource.includes("// app_version: 'v0.3.96'"));
const professorSource=read('assets/js/pokemon-professor-transfer.js');assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);assert.equal(professorSource.includes('candy-quantity-confirmation-authority.js'),false);

console.log(JSON.stringify({status:'PASS',gate:'V042752_P0B5_GAP_IDENTITY_RAW_EVIDENCE_HOTFIX',app_version:appVersion,app_build:appBuild,candy_master_version:PUBLIC_CANDY_MASTER_VERSION,authority_version:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,nested_hotfix_version_supported:patch===55&&hotfix55>=1,local_gap_durability_successor:localGapDurabilitySuccessor,semantics:{provider_raw_immutable:true,historical_master_gap_terminal_nonwrite:true,exact_candy_identity_gate:true,chimchar_cross_name_blocked:true,source_controlled_screenshot_promotion:successor54,player_quantity_migration:false,family_candy_id_consolidation:false,professor_semantics_unchanged:true}},null,2));
if(successor53)await import('./v042753-p0b5-canonical-key-gap-admission-replay-contract.mjs');