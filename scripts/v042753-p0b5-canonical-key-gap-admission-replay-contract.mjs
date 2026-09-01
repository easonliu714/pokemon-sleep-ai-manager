import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDY_PUBLIC_MASTER_REPLAY_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  confirmCandyScreenshotQuantity,
  normalizeCandyCanonicalKeyForBaseContract,
  replayCandyRecognitionAgainstCurrentMaster,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {
  PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_MASTER_VERSION,
  buildPublicCandyMasterRows,
} from '../assets/js/public-candy-master.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  PUBLIC_CANDY_LOCAL_ADMISSION_POLICY,
  PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,
  commitPublicCandyLocalAdmission,
  preparePublicCandyLocalAdmission,
  publicCandyLocalAdmissionFingerprint,
  publicCandyLocalAdmissionRows,
  removePublicCandyLocalAdmission,
} from '../assets/js/public-candy-local-admission-authority.js';
import {
  PUBLIC_MASTER_RECOGNITION_SCHEMA,
  PUBLIC_MASTER_RECOGNITION_VERSION,
  buildPublicMasterCatalogSnapshot,
} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
const occurrence=(source,needle)=>source.split(needle).length-1;
class FakeStorage{constructor(){this.map=new Map();}getItem(key){return this.map.has(key)?this.map.get(key):null;}setItem(key,value){this.map.set(key,String(value));}removeItem(key){this.map.delete(key);}clear(){this.map.clear();}}
const storage=new FakeStorage();
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
const version=read('assets/js/version-authority.js');
const appVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const successor54=appVersion==='v0.4.27.54';

assert.equal(PUBLIC_CANDY_MASTER_VERSION,successor54?'public-candy-master-2026-09-01-g':'public-candy-master-2026-09-01-f');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,1,'legacy compatibility additions must remain exactly one');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS[0].species_name,'小火焰猴');
assert.equal(PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS.length,successor54?8:0,'only .54 may globally promote the governed screenshot evidence set');
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,'public-candy-local-admission-2026-09-01-b');
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.observation_must_be_unmatched,true);
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.player_quantity_stored,false);
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.source_controlled_master_mutated,false);
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.storage_readback_verification,true);
assert.equal(PUBLIC_CANDY_LOCAL_ADMISSION_POLICY.family_id_consolidation,false);
assert.equal(publicCandyLocalAdmissionRows().length,0);
assert.equal(publicCandyLocalAdmissionFingerprint(),'none');
const masterSource=read('assets/js/public-candy-master.js');
if(successor54){
  assert.match(masterSource,/PUBLIC_CANDY_GAME_SCREENSHOT_EVIDENCE_ADDITIONS/);
  assert.match(masterSource,/player_quantity_promoted:false/);
}else{
  assert.match(masterSource,/does NOT pre-admit the user's newly observed gaps/);
}

const snapshot=buildPublicMasterCatalogSnapshot('candies');
const chimchar=snapshot.rows.find(row=>row.candy_name==='小火焰猴的糖果');
assert.ok(chimchar);
const rawMatched={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'candy_inventory_update',authority:'candy_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-09-01T02:00:00.000Z',visible_target_count:1,observations:[{observation_id:'obs-chimchar',status:'MATCHED',observed_text:'小火焰猴的糖果',observed_data:{quantity:188},canonical_key:{candy_id:chimchar.candy_id},canonical_name:'小火焰猴的糖果',source_image_ref:'candy-image-001',confidence:1}]};
const rawBytes=JSON.stringify(rawMatched);
const normalized=normalizeCandyCanonicalKeyForBaseContract(rawMatched,'candies');
assert.equal(JSON.stringify(rawMatched),rawBytes,'canonical-key bridge must never mutate Gemini Raw');
assert.deepEqual(normalized.observations[0].canonical_key,{candy_id:chimchar.candy_id,candy_name:'小火焰猴的糖果'});
const matchedCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(rawMatched,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(matchedCompile.errors.length,0,matchedCompile.errors.join('\n'));
assert.equal(matchedCompile.update_package.operations.length,0,'unconfirmed screenshot quantity must remain non-write');
assert.equal(matchedCompile.summary.candy_quantity_pending_count,1);

// Preserve .53 local-admission fallback on a governed species intentionally not
// included in the .54 promotion set. This fixture is synthetic and carries no
// user/private quantity evidence.
const fallbackCandyName='托戈德瑪爾的糖果';
assert.equal(buildPublicCandyMasterRows().some(row=>row.candy_name===fallbackCandyName),false,'fixture requires a future current-master gap');
const gapRaw={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'candy_inventory_update',authority:'candy_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-09-01T02:01:00.000Z',visible_target_count:1,observations:[{observation_id:'obs-future-gap',status:'UNMATCHED',observed_text:fallbackCandyName,observed_data:{quantity:7},source_image_ref:'synthetic-candy-image-001',confidence:0.95}]};
const gapBytes=JSON.stringify(gapRaw);
const prepared=preparePublicCandyLocalAdmission({observation:gapRaw.observations[0],confirmedAt:'2026-09-01T02:02:00.000Z'});
assert.equal(prepared.admission_action,PUBLIC_CANDY_LOCAL_ADMISSION_ACTION);
assert.equal(prepared.authority_version,PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION);
assert.equal(Object.prototype.hasOwnProperty.call(prepared,'quantity'),false,'Public Master admission must never contain player quantity');
assert.throws(()=>preparePublicCandyLocalAdmission({observation:{...gapRaw.observations[0],status:'MATCHED'}}),/只有 UNMATCHED/);
assert.throws(()=>preparePublicCandyLocalAdmission({observation:{...gapRaw.observations[0],observed_text:'托戈德瑪爾'}}),/exact/);
assert.throws(()=>preparePublicCandyLocalAdmission({observation:{...gapRaw.observations[0],observed_text:'不存在寶可夢的糖果'}}),/species authority/);

const admission=commitPublicCandyLocalAdmission(prepared);
assert.equal(admission.status,'CREATED');
assert.equal(publicCandyLocalAdmissionRows().length,1);
assert.notEqual(publicCandyLocalAdmissionFingerprint(),'none');
assert.ok(storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));
assert.equal(buildPublicCandyMasterRows().some(row=>row.candy_name===fallbackCandyName),true,'local admission must remain a current Public Master fallback');
const removed=removePublicCandyLocalAdmission(prepared.candy_id,{expectedObservationId:'obs-future-gap'});
assert.equal(removed.status,'REMOVED');
assert.equal(publicCandyLocalAdmissionRows().length,0,'compensating rollback must remove a newly-created local admission exactly');
assert.equal(commitPublicCandyLocalAdmission(prepared).status,'CREATED');

const replay=replayCandyRecognitionAgainstCurrentMaster(gapRaw,'candies');
assert.equal(JSON.stringify(gapRaw),gapBytes,'replay must not mutate Gemini Raw');
assert.equal(replay.replayed_count,1);
const replayed=replay.payload.observations[0];
assert.equal(replayed.status,'MATCHED');
assert.equal(replayed.observed_text,fallbackCandyName);
assert.equal(replayed.canonical_name,fallbackCandyName);
assert.equal(replayed.reason,CANDY_PUBLIC_MASTER_REPLAY_ACTION);
assert.ok(replayed.canonical_key.candy_id);
assert.equal(Object.keys(replayed.canonical_key).length,1,'working replay uses candy_id storage identity only');
const replayCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(replay.payload,'candies',{allowedImageRefs:['synthetic-candy-image-001']});
assert.equal(replayCompile.errors.length,0,replayCompile.errors.join('\n'));
assert.equal(replayCompile.update_package.operations.length,0,'admission/replay must not auto-confirm quantity');
assert.equal(replayCompile.summary.candy_quantity_pending_count,1);
const confirmed=confirmCandyScreenshotQuantity(replay.payload,'candies','obs-future-gap',{confirmedAt:'2026-09-01T02:03:00.000Z'});
const confirmedCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(confirmed,'candies',{allowedImageRefs:['synthetic-candy-image-001']});
assert.equal(confirmedCompile.ok,true,confirmedCompile.errors.join('\n'));
assert.equal(confirmedCompile.update_package.operations.length,1);
assert.equal(confirmedCompile.update_package.operations[0].data.quantity,7);
assert.deepEqual(confirmedCompile.update_package.operations[0].key,{candy_id:prepared.candy_id});

const localState=JSON.parse(storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));
localState.rows[0].quantity=7;
storage.setItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,JSON.stringify(localState));
assert.throws(()=>publicCandyLocalAdmissionRows(),/禁止包含玩家 quantity/,'tampered local master with player quantity must fail closed');
storage.clear();
commitPublicCandyLocalAdmission(prepared);

const ui=read('assets/js/candy-public-master-admission-ui.js');
assert.match(ui,/建立公版糖果並重新對應/);
assert.match(ui,/是否直接建立「本機 Public Candy identity」並立即用同一筆 observation 重新對應/);
assert.match(ui,/玩家 quantity 不會寫入 Public Master/);
assert.match(ui,/preparePublicCandyLocalAdmission/);
assert.match(ui,/persistAdmissionPair/);
assert.match(ui,/rollbackNewAdmissionPair/);
assert.match(ui,/sqlite_master_readback_verified:true/);
assert.match(ui,/local_storage_readback_verified:true/);
assert.match(ui,/replayCandyRecognitionAgainstCurrentMaster/);
const professor=read('assets/js/pokemon-professor-transfer.js');
assert.match(professor,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professor.includes('public-candy-local-admission-authority.js'),false);
assert.equal(professor.includes('candy-public-master-admission-ui.js'),false);

const appBuild=version.match(/app_build:\s*'([^']+)'/)?.[1]||'';
const cacheName=version.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
if(successor54){
  assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.54-v042754-p0b5-ingame-candy-master-promotion');
  assert.ok(version.includes("// app_version: 'v0.4.27.53'"));
}else{
  assert.equal(appVersion,'v0.4.27.53');
  assert.equal(appBuild,'20260901-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.53-v042753-p0b5-canonical-key-gap-admission-replay');
  assert.ok(version.includes("// app_version: 'v0.4.27.52'"));
}
const sw=read('service-worker.js');
assert.match(sw,/const isScript=sameOrigin/);
assert.match(sw,/caches\.open\(CACHE\)\.then\(cache=>cache\.put\(event\.request,copy\)\)/,'dynamic modules must remain offline-available after first online load through script network-first cache');
const workflow=read('.github/workflows/regression-gate.yml');
assert.equal(occurrence(workflow,'node scripts/v042750-p0b4-candy-display-name-authority-contract.mjs'),1,'consolidated regression gate must retain the governed Candy predecessor chain root');
const predecessor52=read('scripts/v042752-p0b5-gap-identity-raw-evidence-hotfix-contract.mjs');
assert.equal(occurrence(predecessor52,"if(successor53)await import('./v042753-p0b5-canonical-key-gap-admission-replay-contract.mjs');"),1,'.52 successor bridge must invoke .53 contract exactly once');
assert.equal(fs.existsSync('.github/workflows/v042753-p0b5-canonical-key-gap-admission-replay.yml'),false,'no standalone .53 workflow may bypass governed CI topology');
assert.equal(CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,'candy-quantity-confirmation-authority-2026-09-01-c');

console.log(JSON.stringify({status:'PASS',gate:'V042753_P0B5_CANONICAL_KEY_DIRECT_ADMISSION_REPLAY',app_version:appVersion,candy_master_version:PUBLIC_CANDY_MASTER_VERSION,local_admission_authority:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,semantics:{gemini_raw_immutable:true,candy_id_only_key_bridge:true,unmatched_direct_admission_single_confirmation_ui:true,source_controlled_screenshot_promotion:successor54,local_public_identity_persistent:true,local_storage_readback_verified:true,sqlite_master_readback_and_compensating_rollback_wired:true,replay_same_observation_exact_only:true,replay_auto_quantity_write:false,player_quantity_in_public_master:false,professor_semantics_unchanged:true,family_id_consolidation:false,local_admission_fallback_preserved:true,consolidated_ci_successor_chain:true,offline_script_cache_after_online_load:true}},null,2));
if(successor54)await import('./v042754-p0b5-ingame-candy-master-promotion-contract.mjs');