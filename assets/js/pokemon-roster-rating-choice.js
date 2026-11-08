// G14.RATE read-only selection/review authority. No SQLite/IDB or persistence.
// A reviewed intent is NOT a durable Apply authorization or a player rating write.
import {POKEMON_PROVISIONAL_RATING_LABELS as GRADES} from './pokemon-provisional-rating.js';

const validId=value=>typeof value==='string'&&value.length>0&&value===value.trim();
const validGrade=value=>GRADES.includes(value);
const hold=reason=>Object.freeze({
  status:'HOLD_READ_ONLY_REVIEW',reason_codes:Object.freeze([reason]),
  selected_count:0,reviewed_diffs:Object.freeze([]),player_data_write:false,
  production_apply:false,overwrite_allowed:false,
});
const eligible=row=>row?.status==='PROVISIONAL_HEURISTIC'&&row.changed===true
  &&validId(row.pokemon_id)&&validId(row.pokemon_instance_id)
  &&validGrade(row.previous_rating)&&validGrade(row.proposed_rating)
  &&Array.isArray(row.missing_inputs)&&row.missing_inputs.length===0;
const validate=view=>{
  if(view?.status!=='PREVIEW_ONLY'||view.player_data_write!==false
    ||view.overwrite_allowed!==false||!Array.isArray(view.rows)
    ||typeof view.source_token!=='string'||!view.source_token
    ||typeof view.plan?.rule_version!=='string')return false;
  const ids=new Set(),instances=new Set();
  for(const row of view.rows){
    if(!validId(row?.pokemon_id)||!validId(row?.pokemon_instance_id)
      ||ids.has(row.pokemon_id)||instances.has(row.pokemon_instance_id))return false;
    ids.add(row.pokemon_id);instances.add(row.pokemon_instance_id);
  }
  return true;
};
export function eligiblePokemonRosterRatingChoiceIds(view){
  if(!validate(view))return Object.freeze([]);
  return Object.freeze(view.rows.filter(eligible).map(row=>row.pokemon_id));
}
export function selectPokemonRosterRatingRows(view,{gradeFilter='',gradeTarget='new',
  sortBy='pokemon',descending=false}={}){
  if(!validate(view))return Object.freeze([]);
  if(gradeFilter&&!validGrade(gradeFilter))return Object.freeze([]);
  const order=new Map(GRADES.map((grade,index)=>[grade,index]));
  const rows=view.rows.filter(row=>!gradeFilter
    ||(gradeTarget==='old'?row.previous_rating:row.proposed_rating)===gradeFilter);
  const score=row=>sortBy==='old'?order.get(row.previous_rating)??99
    :sortBy==='new'?order.get(row.proposed_rating)??99
    :sortBy==='status'?(eligible(row)?0:1):0;
  rows.sort((a,b)=>{
    const n=score(a)-score(b);
    const result=n||String(a.species||'').localeCompare(String(b.species||''),'zh-Hant')
      ||String(a.pokemon_id).localeCompare(String(b.pokemon_id));
    return descending?-result:result;
  });
  return Object.freeze(rows);
}
/** Fresh re-read must match all original facts, even when the displayed grade did not change. */
export function reviewPokemonRosterRatingChoiceIntent({
  preview,freshView,selectedPokemonIds,explicitReview=false
}={}){
  if(!validate(preview)||!validate(freshView))return hold('PREVIEW_SOURCE_UNVERIFIED');
  if(preview.plan.rule_version!==freshView.plan.rule_version)
    return hold('RULE_VERSION_STALE');
  if(preview.source_token!==freshView.source_token
    ||JSON.stringify(preview.rows)!==JSON.stringify(freshView.rows))
    return hold('FULL_SOURCE_STALE_RECALCULATE');
  if(!Array.isArray(selectedPokemonIds)||!selectedPokemonIds.length
    ||selectedPokemonIds.some(id=>!validId(id))
    ||new Set(selectedPokemonIds).size!==selectedPokemonIds.length)
    return hold('SELECTION_MISSING_OR_DUPLICATE');
  if(explicitReview!==true)return hold('EXPLICIT_REVIEW_REQUIRED');
  const eligibleIds=new Set(eligiblePokemonRosterRatingChoiceIds(preview));
  if(selectedPokemonIds.some(id=>!eligibleIds.has(id)))
    return hold('SELECTED_RECORD_HOLD_OR_UNKNOWN');
  const byId=new Map(preview.rows.map(row=>[row.pokemon_id,row]));
  const reviewed=selectedPokemonIds.map(id=>{
    const row=byId.get(id);
    return Object.freeze({pokemon_id:id,pokemon_instance_id:row.pokemon_instance_id,
      previous_rating:row.previous_rating,proposed_rating:row.proposed_rating,
      rule_version:preview.plan.rule_version});
  });
  return Object.freeze({
    schema:'pokemon-rating-read-only-intent/1.0',
    status:'REVIEWED_NONPERSISTENT_INTENT',reason_codes:Object.freeze([]),
    selected_count:reviewed.length,reviewed_diffs:Object.freeze(reviewed),
    player_data_write:false,production_apply:false,overwrite_allowed:false,
    next_gate:'EXPLICIT_DURABLE_APPLY_SEPARATE_ADMISSION',
  });
}
