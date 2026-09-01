import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CANDY_PUBLIC_MASTER_REPLAY_ACTION,
  CANDY_QUANTITY_CONFIRMATION_AUTHORITY_VERSION,
  compileCandyQuantityGovernedRecognitionToUpdatePackage,
  confirmCandyScreenshotQuantity,
  normalizeCandyCanonicalKeyForBaseContract,
  replayCandyRecognitionAgainstCurrentMaster,
  buildPublicMasterCatalogSnapshot,
} from '../assets/js/candy-quantity-confirmation-authority.js';
import {
  PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS,
  PUBLIC_CANDY_MASTER_VERSION,
  buildPublicCandyMasterRows,
} from '../assets/js/public-candy-master.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_ACTION,
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,
  admitPublicCandyFromObservedName,
  publicCandyLocalAdmissionFingerprint,
  publicCandyLocalAdmissionRows,
} from '../assets/js/public-candy-local-admission-authority.js';
import {PUBLIC_MASTER_RECOGNITION_SCHEMA,PUBLIC_MASTER_RECOGNITION_VERSION} from '../assets/js/public-master-recognition.js';

const read=path=>fs.readFileSync(path,'utf8');
class FakeStorage{constructor(){this.map=new Map();}getItem(key){return this.map.has(key)?this.map.get(key):null;}setItem(key,value){this.map.set(key,String(value));}removeItem(key){this.map.delete(key);}clear(){this.map.clear();}}
const storage=new FakeStorage();
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});

assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-f','.53 must not pre-promote screenshot gaps into source-controlled master');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS.length,1,'.53 static compatibility additions must remain exactly one');
assert.equal(PUBLIC_CANDY_LEGACY_COMPATIBILITY_EVIDENCE_ADDITIONS[0].species_name,'小火焰猴');
assert.equal(publicCandyLocalAdmissionRows().length,0);
assert.equal(publicCandyLocalAdmissionFingerprint(),'none');
assert.equal(read('assets/js/public-candy-master.js').includes("['草苗龜','木守宮','小鍛匠'"),false,'physical screenshot gaps must not be preloaded in .53 source-controlled master');

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
assert.equal(matchedCompile.update_package.operations.length,0,'quantity remains unconfirmed');
assert.equal(matchedCompile.summary.candy_quantity_pending_count,1);

const gapRaw={schema:PUBLIC_MASTER_RECOGNITION_SCHEMA,recognition_version:PUBLIC_MASTER_RECOGNITION_VERSION,scenario:'candy_inventory_update',authority:'candy_master',data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,generated_at:'2026-09-01T02:01:00.000Z',visible_target_count:1,observations:[{observation_id:'obs-turtwig',status:'UNMATCHED',observed_text:'草苗龜的糖果',observed_data:{quantity:430},source_image_ref:'candy-image-001',confidence:0.95}]};
assert.equal(buildPublicCandyMasterRows().some(row=>row.candy_name==='草苗龜的糖果'),false,'fixture requires a real current-master gap before admission');
const gapBytes=JSON.stringify(gapRaw);
const admission=admitPublicCandyFromObservedName({observedText:'草苗龜的糖果',sourceImageRef:'candy-image-001',observationId:'obs-turtwig',confirmedAt:'2026-09-01T02:02:00.000Z'});
assert.equal(admission.status,'CREATED');
assert.equal(admission.row.admission_action,PUBLIC_CANDY_LOCAL_ADMISSION_ACTION);
assert.equal(admission.row.authority_version,PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION);
assert.equal(Object.prototype.hasOwnProperty.call(admission.row,'quantity'),false,'Public Master admission must never contain player quantity');
assert.equal(publicCandyLocalAdmissionRows().length,1);
assert.notEqual(publicCandyLocalAdmissionFingerprint(),'none');
assert.ok(storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));
assert.equal(buildPublicCandyMasterRows().some(row=>row.candy_name==='草苗龜的糖果'),true,'local admission must become a current Public Master candidate');

const replay=replayCandyRecognitionAgainstCurrentMaster(gapRaw,'candies');
assert.equal(JSON.stringify(gapRaw),gapBytes,'replay must not mutate Gemini Raw');
assert.equal(replay.replayed_count,1);
const replayed=replay.payload.observations[0];
assert.equal(replayed.status,'MATCHED');
assert.equal(replayed.observed_text,'草苗龜的糖果');
assert.equal(replayed.canonical_name,'草苗龜的糖果');
assert.equal(replayed.reason,CANDY_PUBLIC_MASTER_REPLAY_ACTION);
assert.ok(replayed.canonical_key.candy_id);
assert.equal(Object.keys(replayed.canonical_key).length,1,'working replay uses candy_id storage identity only');
const replayCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(replay.payload,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(replayCompile.errors.length,0,replayCompile.errors.join('\n'));
assert.equal(replayCompile.update_package.operations.length,0,'admission/replay must not auto-confirm quantity');
assert.equal(replayCompile.summary.candy_quantity_pending_count,1);
const confirmed=confirmCandyScreenshotQuantity(replay.payload,'candies','obs-turtwig',{confirmedAt:'2026-09-01T02:03:00.000Z'});
const confirmedCompile=compileCandyQuantityGovernedRecognitionToUpdatePackage(confirmed,'candies',{allowedImageRefs:['candy-image-001']});
assert.equal(confirmedCompile.ok,true,confirmedCompile.errors.join('\n'));
assert.equal(confirmedCompile.update_package.operations.length,1);
assert.equal(confirmedCompile.update_package.operations[0].data.quantity,430);
assert.deepEqual(confirmedCompile.update_package.operations[0].key,{candy_id:admission.row.candy_id});

const localState=JSON.parse(storage.getItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY));
localState.rows[0].quantity=430;
storage.setItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,JSON.stringify(localState));
assert.throws(()=>publicCandyLocalAdmissionRows(),/禁止包含玩家 quantity/,'tampered local master with player quantity must fail closed');
storage.setItem(PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,JSON.stringify(admission.state));

const ui=read('assets/js/candy-public-master-admission-ui.js');
assert.match(ui,/建立公版糖果並重新對應/);
assert.match(ui,/是否直接建立「本機 Public Candy identity」並立即用同一筆 observation 重新對應/);
assert.match(ui,/玩家 quantity 不會寫入 Public Master/);
assert.match(ui,/persistAdmissionRow/);
assert.match(ui,/replayCandyRecognitionAgainstCurrentMaster/);
const master=read('assets/js/public-candy-master.js');
assert.match(master,/does NOT pre-admit the user's newly observed gaps/);
assert.equal(master.includes("source_ref:'project-evidence:2026-09-01-p0b5-physical-candy-inventory'"),false);
const professor=read('assets/js/pokemon-professor-transfer.js');
assert.match(professor,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professor.includes('public-candy-local-admission-authority.js'),false);

const version=read('assets/js/version-authority.js');
assert.match(version,/app_version:\s*'v0\.4\.27\.53'/);
assert.match(version,/app_build:\s*'20260901-v042753-p0b5-canonical-key-gap-admission-replay'/);
assert.match(version,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.53-v042753-p0b5-canonical-key-gap-admission-replay'/);
assert.ok(version.includes("// app_version: 'v0.4.27.52'"));
const sw=read('service-worker.js');
assert.match(sw,/const isScript=sameOrigin/);
assert.match(sw,/caches\.open\(CACHE\)\.then\(cache=>cache\.put\(event\.request,copy\)\)/,'new modules must become offline-available after first online load via script network-first cache');

console.log(JSON.stringify({status:'PASS',gate:'V042753_P0B5_CANONICAL_KEY_DIRECT_ADMISSION_REPLAY',app_version:'v0.4.27.53',candy_master_version:PUBLIC_CANDY_MASTER_VERSION,semantics:{gemini_raw_immutable:true,candy_id_only_key_bridge:true,unmatched_direct_admission_single_confirmation_ui:true,source_controlled_gap_preload:false,local_public_identity_persistent:true,local_sqlite_master_persistence_wired:true,replay_same_observation_exact_only:true,replay_auto_quantity_write:false,player_quantity_in_public_master:false,professor_semantics_unchanged:true,next_release_screenshot_global_promotion:true}},null,2));
