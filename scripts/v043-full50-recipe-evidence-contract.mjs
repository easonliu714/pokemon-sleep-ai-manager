import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingredientSignature, loadPublicRecipeMaster, normalizeCategory } from './v043-recipe-zh-tw-evidence-audit.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const root=path.resolve(__dirname,'..');
const evidencePath=path.join(root,'assets/data/public-recipe-zh-tw-screenshot-evidence-2026-08-09.json');
const masterPath=path.join(root,'assets/js/public-recipe-master.js');

const forbiddenKeys=new Set([
  'recipe_id','private_recipe_id','recipe_level','current_energy','unlocked','notes','update_id','operation_id',
  'source_image_ref','source_image_sha256','source_zip_sha256','screenshot','filename','account_id','pokemon_id',
]);

function assertNoForbiddenKeys(value,pathParts=[]){
  if(Array.isArray(value)){value.forEach((entry,index)=>assertNoForbiddenKeys(entry,[...pathParts,String(index)]));return;}
  if(!value||typeof value!=='object')return;
  for(const [key,entry] of Object.entries(value)){
    assert.equal(forbiddenKeys.has(key),false,`forbidden private/player field in sanitized evidence: ${[...pathParts,key].join('.')}`);
    assertNoForbiddenKeys(entry,[...pathParts,key]);
  }
}

function norm(value){return String(value??'').normalize('NFKC').replaceAll('/','／').replace(/[\s　]+/g,'').trim();}
function normalizeIngredients(rows){
  const combined=new Map();
  for(const row of rows??[]){
    const name=norm(row?.ingredient_name??row?.name??row?.[0]);
    const quantity=Number(row?.quantity??row?.[1]);
    assert.ok(name,'ingredient name required');
    assert.ok(Number.isFinite(quantity)&&quantity>0,`invalid ingredient quantity for ${name}`);
    combined.set(name,(combined.get(name)??0)+quantity);
  }
  return [...combined.entries()].map(([ingredient_name,quantity])=>({ingredient_name,quantity})).sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
}
function bigrams(value){const text=norm(value);const set=new Set();if(text.length<2){if(text)set.add(text);return set;}for(let i=0;i<text.length-1;i+=1)set.add(text.slice(i,i+2));return set;}
function dice(left,right){const a=bigrams(left),b=bigrams(right);if(!a.size||!b.size)return 0;let hit=0;for(const token of a)if(b.has(token))hit+=1;return(2*hit)/(a.size+b.size);}
function suffixRatio(left,right){const a=norm(left),b=norm(right);const denominator=Math.max(1,Math.min(a.length,b.length));let count=0;while(count<denominator&&a[a.length-1-count]===b[b.length-1-count])count+=1;return count/denominator;}
function similarity(left,right){return Math.max(dice(left,right),suffixRatio(left,right));}
function totalIngredients(rows){return rows.reduce((sum,row)=>sum+Number(row.quantity||0),0);}

function classify(observed,publicRows){
  const signature=ingredientSignature(observed.category,observed.ingredients);
  const formulaMatches=publicRows.filter((row)=>ingredientSignature(row.category,row.ingredients)===signature);
  if(formulaMatches.length===1){
    const match=formulaMatches[0];
    return {classification:match.recipe_name===observed.observed_name?'EXACT_NAME':'NAME_ALIAS',match,basis:'CATEGORY_INGREDIENT_SIGNATURE'};
  }
  if(formulaMatches.length>1){
    const exact=formulaMatches.filter((row)=>row.recipe_name===observed.observed_name);
    if(exact.length===1)return{classification:'EXACT_NAME',match:exact[0],basis:'CATEGORY_INGREDIENT_SIGNATURE_PLUS_EXACT_NAME'};
    return{classification:'UNRESOLVED',match:null,basis:'AMBIGUOUS_FORMULA_SIGNATURE'};
  }
  const sameCategory=publicRows.filter((row)=>row.category===observed.category);
  const exactName=sameCategory.find((row)=>row.recipe_name===observed.observed_name);
  if(exactName)return{classification:'FORMULA_CONFLICT',match:exactName,basis:'EXACT_NAME_DIFFERENT_FORMULA'};
  const ranked=sameCategory.map((row)=>({row,score:similarity(observed.observed_name,row.recipe_name)})).sort((a,b)=>b.score-a.score||a.row.recipe_id.localeCompare(b.row.recipe_id));
  const best=ranked[0],second=ranked[1];
  if(best&&best.score>=0.6&&(!second||best.score-second.score>=0.15)&&totalIngredients(best.row.ingredients)===totalIngredients(observed.ingredients)){
    return{classification:'FORMULA_CONFLICT',match:best.row,basis:'CONSERVATIVE_NAME_SIMILARITY_SAME_TOTAL'};
  }
  return{classification:'UNRESOLVED',match:null,basis:'NO_UNIQUE_PUBLIC_IDENTITY'};
}

const evidence=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
assertNoForbiddenKeys(evidence);
assert.equal(evidence.schema,'pokemon-sleep-public-recipe-zh-tw-screenshot-evidence/1.0');
assert.equal(evidence.scope,'SANITIZED_PUBLIC_FACTS_ONLY');
assert.equal(evidence.observed_recipe_count,50);
assert.equal(evidence.recipes.length,50);
assert.deepEqual(evidence.expected_category_counts,{'咖哩／濃湯':13,'沙拉':17,'甜點／飲料':20});

const names=new Set();
const counts={'咖哩／濃湯':0,'沙拉':0,'甜點／飲料':0};
const observed=evidence.recipes.map((row)=>{
  const observed_name=norm(row.observed_name);
  const category=normalizeCategory(row.category);
  const ingredients=normalizeIngredients(row.ingredients);
  assert.ok(observed_name,'observed_name required');
  assert.equal(names.has(observed_name),false,`duplicate observed recipe name: ${observed_name}`);
  names.add(observed_name);
  assert.ok(Object.hasOwn(counts,category),`unexpected category ${category}`);
  counts[category]+=1;
  return{observed_name,category,ingredients};
});
assert.deepEqual(counts,{'咖哩／濃湯':13,'沙拉':17,'甜點／飲料':20});

const publicRows=loadPublicRecipeMaster(masterPath);
assert.equal(publicRows.length,76,'v0.4.2 active public recipe count must stay 76 during R2.1');
const records=observed.map((row)=>{const result=classify(row,publicRows);return{observed_name:row.observed_name,category:row.category,matched_public_recipe_id:result.match?.recipe_id??null,matched_public_name:result.match?.recipe_name??null,classification:result.classification,basis:result.basis};});
const classification_counts={EXACT_NAME:0,NAME_ALIAS:0,FORMULA_CONFLICT:0,UNRESOLVED:0};
for(const row of records)classification_counts[row.classification]+=1;

const conflict=records.find((row)=>row.observed_name==='迷昏拳辣味咖哩');
assert.ok(conflict,'blocking conflict evidence missing');
assert.equal(conflict.classification,'FORMULA_CONFLICT');
assert.equal(conflict.matched_public_name,'暈眩拳辣味咖哩');

const warmMilk=records.find((row)=>row.observed_name==='哞哞熱鮮奶');
assert.ok(warmMilk,'in-game warm milk evidence missing');
assert.equal(warmMilk.classification,'NAME_ALIAS');
assert.equal(warmMilk.matched_public_name,'溫熱哞哞鮮奶');

const apple=records.find((row)=>row.observed_name==='特選蘋果咖哩');
assert.equal(apple?.classification,'EXACT_NAME');

const alias_pairs=records.filter((row)=>row.classification==='NAME_ALIAS').map((row)=>({observed_name:row.observed_name,public_name:row.matched_public_name,public_recipe_id:row.matched_public_recipe_id}));
const conflicts=records.filter((row)=>row.classification==='FORMULA_CONFLICT');
const unresolved=records.filter((row)=>row.classification==='UNRESOLVED');

process.stdout.write(`${JSON.stringify({
  status:'PASS',
  gate:'R2.1_FULL50_SANITIZED_RECONCILIATION',
  public_recipe_count:publicRows.length,
  observed_recipe_count:observed.length,
  category_counts:counts,
  classification_counts,
  alias_pairs,
  conflicts,
  unresolved,
  runtime_master_modified:false,
  player_database_opened:false,
  player_database_write_performed:false,
},null,2)}\n`);
