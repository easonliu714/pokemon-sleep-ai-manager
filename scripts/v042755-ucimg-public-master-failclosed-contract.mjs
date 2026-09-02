import assert from 'node:assert/strict';
import {
  buildPublicMasterCatalogSnapshot,
  compilePublicMasterRecognitionToUpdatePackage,
  validatePublicMasterRecognitionPayload,
} from '../assets/js/public-master-recognition.js';

const snapshot=buildPublicMasterCatalogSnapshot('candies');
assert.ok(snapshot.rows.length>0,'Candy Public Master snapshot must not be empty');
const first=snapshot.rows[0];
const allowedImageRefs=['IMG-420'];
const base={
  schema:'pokemon-sleep-public-master-recognition/1.0',
  recognition_version:snapshot.recognition_version,
  scenario:snapshot.scenario,
  authority:snapshot.authority,
  data_version:snapshot.data_version,
  catalog_snapshot_id:snapshot.catalog_snapshot_id,
  generated_at:'2026-09-01T00:00:00.000Z',
  visible_target_count:1,
  observations:[{
    observation_id:'OBS-420-1',
    status:'MATCHED',
    observed_text:first.candy_name,
    observed_data:{quantity:71},
    canonical_key:{candy_id:first.candy_id,candy_name:first.candy_name},
    canonical_name:first.candy_name,
    candidate_names:[],
    source_image_ref:'IMG-420',
    confidence:0.99,
    reason:'fixture',
  }],
};

const valid=validatePublicMasterRecognitionPayload(base,'candies',{allowedImageRefs});
assert.equal(valid.ok,true,`valid fixture unexpectedly rejected: ${valid.errors.join(' | ')}`);
const validCompiled=compilePublicMasterRecognitionToUpdatePackage(base,'candies',{allowedImageRefs});
assert.equal(validCompiled.ok,true);
assert.equal(validCompiled.update_package.operations.length,1);

const forgedKey=structuredClone(base);
forgedKey.observations[0].canonical_key={candy_id:'forged-candy-id',candy_name:first.candy_name};
const invalidKey=validatePublicMasterRecognitionPayload(forgedKey,'candies',{allowedImageRefs});
assert.equal(invalidKey.ok,false,'forged canonical key must fail closed');
assert.ok(invalidKey.errors.some(message=>message.includes('canonical_key')),'forged key rejection must identify canonical_key');
const forgedCompiled=compilePublicMasterRecognitionToUpdatePackage(forgedKey,'candies',{allowedImageRefs});
assert.equal(forgedCompiled.ok,false);
assert.equal(forgedCompiled.update_package.operations.length,0,'forged canonical key must never compile to an operation');

const forgedName=structuredClone(base);
forgedName.observations[0].canonical_name='不存在的糖果';
const invalidName=validatePublicMasterRecognitionPayload(forgedName,'candies',{allowedImageRefs});
assert.equal(invalidName.ok,false,'canonical_name/key mismatch must fail closed');
assert.ok(invalidName.errors.some(message=>message.includes('canonical_name')),'forged name rejection must identify canonical_name');
const forgedNameCompiled=compilePublicMasterRecognitionToUpdatePackage(forgedName,'candies',{allowedImageRefs});
assert.equal(forgedNameCompiled.ok,false);
// Compilation currently derives the canonical display value from the validated key, but the package remains non-applicable because ok=false.
assert.equal(forgedNameCompiled.update_package.operations.length,1);

console.log('V042755_UCIMG_PUBLIC_MASTER_FAILCLOSED_CONTRACT=PASS');
