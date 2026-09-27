import assert from 'node:assert/strict';
import {createPersonalRecipeService} from '../assets/js/personal-recipe-service.js';

const state={
  recipes:new Map(),ingredients:new Map(),batches:[],changes:[],snapshots:[],events:[],persisted:0,
  publicRecipes:new Map([['public:001','公版沙拉']]),
};
const clone=value=>JSON.parse(JSON.stringify(value));
let transactionBackup=null;
const rows=(sql,args=[])=>{
  if(sql.includes('FROM recipe_master'))return [...state.publicRecipes].map(([recipe_id,recipe_name])=>({recipe_id,recipe_name}));
  if(sql.includes('FROM recipes WHERE recipe_id=')){const row=state.recipes.get(args[0]);return row?[clone(row)]:[];}
  if(sql.includes('FROM recipe_ingredients WHERE recipe_id='))return clone(state.ingredients.get(args[0])||[]).sort((a,b)=>a.ingredient_name.localeCompare(b.ingredient_name,'zh-Hant'));
  throw new Error(`unexpected SELECT: ${sql}`);
};
const run=(sql,args=[])=>{
  state.events.push(sql.split(/\s+/).slice(0,4).join(' '));
  if(sql.startsWith('INSERT INTO recipes')){
    const [recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes]=args;
    state.recipes.set(recipe_id,{recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes});return;
  }
  if(sql.startsWith('DELETE FROM recipe_ingredients')){state.ingredients.set(args[0],[]);return;}
  if(sql.startsWith('DELETE FROM recipes')){state.recipes.delete(args[0]);return;}
  if(sql.startsWith('INSERT INTO recipe_ingredients')){const [recipe_id,ingredient_name,quantity]=args;const list=state.ingredients.get(recipe_id)||[];list.push({recipe_id,ingredient_name,quantity});state.ingredients.set(recipe_id,list);return;}
  if(sql.startsWith('INSERT INTO import_batches')){state.batches.push(clone(args));return;}
  if(sql.startsWith('INSERT INTO import_changes')){state.changes.push(clone(args));return;}
  throw new Error(`unexpected mutation: ${sql}`);
};
const snapshot=async label=>{state.snapshots.push(label);};
const begin=()=>{transactionBackup=clone({recipes:[...state.recipes],ingredients:[...state.ingredients],batches:state.batches,changes:state.changes});state.events.push('BEGIN');};
const commit=()=>{transactionBackup=null;state.events.push('COMMIT');};
const rollback=()=>{state.events.push('ROLLBACK');if(!transactionBackup)return;state.recipes=new Map(transactionBackup.recipes);state.ingredients=new Map(transactionBackup.ingredients);state.batches=transactionBackup.batches;state.changes=transactionBackup.changes;transactionBackup=null;};
const persist=async()=>{state.persisted+=1;state.events.push('PERSIST');};
const clock=()=>new Date('2026-09-26T12:00:00.000Z');
const service=createPersonalRecipeService({rows,run,snapshot,begin,commit,rollback,persist,clock,random:()=>0.25});

const base={recipe_id:'player:001',category:'沙拉',recipe_name:'我的沙拉',unlocked:true,recipe_level:12,current_energy:3456,notes:'owner',ingredients:[{ingredient_name:'豆製肉',quantity:3},{ingredient_name:'好眠番茄',quantity:2},{ingredient_name:'豆製肉',quantity:4}]};
const created=await service.create(base);
assert.equal(created.after.source,'player_manual');
assert.equal(created.after.total_ingredients,9);
assert.deepEqual(created.after.ingredients.map(({ingredient_name,quantity})=>({ingredient_name,quantity})),[{ingredient_name:'好眠番茄',quantity:2},{ingredient_name:'豆製肉',quantity:7}]);
assert.equal(state.snapshots.length,1);
assert.equal(state.batches.length,1);
assert.equal(state.changes.length,1);
assert.equal(state.persisted,1);
assert.ok(state.events.indexOf('BEGIN')<state.events.indexOf('COMMIT'));
assert.ok(state.events.indexOf('COMMIT')<state.events.indexOf('PERSIST'));

const updated=await service.update({...base,recipe_name:'我的沙拉 v2',recipe_level:13,current_energy:4567,notes:'edited',ingredients:[{ingredient_name:'好眠番茄',quantity:5}]});
assert.equal(updated.after.recipe_name,'我的沙拉 v2');
assert.equal(updated.after.total_ingredients,5);
assert.equal(updated.before.total_ingredients,9);
assert.equal(state.snapshots.length,2);

await assert.rejects(()=>service.create({...base,recipe_id:'public:001'}),/player: namespace/);
await assert.rejects(()=>service.create({...base,recipe_id:'player:collision',recipe_name:'公版沙拉'}),/read-only/);
state.recipes.set('player:public-state',{...base,recipe_id:'player:public-state',source:'public_catalog_manual'});
state.ingredients.set('player:public-state',[]);
await assert.rejects(()=>service.update({...base,recipe_id:'player:public-state'}),/only player-owned/);
assert.equal(state.publicRecipes.has('public:001'),true);

const deleted=await service.delete('player:001');
assert.equal(deleted.after,null);
assert.equal(service.load('player:001'),null);
assert.equal(state.snapshots.length,3);
assert.equal(state.batches.length,3);
assert.equal(state.changes.length,3);
assert.equal(state.persisted,3);

console.log(JSON.stringify({contract:'g51-personal-recipe-service',status:'PASS',snapshot_before_each_mutation:true,single_transaction:true,audit:true,persist_after_commit:true,player_namespace_required:true,public_id_and_name_collision_blocked:true,public_master_read_only:true,deterministic_total:true},null,2));
