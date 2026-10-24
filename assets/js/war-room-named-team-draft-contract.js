// G265 bounded pre-persistence authority. No SQLite, IndexedDB, network or game-side action.
export const G265_NAMED_TEAM_DRAFT_CONTRACT_VERSION='pokemon-sleep-named-team-draft-contract/1.0';
const normalize=value=>String(value??'').normalize('NFKC').trim();
const hold=(reason)=>Object.freeze({eligible:false,status:'HOLD',reason,player_data_write:false,game_applied:false});
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const array=value=>Array.isArray(value)?value:[];

export function classifyNamedTeamDraftEligibility({name='',projection=null,team=null,goalDraftState='clean',capturedAt=null}={}){
  const normalizedName=normalize(name);
  if(!normalizedName||[...normalizedName].length>40||/[\u0000-\u001f\u007f]/u.test(normalizedName))return hold('INVALID_TEAM_NAME');
  if(goalDraftState!=='clean')return hold('GOAL_PROFILE_UNSAVED_OR_INVALID');
  if(projection?.projection_status!=='READY')return hold('PROJECTION_NOT_READY');
  if(!nonempty(projection?.goal_profile_id)||!nonempty(projection?.input_fingerprint))return hold('GOAL_OR_PROJECTION_FINGERPRINT_MISSING');
  if(!team||team.team_status!=='READY')return hold('TEAM_NOT_READY');
  const choices=[projection.primary,...array(projection.alternatives)].filter(Boolean);
  const selected=choices.find(candidate=>candidate===team);
  if(!selected)return hold('TEAM_NOT_FROM_CURRENT_PROJECTION');
  if(!nonempty(team.team_id)||!nonempty(team.input_fingerprint)||!nonempty(team.optimizer_version))return hold('TEAM_PROVENANCE_MISSING');
  if(array(team.missing_constraints).length)return hold('HARD_CONSTRAINT_UNSATISFIED');
  if(!Number.isInteger(projection.mandatory_member_count)||!Number.isInteger(projection.mandatory_satisfied_count)||projection.mandatory_member_count!==projection.mandatory_satisfied_count)return hold('MANDATORY_MEMBER_UNVERIFIED');
  const slots=array(team.slots);
  if(slots.length!==5)return hold('TEAM_SIZE_NOT_FIVE');
  const ids=slots.map(slot=>normalize(slot?.pokemon_id));
  if(ids.some(id=>!id)||new Set(ids).size!==5)return hold('MEMBER_ID_MISSING_OR_DUPLICATE');
  if(slots.some((slot,index)=>slot?.slot_index!==index||slot?.is_leader!==(index===0)))return hold('SLOT_ORDER_OR_LEADER_MISMATCH');
  if(slots.some(slot=>slot?.hard_constraint_status!=='PASS'))return hold('MEMBER_HARD_CONSTRAINT_NOT_PASS');
  const at=capturedAt===null?new Date().toISOString():String(capturedAt);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(at)||!Number.isFinite(Date.parse(at)))return hold('INVALID_CAPTURE_TIMESTAMP');
  const payload=Object.freeze({
    schema:'pokemon-sleep-named-team-draft/1.0',
    contract_version:G265_NAMED_TEAM_DRAFT_CONTRACT_VERSION,
    team_name:normalizedName,
    source:'LOCAL_DETERMINISTIC_OPTIMIZER',
    goal_profile_id:projection.goal_profile_id,
    optimizer_result_fingerprint:projection.input_fingerprint,
    team_id:team.team_id,
    team_input_fingerprint:team.input_fingerprint,
    optimizer_version:team.optimizer_version,
    members:Object.freeze(slots.map(slot=>Object.freeze({
      slot_index:slot.slot_index,
      is_leader:slot.is_leader,
      pokemon_id:normalize(slot.pokemon_id),
      pokemon_instance_id:normalize(slot.pokemon_instance_id)||null,
    }))),
    satisfied_constraints:Object.freeze([...array(team.satisfied_constraints)].map(normalize)),
    re_evaluation_status:'CURRENT_AT_CAPTURE_ONLY',
    requires_re_evaluation_before_future_apply:true,
    requires_explicit_local_save:true,
    persistence_status:'NOT_WRITTEN',
    local_only:true,
    game_applied:false,
    player_data_write:false,
    captured_at:at,
  });
  return Object.freeze({eligible:true,status:'READY_FOR_EXPLICIT_LOCAL_SAVE',reason:null,payload,player_data_write:false,game_applied:false});
}
