// G9R: production source-bound HOLD must use the audited evidence register.
// Test real renderer output with an isolated DOM shim; no player storage is accessed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NOVEMBER_BANQUET_RECIPE_EVIDENCE as candidates} from '../assets/js/g9r-november-recipe-evidence-hold.js';
import {renderNovemberRecipeHold} from '../assets/js/g9r-november-recipe-hold-ui.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const hold=html.match(/<aside id="novemberBanquetRecipeHold"[^>]*>([\s\S]*?)<\/aside>/)?.[1];
assert.ok(hold,'production Recipes HOLD section must exist');
assert.match(html,/g9r-november-recipe-hold-ui\.js/,'production page must load source-bound HOLD renderer');
assert.match(hold,/data-g9r-hold-list/,'production HOLD needs a renderer target');
assert.doesNotMatch(hold,/萌綠玉米|暖暖薑|特選蛋/,'production markup must not duplicate evidence identities');
const list={items:[],replaceChildren(fragment){this.items=[...fragment.children]}};
const root={dataset:{},querySelector(selector){return selector==='[data-g9r-hold-list]'?list:null}};
const previous=globalThis.document;
globalThis.document={
  createDocumentFragment(){return {children:[],appendChild(child){this.children.push(child)}}},
  createElement(tag){assert.equal(tag,'li');return {textContent:''}},
};
try{
  assert.equal(renderNovemberRecipeHold(root),true);
  assert.equal(list.items.length,3);
  for(let i=0;i<3;i++){
    const row=candidates[i];
    assert.equal(row.active,false);
    assert.equal(row.verification_status,'HOLD_FORMULA_AND_NAME_EVIDENCE');
    assert.ok(list.items[i].textContent.includes(String(row.total_ingredients)));
    for(const name of row.ingredient_names)assert.ok(list.items[i].textContent.includes(name));
  }
  assert.equal(root.dataset.evidenceStatus,'HOLD_FORMULA_AND_NAME_EVIDENCE');
}finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
}
console.log('PASS_G9R_RECIPE_HOLD_SOURCE_BOUND_RENDERER');
