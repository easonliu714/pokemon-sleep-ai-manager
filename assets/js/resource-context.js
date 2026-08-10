import {rows,isDatabaseReady,isRescueReadonly} from './database.js';

export const RESOURCE_CONTEXT_VERSION='resource-context-2026-08-10-a';
export const CANDY_CONVERSION_RULE_STATUS='NOT_YET_VERIFIED';

const stableSortObject=value=>{
  if(Array.isArray(value))return value.map(stableSortObject);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableSortObject(value[key])]));
  return value;
};
const stableJson=value=>JSON.stringify(stableSortObject(value));
const fnv1a=value=>{
  let hash=2166136261;
  for(let index=0;index<value.length;index+=1){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
};
const safeRows=(sql,params=[])=>{try{return rows(sql,params);}catch{return [];}};
const number=value=>Number(value||0);

export function buildUnifiedResourceSnapshot(){
  if(!isDatabaseReady()||isRescueReadonly())return {
    schema:'pokemon-sleep-resource-context/1.0',version:RESOURCE_CONTEXT_VERSION,status:'PLAYER_DATABASE_UNAVAILABLE',
    ingredients:[],items:[],candies:[],candy_conversion:{rule_status:CANDY_CONVERSION_RULE_STATUS,derived_options:[],included_in_physical_totals:false},fingerprint:null,
  };
  const ingredients=safeRows(`SELECT m.ingredient_name,COALESCE(i.quantity,0) quantity,CASE WHEN i.ingredient_name IS NULL THEN 0 ELSE 1 END player_record_exists,i.updated_at
      FROM ingredient_master m LEFT JOIN ingredient_inventory i ON i.ingredient_name=m.ingredient_name ORDER BY m.ingredient_name`).map(row=>({
    ingredient_name:row.ingredient_name,quantity:number(row.quantity),available:number(row.quantity),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const items=safeRows(`SELECT m.item_name,m.item_category,COALESCE(i.quantity,0) quantity,COALESCE(i.safe_reserve,0) safe_reserve,
      MAX(0,COALESCE(i.quantity,0)-COALESCE(i.safe_reserve,0)) available,CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END player_record_exists,i.updated_at
      FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name ORDER BY m.item_name`).map(row=>({
    item_name:row.item_name,item_category:row.item_category||null,quantity:number(row.quantity),safe_reserve:number(row.safe_reserve),available:number(row.available),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const candies=safeRows(`SELECT candy_id,candy_name,candy_type,target_species_name,target_type_name,quantity,safe_reserve,available,player_record_exists,updated_at
      FROM candy_catalog_state ORDER BY candy_type,candy_name`).map(row=>({
    candy_id:row.candy_id,candy_name:row.candy_name,candy_type:row.candy_type,target_species_name:row.target_species_name||null,target_type_name:row.target_type_name||null,
    quantity:number(row.quantity),safe_reserve:number(row.safe_reserve),available:number(row.available),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const payload={
    schema:'pokemon-sleep-resource-context/1.0',version:RESOURCE_CONTEXT_VERSION,status:'READY',
    ingredients,items,candies,
    candy_conversion:{
      rule_status:CANDY_CONVERSION_RULE_STATUS,
      derived_options:[],
      included_in_physical_totals:false,
      warning:'尚未建立 Evidence-backed 糖果轉換規則；只計入玩家實際持有的實體糖果，避免 double counting。',
    },
  };
  const fingerprint=`resource:${RESOURCE_CONTEXT_VERSION}:${fnv1a(stableJson(payload))}`;
  return {...payload,fingerprint,fingerprint_algorithm:'FNV1A32_CANONICAL_JSON'};
}

export function relevantResourceSnapshot({includeZero=false}={}){
  const snapshot=buildUnifiedResourceSnapshot();
  if(snapshot.status!=='READY')return snapshot;
  const keep=row=>includeZero||row.player_record_exists||number(row.quantity)>0||number(row.safe_reserve)>0;
  return {...snapshot,ingredients:snapshot.ingredients.filter(keep),items:snapshot.items.filter(keep),candies:snapshot.candies.filter(keep)};
}
