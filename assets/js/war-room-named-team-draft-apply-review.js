// G265 Named Draft future-Apply preflight: pure, read-only re-evaluation only.
// Not imported by the PWA. NEVER calls game Apply, SQLite, IndexedDB or network.
// A saved draft is a historical snapshot, not permission to reuse stale team slots.
import {classifyNamedTeamDraftEligibility,G265_NAMED_TEAM_DRAFT_CONTRACT_VERSION} from './war-room-named-team-draft-contract.js';

const hold=reason=>Object.freeze({status:'HOLD',reason,eligible:false,
  player_data_write:false,game_applied:false});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const utc=value=>typeof value==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)&&
  Number.isFinite(Date.parse(value));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const exactKeys=(object,keys)=>object&&typeof object==='object'&&!Array.isArray(object)&&
  Object.keys(object).length===keys.length&&keys.every(key=>own(object,key));

export function classifyNamedDraftFutureApplyReview({
  record=null,projection=null,team=null,activeGoalProfileId=null,
  goalDraftState='clean',explicitReviewAcknowledged=false,
  reviewedTeamName=null,reviewedDraftId=null
}={}){
  if(!exactKeys(record,['schema','draft_id','payload','saved_at','game_applied','local_only'])||
    record.schema!=='pokemon-sleep-named-team-draft-local-record/1.0'||
    !/^draft_[A-Za-z0-9_-]{16,80}$/.test(record.draft_id||'')||
    record.game_applied!==false||record.local_only!==true||
    !utc(record.saved_at))return hold('UNVERIFIED_LOCAL_DRAFT_RECORD');
  const p=record.payload;
  if(!p||p.schema!=='pokemon-sleep-named-team-draft/1.0'||
    p.contract_version!==G265_NAMED_TEAM_DRAFT_CONTRACT_VERSION||
    p.local_only!==true||p.game_applied!==false||p.player_data_write!==false||
    p.requires_re_evaluation_before_future_apply!==true||
    p.requires_explicit_local_save!==true||p.persistence_status!=='NOT_WRITTEN'||
    p.re_evaluation_status!=='CURRENT_AT_CAPTURE_ONLY'||!utc(p.captured_at))
    return hold('UNVERIFIED_CAPTURE_PROVENANCE');
  if(!activeGoalProfileId||activeGoalProfileId!==p.goal_profile_id||
    projection?.goal_profile_id!==p.goal_profile_id)
    return hold('ACTIVE_GOAL_PROFILE_CHANGED');
  if(goalDraftState!=='clean')return hold('UNSAVED_CURRENT_GOAL');
  // Re-run the exact current optimizer eligibility contract. A detached or
  // stale candidate object is never equivalent to current projection ownership.
  const current=classifyNamedTeamDraftEligibility({
    name:p.team_name,projection,team,goalDraftState,capturedAt:p.captured_at
  });
  if(!current.eligible)return hold('CURRENT_RE_EVALUATION_'+current.reason);
  // Compare the entire captured authority, including member order, instance IDs,
  // goal/optimizer fingerprints and satisfied constraints. Never merge old slots.
  if(!same(current.payload,p))return hold('CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
  // The review must bind independently supplied visible name and draft identity;
  // stored text alone cannot authenticate itself after tampering.
  if(explicitReviewAcknowledged!==true)return hold('EXPLICIT_FUTURE_APPLY_REVIEW_REQUIRED');
  if(reviewedTeamName!==p.team_name||reviewedDraftId!==record.draft_id)
    return hold('EXPLICIT_REVIEW_IDENTITY_MISMATCH');
  return Object.freeze({status:'READY_FOR_EXTERNAL_GAME_SIDE_REVIEW_ONLY',
    eligible:true,reason:null,draft_id:record.draft_id,
    requires_game_side_manual_action:true,player_data_write:false,game_applied:false});
}
