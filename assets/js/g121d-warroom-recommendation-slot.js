export const G121D_WARROOM_RECOMMENDATION_SLOT_ID='g121dWarroomRecommendationSlot';

export function ensureG121DWarroomRecommendationSlot(panel,doc=globalThis.document){
  if(!panel||!doc)return null;
  let slot=doc.getElementById?.(G121D_WARROOM_RECOMMENDATION_SLOT_ID)||null;
  if(slot&&slot.parentElement===panel)return slot;
  slot=doc.createElement('div');
  slot.id=G121D_WARROOM_RECOMMENDATION_SLOT_ID;
  slot.dataset.g121dOwner='evolution-recommendation';
  slot.className='g121d-warroom-recommendation-slot';
  panel.appendChild(slot);
  return slot;
}
