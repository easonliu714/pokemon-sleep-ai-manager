import {rows,isDatabaseReady,isRescueReadonly} from './database.js';

export const RESOURCE_CONTEXT_VERSION='resource-context-2026-08-12-b-g72-evidence-authority';
export const RESOURCE_EVIDENCE_POLICY_VERSION='resource-evidence-policy-2026-08-12-a';
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
const observed=row=>Boolean(row?.player_record_exists);

export function resourceQuantityState(row){
  if(!observed(row))return 'NOT_OBSERVED';
  return number(row?.quantity)===0?'ZERO_CONFIRMED':'OBSERVED_QUANTITY';
}

export function summarizeResourceCollectionEvidence(rowsInput=[],{collection='resources',databaseAvailable=true}={}){
  const source=Array.isArray(rowsInput)?rowsInput:[];
  if(!databaseAvailable)return Object.freeze({
    policy_version:RESOURCE_EVIDENCE_POLICY_VERSION,collection,catalog_row_count:0,observed_row_count:0,confirmed_zero_row_count:0,missing_row_count:0,
    completeness_status:'PLAYER_DATABASE_UNAVAILABLE',missing_row_semantics:'UNKNOWN_NOT_ZERO',zero_fill_authorized:false,
    zero_confirmation_rule:'EXPLICIT_PLAYER_RECORD_QUANTITY_ZERO_ONLY',authority:'PLAYER_LOCAL_SQLITE',
  });
  const catalogRowCount=source.length;
  const observedRowCount=source.filter(observed).length;
  const confirmedZeroRowCount=source.filter(row=>resourceQuantityState(row)==='ZERO_CONFIRMED').length;
  const missingRowCount=Math.max(0,catalogRowCount-observedRowCount);
  const completenessStatus=catalogRowCount===0?'CATALOG_UNAVAILABLE':missingRowCount===0?'COMPLETE_BY_ROW_COVERAGE':observedRowCount===0?'NOT_OBSERVED':'PARTIAL';
  return Object.freeze({
    policy_version:RESOURCE_EVIDENCE_POLICY_VERSION,collection,catalog_row_count:catalogRowCount,observed_row_count:observedRowCount,confirmed_zero_row_count:confirmedZeroRowCount,missing_row_count:missingRowCount,
    completeness_status:completenessStatus,missing_row_semantics:'UNKNOWN_NOT_ZERO',zero_fill_authorized:false,
    zero_confirmation_rule:'EXPLICIT_PLAYER_RECORD_QUANTITY_ZERO_ONLY',authority:'PLAYER_LOCAL_SQLITE',
  });
}

function decorateResourceRow(row){
  const quantityState=resourceQuantityState(row);
  return {...row,quantity_state:quantityState,evidence_authority:quantityState==='NOT_OBSERVED'?'NO_PLAYER_RECORD':'PLAYER_INVENTORY_ROW'};
}
function collectionEvidence({ingredients=[],items=[],candies=[]}={},databaseAvailable=true){return Object.freeze({
  policy_version:RESOURCE_EVIDENCE_POLICY_VERSION,
  ingredients:summarizeResourceCollectionEvidence(ingredients,{collection:'ingredients',databaseAvailable}),
  items:summarizeResourceCollectionEvidence(items,{collection:'items',databaseAvailable}),
  candies:summarizeResourceCollectionEvidence(candies,{collection:'candies',databaseAvailable}),
});}

export function buildUnifiedResourceSnapshot(){
  if(!isDatabaseReady()||isRescueReadonly())return {
    schema:'pokemon-sleep-resource-context/1.0',version:RESOURCE_CONTEXT_VERSION,status:'PLAYER_DATABASE_UNAVAILABLE',
    ingredients:[],items:[],candies:[],collection_evidence:collectionEvidence({},false),
    candy_conversion:{rule_status:CANDY_CONVERSION_RULE_STATUS,derived_options:[],included_in_physical_totals:false},fingerprint:null,
  };
  const ingredients=safeRows(`SELECT m.ingredient_name,COALESCE(i.quantity,0) quantity,CASE WHEN i.ingredient_name IS NULL THEN 0 ELSE 1 END player_record_exists,i.updated_at
      FROM ingredient_master m LEFT JOIN ingredient_inventory i ON i.ingredient_name=m.ingredient_name ORDER BY m.ingredient_name`).map(row=>decorateResourceRow({
    ingredient_name:row.ingredient_name,quantity:number(row.quantity),available:number(row.quantity),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const items=safeRows(`SELECT m.item_name,m.item_category,COALESCE(i.quantity,0) quantity,COALESCE(i.safe_reserve,0) safe_reserve,
      MAX(0,COALESCE(i.quantity,0)-COALESCE(i.safe_reserve,0)) available,CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END player_record_exists,i.updated_at
      FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name ORDER BY m.item_name`).map(row=>decorateResourceRow({
    item_name:row.item_name,item_category:row.item_category||null,quantity:number(row.quantity),safe_reserve:number(row.safe_reserve),available:number(row.available),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const candies=safeRows(`SELECT candy_id,candy_name,candy_type,target_species_name,target_type_name,quantity,safe_reserve,available,player_record_exists,updated_at
      FROM candy_catalog_state ORDER BY candy_type,candy_name`).map(row=>decorateResourceRow({
    candy_id:row.candy_id,candy_name:row.candy_name,candy_type:row.candy_type,target_species_name:row.target_species_name||null,target_type_name:row.target_type_name||null,
    quantity:number(row.quantity),safe_reserve:number(row.safe_reserve),available:number(row.available),player_record_exists:Boolean(number(row.player_record_exists)),updated_at:row.updated_at||null,
  }));
  const payload={
    schema:'pokemon-sleep-resource-context/1.0',version:RESOURCE_CONTEXT_VERSION,status:'READY',
    ingredients,items,candies,collection_evidence:collectionEvidence({ingredients,items,candies}),
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
