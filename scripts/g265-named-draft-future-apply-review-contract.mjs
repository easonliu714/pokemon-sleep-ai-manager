// G265 B-lane: exact pure future-Apply review with synthetic data only.
// No production wiring, no saved player data and no game-side Apply.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyNamedTeamDraftEligibility} from '../assets/js/war-room-named-team-draft-contract.js';
import {classifyNamedDraftFutureApplyReview as check} from '../assets/js/war-room-named-team-draft-apply-review.js';

const src=readFileSync('assets/js/war-room-named-team-draft-apply-review.js','utf8');
assert.doesNotMatch(src,/\b(?:indexedDB|localStorage|sessionStorage|fetch\s*\(|persist\s*\(|begin\s*\(|commit\s*\(|run\s*\(|snapshot\s*\()/);
const store=readFileSync('assets/js/war-room-named-team-draft-store.js','utf8');
assert.match(store,/export async function saveNamedTeamDraftLocal\(/);
assert.match(store,/requires_re_evaluation_before_future_apply|classifyNamedTeamDraftEligibility/);
assert.doesNotMatch(store,/war-room-named-team-draft-apply-review/);
const slots=Array.from({length:5},(_,i)=>({
  slot_index:i,is_leader:i===0,pokemon_id:'synthetic-'+i,
  pokemon_instance_id:'synthetic-instance-'+i,hard_constraint_status:'PASS'
}));
const team={team_status:'READY',team_id:'synthetic-team',
  input_fingerprint:'synthetic-team-fingerprint',optimizer_version:'synthetic-optimizer',
  slots,missing_constraints:[],satisfied_constraints:['synthetic-hard-constraint']};
const projection={projection_status:'READY',goal_profile_id:'synthetic-goal',
  input_fingerprint:'synthetic-projection-fingerprint',primary:team,alternatives:[],
  mandatory_member_count:1,mandatory_satisfied_count:1};
const capturedAt='2026-11-02T01:00:00.000Z';
const eligible=classifyNamedTeamDraftEligibility({
  name:'安全隊伍',projection,team,goalDraftState:'clean',capturedAt
});
assert.equal(eligible.eligible,true);
const record={schema:'pokemon-sleep-named-team-draft-local-record/1.0',
  draft_id:'draft_synthetic1234567890',payload:eligible.payload,
  saved_at:'2026-11-02T01:01:00.000Z',game_applied:false,local_only:true};
const input={record,projection,team,activeGoalProfileId:'synthetic-goal',
  reviewedTeamName:'安全隊伍',reviewedDraftId:'draft_synthetic1234567890'};
const noConsent=check(input);
assert.equal(noConsent.status,'HOLD');
assert.equal(noConsent.reason,'EXPLICIT_FUTURE_APPLY_REVIEW_REQUIRED');
const ready=check({...input,explicitReviewAcknowledged:true});
assert.equal(ready.status,'READY_FOR_EXTERNAL_GAME_SIDE_REVIEW_ONLY');
assert.equal(ready.requires_game_side_manual_action,true);
assert.equal(ready.game_applied,false);
assert.equal(ready.player_data_write,false);
const rejects=(overrides,reason)=>{
  const result=check({...input,explicitReviewAcknowledged:true,...overrides});
  assert.equal(result.status,'HOLD',reason);
  assert.equal(result.reason,reason);
  assert.equal(result.game_applied,false);
  assert.equal(result.player_data_write,false);
};
rejects({record:null},'UNVERIFIED_LOCAL_DRAFT_RECORD');
rejects({record:{...record,game_applied:true}},'UNVERIFIED_LOCAL_DRAFT_RECORD');
rejects({record:{...record,extra:'injected'}},'UNVERIFIED_LOCAL_DRAFT_RECORD');
rejects({record:{...record,saved_at:'invalid'}},'UNVERIFIED_LOCAL_DRAFT_RECORD');
rejects({reviewedTeamName:'unreviewed'},'EXPLICIT_REVIEW_IDENTITY_MISMATCH');
rejects({reviewedDraftId:'draft_other123456789012'},'EXPLICIT_REVIEW_IDENTITY_MISMATCH');
rejects({record:{...record,payload:{...record.payload,game_applied:true}}},'UNVERIFIED_CAPTURE_PROVENANCE');
rejects({record:{...record,payload:{...record.payload,persistence_status:'PERSISTED'}}},'UNVERIFIED_CAPTURE_PROVENANCE');
rejects({record:{...record,payload:{...record.payload,requires_re_evaluation_before_future_apply:false}}},'UNVERIFIED_CAPTURE_PROVENANCE');
rejects({activeGoalProfileId:'different'},'ACTIVE_GOAL_PROFILE_CHANGED');
rejects({goalDraftState:'dirty'},'UNSAVED_CURRENT_GOAL');
rejects({team:{...team}},'CURRENT_RE_EVALUATION_TEAM_NOT_FROM_CURRENT_PROJECTION');
const newTeam={...team,slots:slots.map((s,i)=>i===4?{...s,pokemon_instance_id:'changed-instance'}:s)};
rejects({projection:{...projection,primary:newTeam},team:newTeam},
  'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
const newProjection={...projection,input_fingerprint:'new-projection'};
rejects({projection:newProjection},'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
rejects({record:{...record,payload:{...record.payload,team_name:'tampered'}}},
  'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
rejects({record:{...record,payload:{...record.payload,extra:'untrusted'}}},
  'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
rejects({record:{...record,payload:{...record.payload,members:record.payload.members.slice(0,4)}}},
  'CAPTURE_NO_LONGER_MATCHES_CURRENT_PROJECTION');
console.log('PASS G265_NAMED_DRAFT_FUTURE_APPLY_REEVALUATION_SOURCE_BOUND_POSITIVE_2_NEGATIVE_17');
console.log('HOLD G265_NAMED_DRAFT_GAME_SIDE_APPLY_NOT_IMPLEMENTED_23_LEGACY_GLOBAL_ADMISSION_ANDROID');
