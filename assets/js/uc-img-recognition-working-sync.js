// Keep UC.IMG-A's persisted Working JSON and all independent reviewing gates in sync.
// Provider Raw is intentionally NEVER touched by this helper.
export function syncRecognitionWorkingTextarea(textarea,workingJson){
  if(!textarea||typeof workingJson!=='string')return false;
  if(textarea.value===workingJson)return false;
  textarea.value=workingJson;
  // Ingredient Inventory Integrity Gate listens for the bubbled input event
  // and independently recompiles recognition before approving any absence.
  textarea.dispatchEvent?.(new Event('input',{bubbles:true}));
  return true;
}
