import {isObservedWriteValue} from './data-preservation-policy.js';

export const WEEKLY_OVERRIDE_REBASE_VERSION='weekly-override-rebase-2026-08-11-a';
export const WEEKLY_OVERRIDE_REBASE_FIELDS=Object.freeze([
  'camp','dish_category','pot_size','favorite_berry_1','favorite_berry_2','favorite_berry_3','event_name','event_effects','base_notes',
]);
export const WEEKLY_OVERRIDE_REBASE_BERRY_FIELDS=Object.freeze(['favorite_berry_1','favorite_berry_2','favorite_berry_3']);

const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const cleanFields=input=>{
  const output={};
  for(const field of WEEKLY_OVERRIDE_REBASE_FIELDS)if(own(input,field))output[field]=input[field];
  return output;
};

export function computeWeeklyOverrideRebase({
  record,
  newImportRevision,
  incomingData={},
  clearFields=[],
  previousCamp=null,
  updatedAt=null,
}={}){
  if(!record||typeof record!=='object')return Object.freeze({action:'none',record:null,carried_fields:[],superseded_fields:[],explicit_clear_fields:[],domain_invalidated_fields:[],camp_changed:false});
  const revision=String(newImportRevision||'').trim();
  if(!revision)throw new Error('weekly_override_rebase_revision_required');
  const originalFields=cleanFields(record.fields||{});
  const fields={...originalFields};
  const clear=new Set(Array.isArray(clearFields)?clearFields:[]);
  const superseded=[],explicitClears=[];

  for(const field of Object.keys(fields)){
    if(clear.has(field)){
      delete fields[field];
      explicitClears.push(field);
      continue;
    }
    if(own(incomingData,field)&&isObservedWriteValue(incomingData[field])){
      delete fields[field];
      superseded.push(field);
    }
  }

  const priorCamp=own(originalFields,'camp')&&isObservedWriteValue(originalFields.camp)?originalFields.camp:previousCamp;
  const incomingCamp=own(incomingData,'camp')&&isObservedWriteValue(incomingData.camp)?incomingData.camp:null;
  const campExplicitlyCleared=clear.has('camp');
  const campChanged=!campExplicitlyCleared&&isObservedWriteValue(priorCamp)&&isObservedWriteValue(incomingCamp)&&String(priorCamp)!==String(incomingCamp);
  const domainInvalidated=[];
  if(campChanged||campExplicitlyCleared){
    for(const field of WEEKLY_OVERRIDE_REBASE_BERRY_FIELDS){
      if(own(fields,field)){
        delete fields[field];
        domainInvalidated.push(field);
      }
    }
  }

  const carried=Object.keys(fields).sort();
  if(!carried.length){
    return Object.freeze({
      action:'delete',record:null,carried_fields:carried,
      superseded_fields:Object.freeze([...new Set(superseded)].sort()),
      explicit_clear_fields:Object.freeze([...new Set(explicitClears)].sort()),
      domain_invalidated_fields:Object.freeze([...new Set(domainInvalidated)].sort()),
      camp_changed:campChanged,
      previous_revision:String(record.based_on_import_revision||'')||null,
      new_revision:revision,
    });
  }

  const nextRecord={
    ...record,
    based_on_import_revision:revision,
    fields,
    updated_at:updatedAt||record.updated_at||null,
    carry_forward_from_revision:String(record.based_on_import_revision||'')||null,
  };
  return Object.freeze({
    action:'upsert',record:Object.freeze({...nextRecord,fields:Object.freeze({...fields})}),carried_fields:Object.freeze(carried),
    superseded_fields:Object.freeze([...new Set(superseded)].sort()),
    explicit_clear_fields:Object.freeze([...new Set(explicitClears)].sort()),
    domain_invalidated_fields:Object.freeze([...new Set(domainInvalidated)].sort()),
    camp_changed:campChanged,
    previous_revision:String(record.based_on_import_revision||'')||null,
    new_revision:revision,
  });
}
