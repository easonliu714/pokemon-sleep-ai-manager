import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {
  DATA_PRESERVATION_POLICY_VERSION,
  isObservedWriteValue,
  buildSparseObservedPatch,
} from '../assets/js/data-preservation-policy.js';
import {
  WEEKLY_OVERRIDE_REBASE_VERSION,
  computeWeeklyOverrideRebase,
} from '../assets/js/weekly-context-override-rebase.js';
import {buildUpdatePayload} from '../assets/js/identity-import-apply-operation.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

assert.equal(DATA_PRESERVATION_POLICY_VERSION,'data-preservation-policy-2026-08-11-a');
assert.equal(WEEKLY_OVERRIDE_REBASE_VERSION,'weekly-override-rebase-2026-08-11-a');

for(const value of [null,undefined,'','   '])assert.equal(isObservedWriteValue(value),false,`blank value must be NO-OP: ${String(value)}`);
for(const value of [0,false,'0','文字',{},[]])assert.equal(isObservedWriteValue(value),true,`explicit value must remain writable: ${String(value)}`);

const sparse=buildSparseObservedPatch({quantity:null,safe_reserve:0,unlocked:false,note:'',label:'已辨識'},['note']);
assert.deepEqual(sparse,{safe_reserve:0,unlocked:false,note:null,label:'已辨識'});
const missingClear=buildSparseObservedPatch({quantity:null},['legacy_field']);
assert.deepEqual(missingClear,{legacy_field:null},'clear_fields may explicitly clear even when source omits the field');

const baseRecord={
  schema:'weekly-context-manual-override/1.0',
  version:'weekly-manual-override-old',
  week_start:'2026-08-10',
  based_on_import_revision:'UPD-A',
  fields:{pot_size:57,dish_category:'咖哩／濃湯',event_name:'舊活動',favorite_berry_1:'橙橙果',favorite_berry_2:'桃桃果',favorite_berry_3:'萄葡果'},
  updated_at:'2026-08-11T00:00:00+08:00',
};

const carry=computeWeeklyOverrideRebase({
  record:baseRecord,newImportRevision:'UPD-B',incomingData:{pot_size:null,dish_category:'沙拉',event_name:''},clearFields:[],previousCamp:'萌綠之島',updatedAt:'2026-08-11T01:00:00+08:00',
});
assert.equal(carry.action,'upsert');
assert.equal(carry.record.based_on_import_revision,'UPD-B');
assert.equal(carry.record.fields.pot_size,57,'new Weekly null must preserve manual pot size');
assert.equal(carry.record.fields.event_name,'舊活動','new Weekly blank must preserve manual event name');
assert.equal('dish_category' in carry.record.fields,false,'new observed Weekly value must supersede prior manual field');

const explicitClear=computeWeeklyOverrideRebase({
  record:{...baseRecord,fields:{pot_size:57}},newImportRevision:'UPD-C',incomingData:{pot_size:null},clearFields:['pot_size'],previousCamp:'萌綠之島',updatedAt:'2026-08-11T02:00:00+08:00',
});
assert.equal(explicitClear.action,'delete');
assert.deepEqual([...explicitClear.explicit_clear_fields],['pot_size']);

const campChange=computeWeeklyOverrideRebase({
  record:{...baseRecord,fields:{camp:'萌綠之島',favorite_berry_1:'橙橙果',favorite_berry_2:'桃桃果',favorite_berry_3:'萄葡果',pot_size:57}},
  newImportRevision:'UPD-D',incomingData:{camp:'天青沙灘',pot_size:null},clearFields:[],previousCamp:'萌綠之島',updatedAt:'2026-08-11T03:00:00+08:00',
});
assert.equal(campChange.camp_changed,true);
assert.equal(campChange.record.fields.pot_size,57);
for(const field of ['favorite_berry_1','favorite_berry_2','favorite_berry_3'])assert.equal(field in campChange.record.fields,false,`${field} must not carry across actual camp change`);

const sameCamp=computeWeeklyOverrideRebase({
  record:{...baseRecord,fields:{camp:'萌綠之島',favorite_berry_1:'橙橙果',favorite_berry_2:'桃桃果',favorite_berry_3:'萄葡果'}},
  newImportRevision:'UPD-E',incomingData:{camp:'萌綠之島'},clearFields:[],previousCamp:'萌綠之島',updatedAt:'2026-08-11T04:00:00+08:00',
});
assert.equal(sameCamp.camp_changed,false);
for(const field of ['favorite_berry_1','favorite_berry_2','favorite_berry_3'])assert.equal(field in sameCamp.record.fields,true,`${field} may carry when camp is unchanged`);
assert.equal('camp' in sameCamp.record.fields,false,'same observed camp supersedes redundant manual camp field');

const identityPatch=buildUpdatePayload(
  {action:'accept_existing',pokemon_instance_id:'inst-1'},
  {
    profile:{nickname:null,level:null,sp:0,nature:'',main_skill_level:0,helper_seconds:false,carry_limit:undefined},
    identity:{current_species_id:null},
    progression:{sleep_hours_with_helper:null},
  },
  {nickname:'舊暱稱',level:50,sp:1500,nature:'固執',main_skill_level:6,helper_seconds:2400,sleep_hours_with_helper:100},
);
assert.deepEqual(identityPatch,{sp:0,main_skill_level:0,helper_seconds:false},'Pokémon existing update must omit null/blank but preserve explicit 0/false');

const importer=read('assets/js/importer.js');
assert.match(importer,/buildSparseObservedPatch/);
assert.match(importer,/rebaseWeeklyManualOverrideForImport/);
assert.match(importer,/null_overwrite_policy:'preserve_existing_unless_clear_fields'/);
assert.match(importer,/explicit_zero_and_false_are_values:true/);

const updateContract=read('assets/js/update-package-contract.js');
assert.match(updateContract,/blank_values:'preserve_existing'/);
assert.match(updateContract,/explicit_clear_only_via:'operation\.clear_fields'/);
assert.match(updateContract,/missing_fields:'no_change'/);
assert.match(updateContract,/explicit_zero_and_false:'write_value'/);

const observation=read('assets/js/ai-observation.js');
assert.match(observation,/空值在更新中心代表保留既有值，不是清空/);

const recognition=read('assets/js/public-master-recognition.js');
assert.match(recognition,/hasOwn\(observation\.observed_data,field\)&&meaningful\(observation\.observed_data\[field\]\)/);

console.log('PASS v0.4.13.1 DATA PRESERVATION: null/missing NO-OP, 0/false writable, explicit clear only, Weekly field-level rebase, camp berry invalidation, Pokémon sparse update');
