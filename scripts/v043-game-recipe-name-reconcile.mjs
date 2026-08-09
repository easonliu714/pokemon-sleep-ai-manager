import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const [,,privateJsonArg,outputArg] = process.argv;
if(!privateJsonArg){
  console.error('Usage: node scripts/v043-game-recipe-name-reconcile.mjs <PRIVATE_RECIPES.json> [sanitized-report.json]');
  process.exit(2);
}

const repoRoot=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const masterModule=await import(pathToFileURL(path.join(repoRoot,'assets/js/public-recipe-master.js')).href);
const {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION}=masterModule;

const normalizeCategory=value=>{
  const text=String(value||'').trim();
  if(text==='點心／飲料'||text==='甜點／飲料')return '甜點／飲料';
  return text;
};
const normalizeName=value=>String(value||'').normalize('NFKC').trim();
const ingredientSignature=ingredients=>Object.entries(ingredients||{})
  .map(([name,quantity])=>[normalizeName(name),Number(quantity)])
  .filter(([name,quantity])=>name&&Number.isFinite(quantity)&&quantity>0)
  .sort((a,b)=>a[0].localeCompare(b[0],'zh-Hant'))
  .map(([name,quantity])=>`${name}×${quantity}`)
  .join('|');

const privatePayload=JSON.parse(fs.readFileSync(path.resolve(privateJsonArg),'utf8'));
if(privatePayload?.privacy?.github_commit_allowed!==false){
  throw new Error('Refusing audit: expected privacy.github_commit_allowed=false for private recipe evidence');
}
if(privatePayload?.source!=='player_game_screenshots_from_private_zip'){
  throw new Error(`Refusing audit: unsupported evidence source ${privatePayload?.source||'(missing)'}`);
}

const recipes=new Map();
for(const operation of privatePayload.operations||[]){
  if(operation?.action!=='upsert')continue;
  if(operation.entity==='recipes'){
    const privateId=String(operation.key?.recipe_id||'');
    if(!privateId)continue;
    recipes.set(privateId,{
      category:normalizeCategory(operation.data?.category),
      recipe_name:normalizeName(operation.data?.recipe_name),
      ingredients:{},
    });
  }
}
for(const operation of privatePayload.operations||[]){
  if(operation?.entity!=='recipe_ingredients'||operation?.action!=='upsert')continue;
  const privateId=String(operation.key?.recipe_id||'');
  const ingredient=normalizeName(operation.key?.ingredient_name);
  const quantity=Number(operation.data?.quantity);
  const recipe=recipes.get(privateId);
  if(!recipe||!ingredient||!Number.isFinite(quantity))continue;
  recipe.ingredients[ingredient]=quantity;
}

const masterIndex=new Map();
for(const recipe of PUBLIC_RECIPE_MASTER){
  const category=normalizeCategory(recipe.category);
  const ingredients=Object.fromEntries((recipe.ingredients||[]).map(row=>[normalizeName(row.ingredient_name),Number(row.quantity)]));
  const key=`${category}::${ingredientSignature(ingredients)}`;
  if(!masterIndex.has(key))masterIndex.set(key,[]);
  masterIndex.get(key).push({
    recipe_id:recipe.recipe_id,
    category,
    recipe_name:normalizeName(recipe.recipe_name),
    ingredients,
    verification_status:recipe.verification_status||null,
  });
}

const rows=[];
for(const recipe of recipes.values()){
  const signature=ingredientSignature(recipe.ingredients);
  const key=`${recipe.category}::${signature}`;
  const matches=masterIndex.get(key)||[];
  let classification='NO_PUBLIC_MATCH';
  let canonical=null;
  if(matches.length===1){
    canonical=matches[0];
    classification=canonical.recipe_name===recipe.recipe_name?'EXACT_CANONICAL_NAME':'NAME_CORRECTION_REQUIRED';
  }else if(matches.length>1){
    classification='AMBIGUOUS_SIGNATURE';
  }
  rows.push({
    category:recipe.category,
    game_recipe_name:recipe.recipe_name,
    ingredient_signature:signature,
    classification,
    canonical_recipe_id:canonical?.recipe_id||null,
    current_public_name:canonical?.recipe_name||null,
    proposed_canonical_name:canonical&&classification==='NAME_CORRECTION_REQUIRED'?recipe.recipe_name:null,
    proposed_legacy_alias:canonical&&classification==='NAME_CORRECTION_REQUIRED'?canonical.recipe_name:null,
    public_verification_status:canonical?.verification_status||null,
    candidate_recipe_ids:matches.length>1?matches.map(row=>row.recipe_id):[],
  });
}
rows.sort((a,b)=>a.category.localeCompare(b.category,'zh-Hant')||a.game_recipe_name.localeCompare(b.game_recipe_name,'zh-Hant'));

const counts=rows.reduce((acc,row)=>{
  acc[row.classification]=(acc[row.classification]||0)+1;
  return acc;
},{});
const report={
  schema:'pokemon-sleep-game-recipe-name-reconciliation/1.0',
  public_recipe_master_version:PUBLIC_RECIPE_MASTER_VERSION,
  source_policy:'PRIVATE_INPUT_SANITIZED_OUTPUT_ONLY',
  private_fields_exported:false,
  player_recipe_count:rows.length,
  counts,
  rows,
};

const json=JSON.stringify(report,null,2)+'\n';
if(outputArg)fs.writeFileSync(path.resolve(outputArg),json,'utf8');
else process.stdout.write(json);

const blocking=(counts.NO_PUBLIC_MATCH||0)+(counts.AMBIGUOUS_SIGNATURE||0);
if(process.argv.includes('--strict')&&blocking>0)process.exitCode=1;
