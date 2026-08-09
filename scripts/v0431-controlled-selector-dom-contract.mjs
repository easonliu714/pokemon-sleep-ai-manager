import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {
  CONTROLLED_SELECTOR_VERSION,
  createControlledSelector,
  createControlledNumberMapEditor,
} from '../assets/js/controlled-selector.js';

const dom=new JSDOM('<!doctype html><html><body><div id="selector"></div><div id="map"></div></body></html>',{url:'https://example.invalid/'});
const {document,Event}=dom.window;

const options=[
  {value:'poke_010',label:'卡蒂狗 · Lv8 · 技能 · 個體 12',aliases:['卡蒂狗','instance_12'],group:'技能'},
  {value:'poke_013',label:'卡蒂狗 · Lv4 · 技能 · 個體 13',aliases:['卡蒂狗','instance_13'],group:'技能'},
  {value:'poke_060',label:'皮丘 · Lv10 · 樹果 · 個體 60',aliases:['皮丘'],group:'樹果'},
];

let changePayload=null;
const root=document.querySelector('#selector');
const selector=createControlledSelector(root,{
  options,
  values:[],
  multiple:true,
  maxSelections:5,
  selectionLabel:'選擇夜間／進化目標成員',
  onChange:(values,meta)=>{changePayload={values:[...values],meta};},
});

assert.equal(CONTROLLED_SELECTOR_VERSION,'controlled-selector-2026-08-09-b');
assert.deepEqual(selector.values(),[]);

// Reproduce Android LIVE-H1 exactly: type a search that narrows the list, then tap a row.
let search=root.querySelector('[data-cs-search]');
search.value='個體 12';
search.dispatchEvent(new Event('input',{bubbles:true}));
let rows=[...root.querySelectorAll('[data-cs-option-value]')];
assert.equal(rows.length,1,'filtered search must produce exactly one selectable row');
assert.equal(rows[0].dataset.csOptionValue,'poke_010','filtered row must carry stable value, not a transient object index');
rows[0].click();
assert.deepEqual(selector.values(),['poke_010'],'filtered row tap must commit stable Pokémon ID');
assert.deepEqual(changePayload?.values,['poke_010'],'onChange must receive the committed stable Pokémon ID');
assert.match(root.querySelector('.controlled-selector-chips')?.textContent||'',/卡蒂狗 · Lv8 · 技能 · 個體 12/,'selected chip must render after filtered tap');

// Search again for the same species and choose the other individual; identities must remain separate.
search=root.querySelector('[data-cs-search]');
search.value='instance_13';
search.dispatchEvent(new Event('input',{bubbles:true}));
rows=[...root.querySelectorAll('[data-cs-option-value]')];
assert.equal(rows.length,1);
assert.equal(rows[0].dataset.csOptionValue,'poke_013');
rows[0].click();
assert.deepEqual(selector.values(),['poke_010','poke_013']);

// Remove and clear still work after stable-value commit.
root.querySelector('[data-cs-remove="0"]')?.click();
assert.deepEqual(selector.values(),['poke_013']);
root.querySelector('[data-cs-clear]')?.click();
assert.deepEqual(selector.values(),[]);

// The ingredient number-map editor reuses the same selector path and must inherit the fix.
let mapPayload=null;
const mapRoot=document.querySelector('#map');
const mapEditor=createControlledNumberMapEditor(mapRoot,{
  options:[
    {value:'好眠番茄',label:'好眠番茄',group:'食材'},
    {value:'哞哞鮮奶',label:'哞哞鮮奶',group:'食材'},
  ],
  value:{},
  onChange:value=>{mapPayload={...value};},
});
search=mapRoot.querySelector('[data-cs-search]');
search.value='鮮奶';
search.dispatchEvent(new Event('input',{bubbles:true}));
rows=[...mapRoot.querySelectorAll('[data-cs-option-value]')];
assert.equal(rows.length,1);
assert.equal(rows[0].dataset.csOptionValue,'哞哞鮮奶');
rows[0].click();
assert.deepEqual(mapEditor.value(),{'哞哞鮮奶':0});
assert.deepEqual(mapPayload,{'哞哞鮮奶':0});

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'V0.4.3.1_CONTROLLED_SELECTOR_SEARCH_TO_COMMIT_DOM',
  component_version:CONTROLLED_SELECTOR_VERSION,
  filtered_row_stable_value:true,
  filtered_tap_commits_chip:true,
  onchange_stable_id:true,
  duplicate_species_individual_identity:true,
  remove_and_clear:true,
  ingredient_number_map_inherits_fix:true,
},null,2)}\n`);
