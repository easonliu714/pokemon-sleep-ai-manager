const same=(a,b)=>Object.is(a,b)||(a==null&&b==null)||String(a??'')===String(b??'');

const SCENARIO_SUMMARY=Object.freeze({
  ingredient_inventory_update:Object.freeze({entities:['ingredient_inventory'],subject:'食材庫存資料'}),
  item_inventory_update:Object.freeze({entities:['item_inventory'],subject:'道具庫存資料'}),
  recipe_status_update:Object.freeze({entities:['recipes'],subject:'食譜狀態資料'}),
  ingredients:Object.freeze({entities:['ingredient_inventory'],subject:'食材庫存資料'}),
  items:Object.freeze({entities:['item_inventory'],subject:'道具庫存資料'}),
  recipes:Object.freeze({entities:['recipes','recipe_ingredients'],subject:'食譜資料'}),
});

const ENTITY_FALLBACK=Object.freeze({
  ingredient_inventory:Object.freeze({entities:['ingredient_inventory'],subject:'食材庫存資料'}),
  item_inventory:Object.freeze({entities:['item_inventory'],subject:'道具庫存資料'}),
  recipes:Object.freeze({entities:['recipes','recipe_ingredients'],subject:'食譜資料'}),
  recipe_ingredients:Object.freeze({entities:['recipes','recipe_ingredients'],subject:'食譜資料'}),
});

function changedFieldCount(change){
  return (change?.field_audit||[]).filter(field=>!same(field.existing,field.effective)).length;
}

function descriptorFor(payload,changes){
  const scenario=String(payload?.scenario||'').trim();
  if(SCENARIO_SUMMARY[scenario])return SCENARIO_SUMMARY[scenario];
  const primary=changes.find(change=>ENTITY_FALLBACK[change?.entity]);
  return primary?ENTITY_FALLBACK[primary.entity]:null;
}

export function buildScenarioReviewSummary(payload,preview){
  const changes=Array.isArray(preview?.changes)?preview.changes:[];
  if(changes.some(change=>change?.entity==='pokemon'))return null;
  const descriptor=descriptorFor(payload,changes);
  if(!descriptor)return null;
  const relevant=changes.filter(change=>descriptor.entities.includes(change?.entity));
  const recordCount=relevant.length;
  const changedRecords=relevant.filter(change=>changedFieldCount(change)>0).length;
  const changedFields=relevant.reduce((sum,change)=>sum+changedFieldCount(change),0);
  const title=changedRecords
    ?(changedRecords===recordCount?`${changedRecords} 筆${descriptor.subject}將更新`:`${changedRecords}/${recordCount} 筆${descriptor.subject}有差異`)
    :`✓ ${recordCount} 筆${descriptor.subject}無差異`;
  const detail=changedFields
    ?`共 ${changedFields} 個欄位會改變；此次不包含玩家寶可夢能力更新。`
    :`目前${descriptor.subject}與 JSON 相同；此次不包含玩家寶可夢能力更新。`;
  return Object.freeze({subject:descriptor.subject,record_count:recordCount,changed_record_count:changedRecords,changed_field_count:changedFields,title,detail});
}
