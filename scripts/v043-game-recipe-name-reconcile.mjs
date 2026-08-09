import fs from 'node:fs';
import path from 'node:path';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION} from '../assets/js/public-recipe-master.js';
import {reconcileGameRecipeEvidence} from '../assets/js/recipe-name-reconciliation.js';

const [,,privateJsonArg,outputArg] = process.argv;
if(!privateJsonArg){
  console.error('Usage: node scripts/v043-game-recipe-name-reconcile.mjs <PRIVATE_RECIPES.json> [sanitized-report.json] [--strict]');
  process.exit(2);
}

const privatePayload=JSON.parse(fs.readFileSync(path.resolve(privateJsonArg),'utf8'));
const report=reconcileGameRecipeEvidence(privatePayload,PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_MASTER_VERSION);
const json=JSON.stringify(report,null,2)+'\n';
if(outputArg&&!String(outputArg).startsWith('--'))fs.writeFileSync(path.resolve(outputArg),json,'utf8');
else process.stdout.write(json);

const counts=report.counts||{};
const blocking=(counts.NO_PUBLIC_MATCH||0)+(counts.AMBIGUOUS_SIGNATURE||0);
if(process.argv.includes('--strict')&&blocking>0)process.exitCode=1;
