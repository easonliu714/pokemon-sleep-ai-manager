import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDY_QUANTITY_CONFIRMATION_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  CANDY_QUANTITY_CONFIRMATION_POLICY,
  CANDY_QUANTITY_PENDING_REASON,
  applyCandyGovernedRecognitionResolution,
  buildCandyQuantityGovernedRecognitionPrompt,
  buildPublicMasterCatalogSnapshot,
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  confirmCandyScreenshotQuantity,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA,PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const snapshot=buildPublicMasterCatalogSnapshot('candies');
const candidate=snapshot.rows.find(row=>row.candy_id&&row.candy_name);
assert.ok(candidate,'Candy Master must expose at least one stable candidate');

assert.equal(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,'candy-quantity-confirmation-authority-2026-09-01-c');
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.screenshot_quantity_is_candidate_only,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.identity_confirmation_is_quantity_confirmation,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.explicit_user_confirmation_required_before_write,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.zero_is_valid_when_explicitly_confirmed,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.missing_or_null_is_no_update,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.external_game_changes_auto_sync_guaranteed,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.professor_observed_delta_semantics_changed,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.player_quantity_write_authority,'USER_EXPLICIT_CONFIRMATION_ONLY');
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.ai_identity_exact_display_match_required,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.public_master_gap_player_write,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.candy_id_only_gemini_key_compatibility_bridge,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.replay_requires_exact_observed_text_to_current_master,true);

function recognition({status='MATCHED',quantity=12,observationId='candy-observation-001',generatedAt='2026-08-31T11:00:00.000Z'}={}){
  return {schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:snapshot.scenario,authority:snapshot.authority,data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:generatedAt,visible_target_count:1,observations:[{observation_id:observationId,status,observed_text:candidate.candy_name,observed_data:{quantity},...(status==='MATCHED'?{canonical_key:{candy_id:candidate.candy_id},canonical_name:candidate.candy_name}:{}),source_image_ref:'candy-image-001',confidence:0.98,reason:'quantity visible in screenshot'}]};
}

const aiMatched=recognition();
const beforeConfirmation=compileCandyQuantityGovernedRecognitionToUpdatePackage(aiMatched,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(beforeConfirmation.ok,false);
assert.equal(beforeConfirmation.errors.length,0,beforeConfirmation.errors.join('\n'));
assert.equal(beforeConfirmation.update_package.operations.length,0);
assert.equal(beforeConfirmation.unresolved[0].reason,CANDY_QUANTITY_PENDING_REASON);

const confirmed=confirmCandyScreenshotQuantity(aiMatched,'candies','candy-observation-001',{confirmedAt:'2026-08-31T11:01:00.000Z'});
assert.equal(confirmed.observations[0].user_resolution.action,CANDY_QUANTITY_CONFIRMATION_ACTION);
const afterConfirmation=compileCandyQuantityGovernedRecognitionToUpdatePackage(confirmed,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(afterConfirmation.ok,true,afterConfirmation.errors?.join('\n'));
assert.equal(afterConfirmation.update_package.operations.length,1);
assert.deepEqual(afterConfirmation.update_package.operations[0].key,{candy_id:candidate.candy_id});
assert.equal(afterConfirmation.update_package.operations[0].data.quantity,12);
assert.equal(afterConfirmation.update_package.operations[0].evidence.quantity_confirmed_by_user,true);

const ambiguous=recognition({status:'AMBIGUOUS',quantity:9,observationId:'candy-observation-identity'});
ambiguous.observations[0].candidate_names=[candidate.candy_name];
const identityConfirmed=applyCandyGovernedRecognitionResolution(ambiguous,'candies','candy-observation-identity','MATCH',candidate.candy_name);
assert.equal(identityConfirmed.observations[0].user_resolution.action,'USER_CONFIRMED_MATCH');
const identityOnlyCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(identityConfirmed,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(identityOnlyCompile.ok,false);
assert.equal(identityOnlyCompile.update_package.operations.length,0);
assert.equal(identityOnlyCompile.unresolved[0].reason,CANDY_QUANTITY_PENDING_REASON);

const zeroRecognition=recognition({quantity:0,observationId:'candy-observation-zero',generatedAt:'2026-08-31T11:02:00.000Z'});
const zeroConfirmed=confirmCandyScreenshotQuantity(zeroRecognition,'candies','candy-observation-zero',{confirmedAt:'2026-08-31T11:03:00.000Z'});
const zeroCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(zeroConfirmed,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(zeroCompile.ok,true);
assert.deepEqual(zeroCompile.update_package.operations[0].key,{candy_id:candidate.candy_id});
assert.equal(zeroCompile.update_package.operations[0].data.quantity,0);

const prompt=buildCandyQuantityGovernedRecognitionPrompt('candies',{sessionId:'contract-session',coverage:'PARTIAL',imageMap:[{image_ref:'candy-image-001',file_name:'candy.png'}]});
assert.match(prompt,/OCR／視覺辨識候選值/);
assert.match(prompt,/observed_text 必須與你選擇的 canonical candy_name 逐字一致/);
assert.match(prompt,/canonical_key 的穩定 identity 是 candy_id/);
assert.match(prompt,/建立本機 Public Candy admission/);

const uiSource=read('assets/js/candy-quantity-screenshot-ui.js');
const admissionUiSource=read('assets/js/candy-public-master-admission-ui.js');
const inventoryUiSource=read('assets/js/candy-inventory-ui.js');
const professorSource=read('assets/js/pokemon-professor-transfer.js');
const versionSource=read('assets/js/version-authority.js');
const serviceWorkerSource=read('service-worker.js');
assert.match(uiSource,/我已核對遊戲畫面，確認數量/);
assert.match(uiSource,/Gemini Raw JSON（唯讀、immutable）/);
assert.match(admissionUiSource,/建立公版糖果並重新對應/);
assert.match(inventoryUiSource,/candy-quantity-screenshot-ui\.js/);
assert.match(inventoryUiSource,/candy-public-master-admission-ui\.js/);
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professorSource.includes('candy-quantity-confirmation-authority.js'),false);

const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(appVersion==='v0.4.27.51')assert.equal(appBuild,'20260831-v042751-p0b5-candy-quantity-confirmation');
else if(appVersion==='v0.4.27.52')assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');
else if(appVersion==='v0.4.27.53'){
  assert.equal(appBuild,'20260901-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.53-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.52'"));
}else if(appVersion==='v0.4.27.54'){
  assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.53'"));
}else if(appVersion==='v0.4.27.55'){
  assert.equal(appBuild,'20260901-v042755-p0b6-candy-family-storage-reconciliation');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation');
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.54'"));
}else assert.fail(`B5 successor release not governed: ${appVersion}`);
assert.ok(versionSource.includes("// app_version: 'v0.4.27.50'"));
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/candy-inventory-ui\.js/g)||[]).length,1);
assert.match(serviceWorkerSource,/querySafeCacheMatch\(event\.request\)/);

console.log(JSON.stringify({status:'PASS',gate:'V042751_P0B5_CANDY_QUANTITY_CONFIRMATION_AUTHORITY',authority_version:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,app_version:appVersion,app_build:appBuild,semantics:{ai_quantity_candidate_only:true,explicit_quantity_confirmation_required:true,confirmed_zero_is_valid:true,storage_key_candy_id_only:true,candy_id_only_gemini_key_bridge:true,provider_raw_json_immutable:true,professor_observed_delta_unchanged:true}},null,2));

if(['v0.4.27.52','v0.4.27.53','v0.4.27.54','v0.4.27.55'].includes(appVersion))await import('./v042752-p0b5-gap-identity-raw-evidence-hotfix-contract.mjs');