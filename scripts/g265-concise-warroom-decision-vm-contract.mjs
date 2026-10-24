import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// G265: execute the actual production renderer in an isolated VM. No player data or SQLite.
const raw=fs.readFileSync('assets/js/war-room-strategy-context-ui.js','utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const context={console,setTimeout(){},document:{getElementById(){return null;}},navigator:{clipboard:{writeText:async()=>{}}}};
context.globalThis=context;
vm.runInNewContext(source,context,{filename:'assets/js/war-room-strategy-context-ui.js',timeout:3000});
const target={innerHTML:''};
const intake={
  intake_status:'REVIEW_REQUIRED',adapter:'fixture',context_fingerprint_match:false,
  expected_context_fingerprint:'private-expected-fingerprint',received_context_fingerprint:'private-received-fingerprint',
  accepted_proposals:[{proposal_name:'料理優先',candidate_refs:['private-candidate-ref'],rationale:'private-detailed-rationale',
    expected_tradeoff:'食材供應不足',deterministic_re_evaluation_status:'HOLD',
    missing_data_dependencies:['ingredient_rate']}],
  rejected_proposals:[{proposal_name:'無效候選',candidate_refs:['private-rejected-ref'],reasons:['hard constraint mismatch']}]
};
context.renderIntakeResult(target,intake);
const html=target.innerHTML;
assert.match(html,/Context Fingerprint MISMATCH/);
assert.match(html,/接受 1/);
assert.match(html,/拒絕 1/);
assert.match(html,/食材供應不足/);
assert.match(html,/ingredient_rate/);
assert.match(html,/hard constraint mismatch/);
assert.match(html,/<details><summary>進階：Context Fingerprint 比對<\/summary>/);
assert.match(html,/<details><summary>查看候選 refs 與建議理由<\/summary>/);
assert.match(html,/<details><summary>查看拒絕候選 refs<\/summary>/);
assert.doesNotMatch(html,/<details[^>]*\sopen(?:\s|>|=)/);
assert.doesNotMatch(html.split('<details>')[0],/private-expected-fingerprint|private-candidate-ref|private-detailed-rationale/);
assert.doesNotMatch(html,/<button[^>]*>\s*Apply\s*<\/button>/i);
assert.match(html,/不可直接 Apply/);
const escaped={...intake,accepted_proposals:[{...intake.accepted_proposals[0],rationale:'<script>alert(1)</script>'}]};
context.renderIntakeResult(target,escaped);
assert.doesNotMatch(target.innerHTML,/<script>/);
assert.match(target.innerHTML,/&lt;script&gt;/);
console.log('PASS G265_SOURCE_BOUND_CONCISE_DECISION_DISCLOSURE_AND_NO_APPLY; OWNER_MOBILE_UAT_PENDING');
