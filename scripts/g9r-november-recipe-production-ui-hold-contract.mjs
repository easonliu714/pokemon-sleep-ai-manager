// G9R: production visibility is now rendered from audited evidence, not duplicated in HTML.
// Regression: verify the actual source-bound renderer output while keeping ACTIVE authority unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-current-authority.js';
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE} from '../assets/js/g9r-november-recipe-evidence-hold.js';
import {renderNovemberRecipeHold} from '../assets/js/g9r-november-recipe-hold-ui.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=html.match(/<section id="recipes" class="view">([\s\S]*?)<\/section>/)?.[1];
assert.ok(section,'production recipe page must exist');
assert.match(section,/id="novemberBanquetRecipeHold"/);
assert.match(section,/data-g9r-hold-list/);
assert.match(section,/尚待核實/);
assert.match(section,/非正式食譜/);
assert.match(html,/g9r-november-recipe-hold-ui\.js/,'production must load the evidence renderer');
assert.doesNotMatch(section,/萌綠玉米|暖暖薑|特選蛋/,'production HTML must not duplicate evidence identities');

const list={items:[],replaceChildren(fragment){this.items=[...fragment.children]}};
const root={dataset:{},querySelector(selector){return selector==='[data-g9r-hold-list]'?list:null}};
const previous=globalThis.document;
globalThis.document={
  createDocumentFragment(){return {children:[],appendChild(child){this.children.push(child)}}},
  createElement(tag){assert.equal(tag,'li');return {textContent:''}},
};
try{
  assert.equal(renderNovemberRecipeHold(root),true,'audited evidence must be visible');
  assert.equal(list.items.length,3,'exactly three HOLD candidates');
  for(let i=0;i<NOVEMBER_BANQUET_RECIPE_EVIDENCE.length;i++){
    const row=NOVEMBER_BANQUET_RECIPE_EVIDENCE[i];
    assert.equal(row.active,false);
    assert.equal(row.verification_status,'HOLD_FORMULA_AND_NAME_EVIDENCE');
    assert.ok(list.items[i].textContent.includes(String(row.total_ingredients)),`missing official total ${row.total_ingredients}`);
    for(const ingredient of row.ingredient_names)
      assert.ok(list.items[i].textContent.includes(ingredient),`missing ingredient ${ingredient}`);
  }
  assert.equal(root.dataset.evidenceStatus,'HOLD_FORMULA_AND_NAME_EVIDENCE');
}finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
}
assert.equal(PUBLIC_RECIPE_MASTER.length,78,'pending recipes must not enter ACTIVE authority');
console.log('PASS_G9R_NOVEMBER_RECIPE_PRODUCTION_UI_HOLD_78_ACTIVE_UNCHANGED');
