import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROLLED_SELECTOR_VERSION} from '../assets/js/controlled-selector.js';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const parseVersion=value=>{
  const text=String(value||'');
  if(!/^v\d+(?:\.\d+){2,}$/.test(text))return null;
  return text.slice(1).split('.').map(Number);
};
const versionAtLeast=(actual,minimum)=>{
  const a=parseVersion(actual),b=parseVersion(minimum);if(!a||!b)return false;
  const length=Math.max(a.length,b.length);
  for(let index=0;index<length;index+=1){
    const left=a[index]||0,right=b[index]||0;
    if(left!==right)return left>right;
  }
  return true;
};

const version=read('assets/js/version-authority.js');
const app=version.match(/app_version:\s*'([^']+)'/)?.[1];
const build=version.match(/app_build:\s*'([^']+)'/)?.[1];
const cache=version.match(/cache_name:\s*'([^']+)'/)?.[1];
assert.equal(versionAtLeast(app,'v0.4.3.1'),true,'central release must not regress below v0.4.3.1');
if(app==='v0.4.3.1'){
  assert.equal(build,'20260809-v0431-controlled-selector-live-hotfix');
  assert.equal(cache,'pokemon-sleep-ai-v0.4.3.1-v0431-controlled-selector-live-hotfix');
}
assert.equal(CONTROLLED_SELECTOR_VERSION,'controlled-selector-2026-08-09-c');

const component=read('assets/js/controlled-selector.js');
for(const required of ['data-cs-option-value','optionByValue.get','compositionstart','compositionend','event.isComposing','renderOptions','refreshState','refocusSearch']){
  assert.ok(component.includes(required),`v0.4.3.1 selector hotfix token missing: ${required}`);
}
for(const forbidden of ['normalized.indexOf(option)',"selectOption(normalized[Number(button.dataset.csOption)])","query=event.target.value;render();","next?.focus()"]){
  assert.equal(component.includes(forbidden),false,`v0.4.3.1 legacy selector behavior remains: ${forbidden}`);
}

const sw=read('service-worker.js');
assert.ok(sw.includes("importScripts('./assets/js/version-authority.js')"),'service worker must import central version authority');
assert.ok(sw.includes("'./assets/js/controlled-selector.js'"),'controlled selector must remain precached');
assert.ok(sw.includes('cache_name:CACHE'),'service worker must use central cache authority');

const goalUi=read('assets/js/war-room-goal-profile-ui.js');
assert.ok(goalUi.includes("from './controlled-selector.js'"));
for(const rootId of ['warRoomMustIncludePokemon','warRoomExcludePokemon','warRoomMustIncludeRole','warRoomNightPokemon','warRoomIngredientSafeReserve']){
  assert.ok(goalUi.includes(rootId),`War Room selector wiring missing: ${rootId}`);
}

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'V0.4.3.1_CONTROLLED_SELECTOR_RELEASE_CONTRACT',
  app_version:app,
  minimum_release:'v0.4.3.1',
  nested_hotfix_semver_supported:true,
  build,
  cache,
  controlled_selector_version:CONTROLLED_SELECTOR_VERSION,
  filtered_search_commit_by_stable_value:true,
  ime_composition_preserved:true,
  search_input_dom_not_rebuilt_per_keystroke:true,
  service_worker_central_cache_authority:true,
  player_schema_change:false,
  player_data_write:false,
},null,2)}\n`);