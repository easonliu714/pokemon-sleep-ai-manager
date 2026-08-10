import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeWeeklyContextImportPayload,prepareWeeklyContextPayloadForImporter,validateWeeklyContextImportPayload} from '../assets/js/weekly-context-import-contract.js';

const read=path=>fs.readFileSync(path,'utf8');
const numericVersion=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part));
const versionAtLeast=(value,floor)=>{
  const left=numericVersion(value),right=numericVersion(floor),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){const a=left[index]||0,b=right[index]||0;if(a!==b)return a>b;}
  return true;
};
const version=read('assets/js/version-authority.js');
const currentVersion=version.match(/app_version:\s*'([^']+)'/)?.[1];
const currentBuild=version.match(/app_build:\s*'([^']+)'/)?.[1];
const currentCache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.ok(versionAtLeast(currentVersion,'v0.4.6.3'),`historical v0.4.6.3 contract cannot run on older release: ${currentVersion}`);
if(currentVersion==='v0.4.6.3'){
  assert.equal(currentBuild,'20260810-v0463-weekly-ai-type-repair');
  assert.equal(currentCache,'pokemon-sleep-ai-v0.4.6.3-v0463-weekly-ai-type-repair');
}

const payload={
  schema_version:'1.1',update_id:'UPD-V0463-RELEASE-FIXTURE',generated_at:'2026-08-10T14:00:00.000Z',source:'fixture',
  scenario:'weekly_context_update',context_authority:'UPDATE_CENTER_JSON',profile_audit_confirmations:[],
  operations:[{
    operation_id:'OP-001',entity:'weekly_context',action:'upsert',key:{context_id:'weekly_context_2026-08-10_import'},
    data:{week_start:'2026-08-10',camp:'萌綠之島',dish_category:'咖哩／濃湯',event_name:'fixture',event_effects:{meal_category_forced:'咖哩／濃湯',recipe_final_energy_multiplier:1.5},updated_at:'2026-08-10T14:00:00.000Z'},
    clear_fields:[],evidence:{source_type:'fixture',source_image_ref:'synthetic.png',confidence:1},review_required:false,user_audit:{accepted_current_observation:true},
  }],
};
const now=new Date('2026-08-10T14:00:00+08:00');
const normalized=normalizeWeeklyContextImportPayload(payload,{repairLegacy:true});
assert.equal(normalized.payload.operations[0].data.event_effects.meal_category_forced,true);
assert.ok(normalized.repairs.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));
const validation=validateWeeklyContextImportPayload(payload,{now});
assert.equal(validation.ok,true,validation.issues.join('\n'));
assert.ok(validation.warnings.includes('MEAL_CATEGORY_FORCED_CATEGORY_STRING_REPAIRED_TRUE'));
const importerPayload=JSON.parse(JSON.stringify(payload));
prepareWeeklyContextPayloadForImporter(importerPayload);
assert.equal(typeof importerPayload.operations[0].data.event_effects,'string');
assert.equal(JSON.parse(importerPayload.operations[0].data.event_effects).meal_category_forced,true);

for(const badValue of ['true','false','沙拉','FORCED']){
  const bad=JSON.parse(JSON.stringify(payload));
  bad.operations[0].data.event_effects.meal_category_forced=badValue;
  assert.equal(validateWeeklyContextImportPayload(bad,{now}).ok,false,`ambiguous value must fail closed: ${badValue}`);
}

const prompt=read('assets/js/prompt-catalog.js');
for(const token of ['meal_category_forced 只能是 boolean true/false','料理名稱只能放在 data.dish_category','raw JSON'])assert.ok(prompt.includes(token),`prompt contract missing ${token}`);
const bridge=read('assets/js/weekly-context-update-center-bridge.js');
for(const token of ['正式支援','JSON.parse(raw)','同一套結構檢查、必要覆核、Dry Run 與 Apply'])assert.ok(bridge.includes(token),`paste UX contract missing ${token}`);
assert.equal(bridge.includes('applyPayload('),false);
const migrations=read('assets/js/migrations.js');
assert.equal(migrations.includes('v0463'),false,'v0.4.6.3 compatibility layer must not own a release-specific SQLite migration');
const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"));
assert.ok(sw.includes('cache_name:CACHE'));

console.log(JSON.stringify({
  status:'PASS',gate:'V0.4.6.3_RELEASE_CONTRACT',current_app_version:currentVersion,
  historical_behavior_compatible:true,exact_release_authority_enforced:currentVersion==='v0.4.6.3',
  exact_category_string_repair:true,ambiguous_strings_fail_closed:true,repair_warning_visible:true,
  raw_json_paste_first_class:true,direct_apply_bypass:false,
},null,2));
