import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY,
  PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS,
  currentPublicCandyDisplayNameAuthorityRows,
  resolvePublicCandyDisplayNameForSpecies,
} from '../assets/js/public-candy-display-name-authority.js';
import {PUBLIC_CANDY_MASTER_VERSION,speciesCandyName} from '../assets/js/public-candy-master.js';
import {resolveCandyFamilyStorageForSpecies} from '../assets/js/candy-family-storage-authority.js';
import {
  PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,
  PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY,
  preparePublicCandyLocalAdmission,
} from '../assets/js/public-candy-local-admission-authority.js';

const read=path=>fs.readFileSync(path,'utf8');
const versionSource=read('assets/js/version-authority.js'),serviceWorkerSource=read('service-worker.js'),workflowSource=read('.github/workflows/regression-gate.yml');
const appVersion=versionSource.match(/app_version:\s*'([^']+)'/)?.[1]||'',appBuild=versionSource.match(/app_build:\s*'([^']+)'/)?.[1]||'',cacheName=versionSource.match(/cache_name:\s*'([^']+)'/)?.[1]||'';
const p0b6Patch=Number(appVersion.match(/^v0\.4\.27\.(\d+)(?:\.\d+)*$/)?.[1]||-1);
const p0b6Hotfix=Number(appVersion.match(/^v0\.4\.27\.55\.(\d+)(?:\.\d+)*$/)?.[1]||0);
const p0b6Successor=p0b6Patch>=55;
const localGapDurabilitySuccessor=p0b6Patch>55||(p0b6Patch===55&&p0b6Hotfix>=2);
const withLocalAdmissions=(observedTexts,fn)=>{
  const previous=globalThis.localStorage;
  const rows=observedTexts.map((observed_text,index)=>preparePublicCandyLocalAdmission({observation:{status:'UNMATCHED',observed_text,source_image_ref:`fixture-image-${index+1}`,observation_id:`fixture-observation-${index+1}`},confirmedAt:`2026-09-01T13:40:0${index}.000Z`}));
  const state=JSON.stringify({schema:'pokemon-sleep-public-candy-local-admission/1.0',authority_version:PUBLIC_CANDY_LOCAL_ADMISSION_AUTHORITY_VERSION,rows});
  globalThis.localStorage={getItem:key=>key===PUBLIC_CANDY_LOCAL_ADMISSION_STORAGE_KEY?state:null,setItem(){},removeItem(){}};
  try{return fn(rows);}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
};

assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,localGapDurabilitySuccessor?'public-candy-display-name-authority-2026-09-02-f':p0b6Successor?'public-candy-display-name-authority-2026-09-01-e':'public-candy-display-name-authority-2026-08-31-a');
for(const [key,value] of Object.entries({exact_official_zh_tw_string_required:true,structural_root_is_not_display_name_anchor:true,species_name_concatenation_forbidden:true,automatic_display_name_generation:false,unverified_family_fail_closed:true,legacy_candy_master_mutation_authority:false,legacy_candy_id_remap_authority:false,candy_inventory_migration_authority:false,player_quantity_write_authority:false,professor_transfer_write_behavior_changed:false}))assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY[key],value,key);
if(p0b6Successor){
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.ingame_screenshot_official_equivalent_exact_string_supported,true);
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.real_device_user_revalidation_exact_string_supported,true);
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_user_confirmed_exact_string_supported,true);
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_admission_quantity_authority,false);
}
if(localGapDurabilitySuccessor){
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_user_confirmed_precedes_public_same_name,true);
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_public_name_conflict_fail_closed,true);
  assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_POLICY.local_admission_read_failure_fail_closed,true);
}

const rows=currentPublicCandyDisplayNameAuthorityRows();
const predecessorNames=['伊布的糖果','妙蛙種子的糖果','皮卡丘的糖果'];
const p0b5IngameNames=['草苗龜的糖果','木守宮的糖果','小鍛匠的糖果','波加曼的糖果','水躍魚的糖果','摔角鷹人的糖果','火稚雞的糖果','菊草葉的糖果'];
const p0b6RealDeviceNames=['卡拉卡拉的糖果','卡蒂狗的糖果','夢幻的糖果','寶寶暴龍的糖果','小火焰猴的糖果','拉帝亞斯的糖果','拉帝歐斯的糖果','胖丁的糖果','迷你龍的糖果','達克萊伊的糖果'];
const expectedNames=p0b6Successor?[...predecessorNames,...p0b5IngameNames,...p0b6RealDeviceNames]:predecessorNames;
assert.equal(rows.length,expectedNames.length);
assert.equal(rows.every(row=>row.status==='MATCH'&&row.candy_display_name_authority===true),true);
assert.deepEqual(rows.map(row=>row.candy_display_name).sort(),[...expectedNames].sort());
assert.equal(new Set(rows.map(row=>row.family_id)).size,rows.length);
assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS.length,rows.length,'dynamic facade must preserve static count when no local admissions exist');

for(const species of ['皮丘','皮卡丘','雷丘'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'皮卡丘的糖果');
for(const species of ['伊布','水伊布'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'伊布的糖果');
for(const species of ['妙蛙種子','妙蛙草'])assert.equal(resolvePublicCandyDisplayNameForSpecies(species).candy_display_name,'妙蛙種子的糖果');
if(p0b6Successor){
  assert.equal(resolvePublicCandyDisplayNameForSpecies('卡蒂狗').candy_display_name,'卡蒂狗的糖果');
  assert.equal(resolvePublicCandyDisplayNameForSpecies('風速狗').candy_display_name,'卡蒂狗的糖果');
  for(const displayName of p0b6RealDeviceNames){
    const row=rows.find(item=>item.candy_display_name===displayName);assert.ok(row);assert.match(row.source_ref,/^project-evidence:2026-09-01-p0b6-real-device-inventory-revalidation#/);
  }

  // Systemic regression: no source-controlled Meowth/Sandshrew B3/B4 row exists.
  // A validated local admission must become family + display + canonical storage
  // authority immediately in the same session, without another code hotfix.
  for(const species of ['喵喵','穿山鼠']){
    assert.equal(resolvePublicCandyDisplayNameForSpecies(species).status,'REVIEW_REQUIRED');
    assert.equal(resolveCandyFamilyStorageForSpecies(species).status,'REVIEW_REQUIRED');
  }
  withLocalAdmissions(['喵喵的糖果','穿山鼠的糖果'],()=>{
    for(const [species,name] of [['喵喵','喵喵的糖果'],['穿山鼠','穿山鼠的糖果']]){
      const display=resolvePublicCandyDisplayNameForSpecies(species);
      assert.equal(display.status,'MATCH');
      assert.equal(display.candy_display_name,name);
      assert.equal(display.local_admission_authority,true);
      assert.equal(display.reason,'EXACT_USER_CONFIRMED_LOCAL_ZH_TW_CANDY_DISPLAY_NAME');
      assert.equal(display.automatic_display_name_generation,false);
      const storage=resolveCandyFamilyStorageForSpecies(species);
      assert.equal(storage.status,'MATCH',`${species} local admission must reach P0-B6 canonical storage`);
      assert.equal(storage.canonical_candy_display_name,name);
      assert.match(storage.family_id,/^family_/);
    }
    assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS.some(row=>row.candy_display_name==='喵喵的糖果'),true);
    assert.equal(PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_ROWS.some(row=>row.candy_display_name==='穿山鼠的糖果'),true);
  });
  assert.equal(resolveCandyFamilyStorageForSpecies('喵喵').status,'REVIEW_REQUIRED','evidence absence must still fail closed');
}

assert.equal(resolvePublicCandyDisplayNameForSpecies('不存在寶可夢').status,'REVIEW_REQUIRED');
assert.ok(['public-candy-master-2026-09-01-f','public-candy-master-2026-09-01-g'].includes(PUBLIC_CANDY_MASTER_VERSION));
assert.equal(speciesCandyName('皮卡丘'),'皮卡丘的糖果');
const displayAuthoritySource=read('assets/js/public-candy-display-name-authority.js');
assert.equal(displayAuthoritySource.includes('candy_display_name:`${'),false,'B4 must not synthesize display names from species strings');
assert.match(displayAuthoritySource,/species_name_concatenation_forbidden:true/);
assert.match(displayAuthoritySource,/automatic_display_name_generation:false/);
assert.match(displayAuthoritySource,/publicCandyLocalAdmissionRows/,'B4 may consume validated local admissions dynamically');
const professorSource=read('assets/js/pokemon-professor-transfer.js');
assert.match(professorSource,/USER_DIRECT_OBSERVATION_ONLY/);
assert.equal(professorSource.includes('public-candy-display-name-authority.js'),false);

if(appVersion==='v0.4.27.50'){assert.equal(appBuild,'20260831-v042750-p0b4-candy-display-name-authority');assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.50-v042750-p0b4-candy-display-name-authority');}
else if(appVersion==='v0.4.27.51'){assert.equal(appBuild,'20260831-v042751-p0b5-candy-quantity-confirmation');}
else if(appVersion==='v0.4.27.52'){assert.equal(appBuild,'20260901-v042752-p0b5-gap-identity-raw-evidence-hotfix');}
else if(appVersion==='v0.4.27.53'){assert.equal(appBuild,'20260901-v042753-p0b5-canonical-key-gap-admission-replay');}
else if(appVersion==='v0.4.27.54'){assert.equal(appBuild,'20260901-v042754-p0b5-ingame-candy-master-promotion');}
else if(appVersion==='v0.4.27.55'){assert.equal(appBuild,'20260901-v042755-p0b6-candy-family-storage-reconciliation');assert.equal(cacheName,'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation');assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-g');}
else if(p0b6Successor){
  assert.ok(versionSource.includes("// app_version: 'v0.4.27.55'"),'nested successor must retain v0.4.27.55 predecessor version');
  assert.ok(versionSource.includes("// app_build: '20260901-v042755-p0b6-candy-family-storage-reconciliation'"),'nested successor must retain v0.4.27.55 predecessor build');
  assert.ok(versionSource.includes("// cache_name: 'pokemon-sleep-ai-v0.4.27.55-v042755-p0b6-candy-family-storage-reconciliation'"),'nested successor must retain v0.4.27.55 predecessor cache');
  assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-09-01-g');
}else assert.fail(`B4 successor release not governed: ${appVersion}`);
assert.ok(versionSource.includes("// app_version: 'v0.4.27.49'"));
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-display-name-authority\.js/g)||[]).length,1);
assert.equal((serviceWorkerSource.match(/\.\/assets\/js\/public-candy-family-authority\.js/g)||[]).length,1);
assert.ok(workflowSource.includes('node scripts/v042750-p0b4-candy-display-name-authority-contract.mjs'));
console.log(JSON.stringify({status:'PASS',gate:'V042750_P0B4_PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY',authority_version:PUBLIC_CANDY_DISPLAY_NAME_AUTHORITY_VERSION,admitted_exact_zh_tw_display_name_rows:rows.length,verified_display_names:rows.map(row=>row.candy_display_name),app_version:appVersion,app_build:appBuild,nested_hotfix_version_supported:p0b6Successor&&appVersion!=='v0.4.27.55',local_gap_durability_successor:localGapDurabilitySuccessor,semantics:{family_level_display_name_resolution:true,exact_first_party_zh_tw_evidence_only:true,local_admission_dynamic_fallback:p0b6Successor,local_admission_reaches_canonical_storage:p0b6Successor,local_precedes_public_same_name:localGapDurabilitySuccessor,local_public_conflict_fail_closed:localGapDurabilitySuccessor,local_read_failure_fail_closed:localGapDurabilitySuccessor,unverified_family_review_required:true,automatic_display_name_generation:false,legacy_candy_master_mutation:false,player_inventory_migration:false,professor_transfer_write_change:false,successor_release_exact:true}},null,2));
await import('./v042751-p0b5-candy-quantity-confirmation-contract.mjs');
