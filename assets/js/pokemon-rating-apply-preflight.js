// RATE.4 isolated pre-apply review. No SQLite, IDB, snapshot or production Writer.
// Even a successful explicit-consent review remains HOLD until an independently
// verified durable snapshot and G265 cross-tab Writer admission exist.
import {POKEMON_PROVISIONAL_RATING_LABELS,POKEMON_PROVISIONAL_RATING_RULE_VERSION} from './pokemon-provisional-rating.js';

const validId=value=>typeof value==='string'&&value.length>0&&value===value.trim();
const validRating=value=>value===null||POKEMON_PROVISIONAL_RATING_LABELS.includes(value);
const stable=value=>JSON.stringify(value);
const hold=(code)=>Object.freeze({
  schema:'pokemon-rating-apply-preflight/1.0',status:'HOLD',reason_codes:[code],
  reviewed_diffs:[],player_data_write:false,overwrite_allowed:false,
  next_gate:'DURABLE_SNAPSHOT_G265_WRITER_ATOMIC_READBACK_ROLLBACK',
});

/**
 * Review a user-selected RATE.3 comparison against a fresh independent
 * projection. This does NOT establish durable freshness: the eventual writer
 * must repeat CAS, identity, old-value and rule checks under its Web Lock.
 * Confirmation is an input to validate, never a grant of write authority.
 */
export function reviewPokemonRatingApplyIntent({preview,freshView,selectedPokemonIds,confirmation}={}){
  if(preview?.status!=='PREVIEW_ONLY'||freshView?.status!=='PREVIEW_ONLY'
    ||!Array.isArray(preview?.rows)||!Array.isArray(freshView?.rows)
    ||!preview.plan||!freshView.plan
    ||preview.player_data_write!==false||freshView.player_data_write!==false
    ||preview.overwrite_allowed!==false||freshView.overwrite_allowed!==false)
    return hold('PREVIEW_SOURCE_UNVERIFIED');
  const rule=preview.plan.rule_version;
  if(rule!==POKEMON_PROVISIONAL_RATING_RULE_VERSION||freshView.plan.rule_version!==rule)
    return hold('RULE_VERSION_STALE');
  if(!Array.isArray(selectedPokemonIds)||selectedPokemonIds.length===0
    ||selectedPokemonIds.some(id=>!validId(id))
    ||new Set(selectedPokemonIds).size!==selectedPokemonIds.length)
    return hold('SELECTION_MISSING_OR_DUPLICATE');
  if(confirmation?.explicit_user_action!==true
    ||confirmation?.intent!=='APPLY_SELECTED_RATINGS'
    ||confirmation?.rule_version!==rule
    ||confirmation?.acknowledged_diff_count!==selectedPokemonIds.length
    ||!Array.isArray(confirmation.selectedPokemonIds)
    ||stable(confirmation.selectedPokemonIds)!==stable(selectedPokemonIds))
    return hold('EXPLICIT_CONSENT_MISSING_OR_MISMATCH');
  const index=rows=>{
    const result=new Map();
    for(const row of rows){
      if(!validId(row?.pokemon_id)||result.has(row.pokemon_id))return null;
      result.set(row.pokemon_id,row);
    }
    return result;
  };
  const before=index(preview.rows),latest=index(freshView.rows);
  if(!before||!latest||before.size!==latest.size
    ||[...before.keys()].some(id=>!latest.has(id)))
    return hold('ROSTER_IDENTITY_SET_STALE_OR_DUPLICATE');
  const reviewed=[];
  for(const pokemonId of selectedPokemonIds){
    const old=before.get(pokemonId),now=latest.get(pokemonId);
    if(!old||!now||old.status!=='PROVISIONAL_HEURISTIC'
      ||now.status!=='PROVISIONAL_HEURISTIC'
      ||old.changed!==true||now.changed!==true
      ||!validId(old.pokemon_instance_id)||!validId(now.pokemon_instance_id)
      ||old.rule_version!==rule||now.rule_version!==rule
      ||!validRating(old.previous_rating)||!validRating(now.previous_rating)
      ||!POKEMON_PROVISIONAL_RATING_LABELS.includes(old.proposed_rating)
      ||!POKEMON_PROVISIONAL_RATING_LABELS.includes(now.proposed_rating)
      ||(old.missing_inputs||[]).length||(now.missing_inputs||[]).length)
      return hold('SELECTED_RECORD_NOT_ELIGIBLE');
    // Compare all scored evidence, not just the displayed letter. A changed
    // level or subskill can retain the same grade but invalidate consent.
    const fields=['pokemon_instance_id','previous_rating','proposed_rating','rule_version',
      'species','nickname','level','current_evidence','future_evidence',
      'score_breakdown','reason_codes','missing_inputs'];
    if(fields.some(field=>stable(old[field])!==stable(now[field])))
      return hold('SELECTED_RECORD_STALE');
    reviewed.push(Object.freeze({
      pokemon_id:pokemonId,pokemon_instance_id:old.pokemon_instance_id,
      previous_rating:old.previous_rating,proposed_rating:old.proposed_rating,
      rule_version:rule,
    }));
  }
  return Object.freeze({
    schema:'pokemon-rating-apply-preflight/1.0',
    status:'HOLD_DURABLE_SNAPSHOT_AND_WRITER_ADMISSION',
    reason_codes:['DURABLE_SNAPSHOT_NOT_VERIFIED','CROSS_TAB_WRITER_NOT_ADMITTED',
      'ATOMIC_RELOAD_READBACK_NOT_VERIFIED'],
    reviewed_diffs:Object.freeze(reviewed),player_data_write:false,
    overwrite_allowed:false,next_gate:'DURABLE_SNAPSHOT_G265_WRITER_ATOMIC_READBACK_ROLLBACK',
  });
}
