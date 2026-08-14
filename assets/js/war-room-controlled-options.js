import {rows,isDatabaseReady,isRescueReadonly} from './database.js';
import {PUBLIC_RECIPE_MASTER,PUBLIC_RECIPE_ALIASES} from './public-recipe-current-authority.js';
import {PUBLIC_MAIN_SKILL_MASTER} from './public-pokemon-knowledge-master.js';

export const WAR_ROOM_CONTROLLED_OPTIONS_VERSION='war-room-controlled-options-2026-08-09-a';

const text=value=>String(value??'').normalize('NFKC').trim();
const unique=values=>[...new Set(values.map(text).filter(Boolean))];

export const WAR_ROOM_ROLE_OPTIONS=Object.freeze([
  Object.freeze({value:'樹果',label:'樹果',description:'樹果專長'}),
  Object.freeze({value:'食材',label:'食材',description:'食材專長'}),
  Object.freeze({value:'技能',label:'技能',description:'技能專長'}),
]);

export function getWarRoomPokemonOptions(){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze([]);
  const pokemon=rows("SELECT pokemon_id,pokemon_instance_id,current_species,species,nickname,level,specialty,status FROM pokemon WHERE status='active' ORDER BY COALESCE(current_species,species),level DESC,pokemon_id");
  return Object.freeze(pokemon.map((row,index)=>{
    const species=text(row.current_species||row.species)||'未命名寶可夢';
    const level=Number(row.level),specialty=text(row.specialty),nickname=text(row.nickname),pokemonId=text(row.pokemon_id),instanceId=text(row.pokemon_instance_id);
    const uniqueSuffix=nickname?`暱稱 ${nickname}`:`個體 ${String(index+1).padStart(2,'0')}`;
    const parts=[species,Number.isFinite(level)?`Lv${level}`:null,specialty||null,uniqueSuffix].filter(Boolean);
    return Object.freeze({
      value:pokemonId,
      label:parts.join(' · '),
      group:specialty||'未分類',
      description:nickname||null,
      aliases:Object.freeze(unique([species,nickname,instanceId,pokemonId])),
    });
  }));
}

export function getWarRoomIngredientOptions(){
  if(!isDatabaseReady()||isRescueReadonly())return Object.freeze([]);
  return Object.freeze(rows('SELECT ingredient_name FROM ingredient_master ORDER BY ingredient_name').map(row=>Object.freeze({
    value:text(row.ingredient_name),label:text(row.ingredient_name),group:'食材',aliases:Object.freeze([]),
  })).filter(row=>row.value));
}

export function getWarRoomRecipeOptions(){
  const aliasesById=new Map();
  for(const alias of PUBLIC_RECIPE_ALIASES){
    if(alias.alias_type!=='legacy_recipe_name')continue;
    if(!aliasesById.has(alias.recipe_id))aliasesById.set(alias.recipe_id,[]);
    aliasesById.get(alias.recipe_id).push(alias.alias_value);
  }
  return Object.freeze(PUBLIC_RECIPE_MASTER.map(row=>Object.freeze({
    value:row.recipe_id,label:row.recipe_name,group:row.category,
    description:`需求 ${row.total_ingredients} 個食材`,
    aliases:Object.freeze(unique([row.recipe_name,...(aliasesById.get(row.recipe_id)||[])])),
  })));
}

export function getWarRoomMainSkillOptions(){
  const byName=new Map();
  for(const row of PUBLIC_MAIN_SKILL_MASTER){
    const name=text(row.main_skill_name);if(!name)continue;
    const existing=byName.get(name);
    if(!existing||existing.verification_status==='COMPATIBILITY_ALIAS')byName.set(name,row);
  }
  return Object.freeze([...byName.values()].map(row=>Object.freeze({
    value:text(row.main_skill_name),label:text(row.main_skill_name),group:'主技能',description:text(row.description_zh_tw),aliases:Object.freeze([]),
  })).sort((a,b)=>a.label.localeCompare(b.label,'zh-Hant')));
}

export function warRoomControlledOptionCoverage(){
  const pokemon=getWarRoomPokemonOptions(),ingredients=getWarRoomIngredientOptions(),recipes=getWarRoomRecipeOptions(),skills=getWarRoomMainSkillOptions();
  return Object.freeze({
    version:WAR_ROOM_CONTROLLED_OPTIONS_VERSION,
    player_database_available:isDatabaseReady()&&!isRescueReadonly(),
    pokemon_count:pokemon.length,ingredient_count:ingredients.length,recipe_count:recipes.length,main_skill_count:skills.length,role_count:WAR_ROOM_ROLE_OPTIONS.length,
  });
}
