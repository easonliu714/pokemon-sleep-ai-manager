export const DATA_PRESERVATION_POLICY_VERSION='data-preservation-policy-2026-08-11-a';

export function isObservedWriteValue(value){
  if(value===null||value===undefined)return false;
  if(typeof value==='string'&&value.trim()==='')return false;
  return true;
}

export function buildSparseObservedPatch(source={},clearFields=[]){
  const clear=new Set(Array.isArray(clearFields)?clearFields:[]);
  const result={};
  for(const [field,value] of Object.entries(source||{})){
    if(isObservedWriteValue(value))result[field]=value;
    else if(clear.has(field))result[field]=null;
  }
  for(const field of clear){
    if(!Object.prototype.hasOwnProperty.call(source||{},field))result[field]=null;
  }
  return result;
}

export function classifyObservedFieldWrite({existing,incoming,hasIncoming=true,explicitClear=false}={}){
  if(explicitClear&&!isObservedWriteValue(incoming))return Object.freeze({decision:'explicit_clear',effective:null});
  if(!hasIncoming||!isObservedWriteValue(incoming)){
    const hadExisting=isObservedWriteValue(existing);
    return Object.freeze({decision:hadExisting?'preserve_existing_empty_incoming':'ignore_empty_incoming',effective:existing});
  }
  if(Object.is(existing,incoming)||(typeof existing==='number'&&typeof incoming==='boolean'&&existing===Number(incoming))){
    return Object.freeze({decision:'same_value',effective:existing});
  }
  return Object.freeze({decision:isObservedWriteValue(existing)?'update_non_empty':'insert_non_empty',effective:incoming});
}
