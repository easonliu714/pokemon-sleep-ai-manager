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

assert.equal(CONTROLLED_SELECTOR_VERSION,'controlled-selector-2026-08-09-c');
assert.deepEqual(selector.values(),[]);

// Android IME regression: composition/backspace must never replace the search input node.
let search=root.querySelector('[data-cs-search]');
const originalSearchNode=search;
search.focus();
search.dispatchEvent(new Event('compositionstart',{bubbles:true}));
search.value='卡蒂狗';
search.dispatchEvent(new Event('input',{bubbles:true}));
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'IME composition must preserve the search input DOM node');
search.value='卡蒂';
search.dispatchEvent(new Event('input',{bubbles:true}));
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'backspace during composition must preserve the search input DOM node');
search.dispatchEvent(new Event('compositionend',{bubbles:true}));
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'compositionend must refresh options without rebuilding the search input');

// Normal deletion after composition must also keep the keyboard-owning input node stable.
search.value='卡';
search.dispatchEvent(new Event('input',{bubbles:true}));
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'ordinary backspace/search edits must not rebuild the input');

// Reproduce LIVE-H1 exactly: search to one row, then tap it and commit stable ID.
search.value='個體 12';
search.dispatchEvent(new Event('input',{bubbles:true}));
let rows=[...root.querySelectorAll('[data-cs-option-value]')];
assert.equal(rows.length,1,'filtered search must produce exactly one selectable row');
assert.equal(rows[0].dataset.csOptionValue,'poke_010','filtered row must carry stable value, not a transient object index');
rows[0].click();
await Promise.resolve();
assert.deepEqual(selector.values(),['poke_010'],'filtered row tap must commit stable Pokémon ID');
assert.deepEqual(changePayload?.values,['poke_010'],'onChange must receive the committed stable Pokémon ID');
assert.match(root.querySelector('.controlled-selector-chips')?.textContent||'',/卡蒂狗 · Lv8 · 技能 · 個體 12/,'selected chip must render after filtered tap');
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'multi-select commit must preserve the search input for continued selection');

// Search again for the same species and choose the other individual; identities must remain separate.
search=root.querySelector('[data-cs-search]');
search.value='instance_13';
search.dispatchEvent(new Event('input',{bubbles:true}));
rows=[...root.querySelectorAll('[data-cs-option-value]')];
assert.equal(rows.length,1);
assert.equal(rows[0].dataset.csOptionValue,'poke_013');
rows[0].click();
await Promise.resolve();
assert.deepEqual(selector.values(),['poke_010','poke_013']);
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'second multi-select commit must still preserve input identity');

// Remove and clear still work after stable-value commit.
root.querySelector('[data-cs-remove="0"]')?.click();
assert.deepEqual(selector.values(),['poke_013']);
root.querySelector('[data-cs-clear]')?.click();
await Promise.resolve();
assert.deepEqual(selector.values(),[]);
assert.strictEqual(root.querySelector('[data-cs-search]'),originalSearchNode,'clear must not destroy the search input');

// The ingredient number-map editor reuses the same selector path and must inherit the stable-value fix.
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
  ime_composition_preserves_input_node:true,
  backspace_preserves_input_node:true,
  multi_select_keeps_search_input:true,
  remove_and_clear:true,
  ingredient_number_map_inherits_fix:true,
},null,2)}\n`);
