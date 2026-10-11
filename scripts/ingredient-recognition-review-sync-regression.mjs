import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncRecognitionWorkingTextarea} from '../assets/js/uc-img-recognition-working-sync.js';
import {buildPublicMasterCatalogSnapshot,applyPublicMasterRecognitionResolution,compilePublicMasterRecognitionToUpdatePackage} from '../assets/js/public-master-recognition.js';
const snapshot=buildPublicMasterCatalogSnapshot('ingredients');
const pumpkin=snapshot.rows.find(r=>r[snapshot.display_name_field]==='沉甸甸南瓜');
assert.ok(pumpkin,'Public Master contains 沉甸甸南瓜');
const recognition={
  schema:'pokemon-sleep-public-master-recognition/1.0',
  recognition_version:'public-master-recognition-2026-08-17-d-locked-placeholder',
  scenario:snapshot.scenario,authority:snapshot.authority,
  data_version:snapshot.data_version,catalog_snapshot_id:snapshot.catalog_snapshot_id,
  visible_target_count:1,
  observations:[{
    observation_id:'pumpkin-201',status:'AMBIGUOUS',observed_text:'沉甸甸南瓜',
    observed_data:{quantity:10},confidence:0.85,source_image_ref:'image-201',
    candidate_names:['沉甸甸南瓜'],
  }],
};
const before=JSON.stringify(recognition);
const after=applyPublicMasterRecognitionResolution(recognition,'ingredients','pumpkin-201','MATCH','沉甸甸南瓜');
const afterText=JSON.stringify(after);
assert.equal(JSON.stringify(recognition),before,'Raw provider input must never mutate');
assert.equal(after.observations[0].status,'MATCHED');
assert.equal(after.observations[0].user_resolution.action,'USER_CONFIRMED_MATCH');
let events=0,workingInput=before;
const textarea={
  value:before,
  dispatchEvent(event){assert.equal(event.type,'input');events++;workingInput=this.value;return true;},
};
assert.equal(syncRecognitionWorkingTextarea(textarea,afterText),true);
assert.equal(workingInput,afterText,'independent ingredient gate must see updated Working JSON');
assert.equal(events,1,'exactly one invalidation event');
assert.equal(syncRecognitionWorkingTextarea(textarea,afterText),false);
assert.equal(events,1,'no feedback-loop on same JSON');
const compiled=compilePublicMasterRecognitionToUpdatePackage(JSON.parse(workingInput),'ingredients',{allowedImageRefs:['image-201']});
assert.equal(compiled.unresolved.length,0,'candidate confirmation must close recognition gate');
assert.equal(compiled.update_package.operations.length,1,'keep matching quantity and never drop observation');
assert.equal(compiled.update_package.operations[0].data.quantity,10);
const uc=fs.readFileSync('assets/js/unified-screenshot-update-center.js','utf8');
const guard=fs.readFileSync('assets/js/ingredient-inventory-integrity-ui.js','utf8');
assert.match(uc,/syncRecognitionWorkingTextarea\(root\.querySelector/);
assert.match(uc,/if\(state\.raw_response===e\.target\.value\)return;/,'programmatic input does not reset validated runtime state');
assert.match(guard,/document\.addEventListener\('input',[\s\S]*?#ucImgA \.uc-img-response/,'capture UI must re-read Working JSON');
assert.match(guard,/state\.unresolved\.length/,'do not skip genuine ambiguous items');
console.log(JSON.stringify({status:'PASS',gate:'UC_IMG_INGREDIENT_RECOGNITION_INTEGRITY_SYNC',resolved:1,operations:1,raw_immutable:true,events,no_gate_bypass:true}));
