import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PUBLIC_RECIPE_MASTER} from '../assets/js/public-recipe-master.js';

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'pokemon-sleep-v043-recipe-'));
const inputPath=path.join(tempDir,'PRIVATE_RECIPES.json');
const outputPath=path.join(tempDir,'sanitized.json');
const [exactSource,renameSource]=PUBLIC_RECIPE_MASTER.slice(0,2);
assert.ok(exactSource&&renameSource,'public recipe master must contain at least two recipes');

const operations=[];
function addPrivateRecipe(source,privateId,gameName){
  operations.push({
    entity:'recipes',action:'upsert',key:{recipe_id:privateId},
    data:{
      category:source.category,recipe_name:gameName,unlocked:1,
      recipe_level:57,current_energy:987654,total_ingredients:source.total_ingredients,
      notes:'PRIVATE NOTE MUST NOT LEAK',
    },
    evidence:{source_type:'game_screenshot',source_image_ref:'PRIVATE_SCREENSHOT.png',confidence:0.99},
  });
  for(const ingredient of source.ingredients){
    operations.push({
      entity:'recipe_ingredients',action:'upsert',
      key:{recipe_id:privateId,ingredient_name:ingredient.ingredient_name},
      data:{quantity:ingredient.quantity},
      evidence:{source_type:'game_screenshot',source_image_ref:'PRIVATE_SCREENSHOT.png',confidence:0.99},
    });
  }
}
addPrivateRecipe(exactSource,'recipe_private_secret_exact',exactSource.recipe_name);
addPrivateRecipe(renameSource,'recipe_private_secret_rename','遊戲內正式名稱測試');

fs.writeFileSync(inputPath,JSON.stringify({
  source:'player_game_screenshots_from_private_zip',
  privacy:{github_commit_allowed:false,contains_personal_account_data:true},
  operations,
},null,2));

const result=spawnSync(process.execPath,[
  path.resolve('scripts/v043-game-recipe-name-reconcile.mjs'),inputPath,outputPath,
],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr||result.stdout);
const raw=fs.readFileSync(outputPath,'utf8');
const report=JSON.parse(raw);

assert.equal(report.private_fields_exported,false);
assert.equal(report.player_recipe_count,2);
assert.equal(report.counts.EXACT_CANONICAL_NAME,1);
assert.equal(report.counts.NAME_CORRECTION_REQUIRED,1);
assert.ok(report.rows.some(row=>row.proposed_canonical_name==='遊戲內正式名稱測試'));
for(const forbidden of [
  'recipe_private_secret_exact','recipe_private_secret_rename','PRIVATE NOTE MUST NOT LEAK',
  'PRIVATE_SCREENSHOT.png','987654','recipe_level','current_energy','source_image_ref',
])assert.equal(raw.includes(forbidden),false,`sanitized report leaked ${forbidden}`);

console.log(JSON.stringify({
  status:'PASS',
  exact:report.counts.EXACT_CANONICAL_NAME,
  rename_required:report.counts.NAME_CORRECTION_REQUIRED,
  private_fields_exported:report.private_fields_exported,
}));
