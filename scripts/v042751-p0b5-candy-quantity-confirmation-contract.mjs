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

assert.equal(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,'candy-quantity-confirmation-authority-2026-08-31-a');
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.screenshot_quantity_is_candidate_only,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.identity_confirmation_is_quantity_confirmation,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.explicit_user_confirmation_required_before_write,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.zero_is_valid_when_explicitly_confirmed,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.missing_or_null_is_no_update,true);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.external_game_changes_auto_sync_guaranteed,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.professor_observed_delta_semantics_changed,false);
assert.equal(CANDY_QUANTITY_CONFIRMATION_POLICY.player_quantity_write_authority,'USER_EXPLICIT_CONFIRMATION_ONLY');

function recognition({status='MATCHED',quantity=12,observationId='candy-observation-001',generatedAt='2026-08-31T11:00:00.000Z'}={}){
  return {
    schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,
    recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,
    scenario:snapshot.scenario,
    authority:snapshot.authority,
    data_version:snapshot.data_version,
    catalog_snapshot_id:snapshot.catalog_snapshot_id,
    generated_at:generatedAt,
    visible_target_count:1,
    observations:[{
      observation_id:observationId,status,observed_text:candidate.candy_name,observed_data:{quantity},
      ...(status==='MATCHED'?{canonical_key:{candy_id:candidate.candy_id,candy_name:candidate.candy_name},canonical_name:candidate.candy_name}:{}),
      source_image_ref:'candy-image-001',confidence:0.98,reason:'quantity visible in screenshot',
    }],
  };
}

const aiMatched=recognition();
const beforeConfirmation=compileCandyQuantityGovernedRecognitionToUpdatePackage(aiMatched,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(beforeConfirmation.ok,false,'AI MATCHED must not authorize screenshot quantity write');
assert.equal(beforeConfirmation.update_package.operations.length,0,'unconfirmed screenshot quantity must compile to zero writes');
assert.equal(beforeConfirmation.unresolved.length,1);
assert.equal(beforeConfirmation.unresolved[0].reason,CANDY_QUANTITY_PENDING_REASON);
assert.equal(beforeConfirmation.unresolved[0].review_kind,'candy_quantity_confirmation');
assert.equal(beforeConfirmation.summary.candy_quantity_pending_count,1);

const confirmed=confirmCandyScreenshotQuantity(aiMatched,'candies','candy-observation-001',{confirmedAt:'2026-08-31T11:01:00.000Z'});
assert.equal(confirmed.observations[0].user_resolution.action,CANDY_QUANTITY_CONFIRMATION_ACTION);
assert.equal(confirmed.observations[0].user_resolution.confirmed_quantity,12);
const afterConfirmation=compileCandyQuantityGovernedRecognitionToUpdatePackage(confirmed,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(afterConfirmation.ok,true,afterConfirmation.errors?.join('\n'));
assert.equal(afterConfirmation.unresolved.length,0);
assert.equal(afterConfirmation.update_package.operations.length,1);
assert.equal(afterConfirmation.update_package.operations[0].entity,'candy_inventory');
assert.equal(afterConfirmation.update_package.operations[0].data.quantity,12);
assert.equal(afterConfirmation.update_package.operations[0].evidence.quantity_candidate_source,'OCR_SCREENSHOT_HINT');
assert.equal(afterConfirmation.update_package.operations[0].evidence.quantity_confirmation_authority,CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION);
assert.equal(afterConfirmation.update_package.operations[0].evidence.quantity_confirmation_action,CANDY_QUANTITY_CONFIRMATION_ACTION);
assert.equal(afterConfirmation.update_package.operations[0].evidence.quantity_confirmed_by_user,true);
assert.equal(afterConfirmation.update_package.operations[0].evidence.confirmed_quantity,12);
assert.equal(afterConfirmation.update_package.operations[0].evidence.external_game_changes_auto_sync_guaranteed,false);

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
assert.equal(zeroCompile.update_package.operations[0].data.quantity,0);
assert.equal(zeroCompile.update_package.operations[0].evidence.confirmed_quantity,0);

const prompt=buildCandyQuantityGovernedRecognitionPrompt('candies',{sessionId:'contract-session',coverage:'PARTIAL',imageMap:[{image_ref:'candy-image-001',file_name:'candy.png'}]});
assert.match(prompt,/OCR／視覺辨識候選值/);
assert.match(prompt,/逐筆確認目前遊戲內糖果庫存數量/);
assert.match(prompt,/看不到數量時省略，不得補 0/);
assert.match(prompt,/遊戲外部變動不保證自動同步/);

const uiSource=read('assets/js/candy-quantity-screenshot-ui.js');
const inventoryUiSource=read('assets/js/candy-inventory-ui.js');
const professorSource=read('assets/js/pokemon-professor-transfer.js');
const versionSource=read('assets/js/version-authority.js');
const serviceWorkerSource=read('service-worker.js');
assert.match(uiSource,/我已核對遊戲畫面，確認數量/);
assert.match(uiSource,/OCR／AI 讀到的糖果數量只是候選值/);
assert.match(uiSource,/compileCandyQuantityGovernedRecognitionToUpdatePackage/);
assert.match(inventoryUiSource,/candy-quantity-screenshot-ui\.js/);
assert.match(inventoryUiSource,/USER_CONFIRMATION_REQUIRED/);
assert.match(professorSource,/PROFESSOR_TRANSFER_VERSION='pokemon-professor-transfer-2026-08-27-p0b1'/);
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professorSource.includes('candy-quantity-confirmation-authority.js'),false,'B5 must not alter Professor observed-delta authority');

const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
assert.equal(appVersion,'v0.4.27.51');
assert.equal(appBuild,'20260831-v042751-p0b5-candy-quantity-confirmation');
assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.51-v042751-p0b5-candy-quantity-confirmation');
assert.ok(versionSource.includes("// app_version: 'v0.4.27.50'"),'v0.4.27.50 predecessor version bridge must remain');
assert.ok(versionSource.includes("// app_build: '20260831-v042750-p0b4-candy-display-name-authority'"),'v0.4.27.50 predecessor build bridge must remain');
assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.50-v042750-p0b4-candy-display-name-authority'"),'v0.4.27.50 predecessor cache bridge must remain');
// candy-inventory-ui is an install-time precached root. The service worker's
// network-first script policy caches its new B5 module dependencies during the
// required first online load, then serves them via querySafeCacheMatch offline.
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/candy-inventory-ui\.js/g)||[]).length,1,'Candy inventory root must remain precached exactly once');
assert.match(serviceWorkerSource,/const isScript=sameOrigin/);
assert.match(serviceWorkerSource,/caches\.open\(CACHE\)\.then\(cache=>cache\.put\(event\.request,copy\)\)/);
assert.match(serviceWorkerSource,/querySafeCacheMatch\(event\.request\)/);

console.log(JSON.stringify({
  status:'PASS',gate:'V042751_P0B5_CANDY_QUANTITY_CONFIRMATION_AUTHORITY',
  authority_version:CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  sample_candy:{candy_id:candidate.candy_id,candy_name:candidate.candy_name},
  app_version:appVersion,app_build:appBuild,
  offline_after_first_online_load:true,
  semantics:{
    ai_quantity_candidate_only:true,identity_confirmation_not_quantity_confirmation:true,
    explicit_quantity_confirmation_required:true,confirmed_zero_is_valid:true,
    unconfirmed_compiles_zero_writes:true,external_change_auto_sync_guaranteed:false,
    professor_observed_delta_unchanged:true,predecessor_b4_exact_bridge_preserved:true,
  },
},null,2));
