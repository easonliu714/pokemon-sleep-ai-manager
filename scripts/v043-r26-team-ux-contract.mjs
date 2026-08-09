import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(__filename),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

const ui=read('assets/js/war-room-team-optimizer-ui.js');
const bootstrap=read('assets/js/war-room-team-optimizer-bootstrap.js');
const candidateBootstrap=read('assets/js/war-room-candidate-feature-bootstrap.js');
const candidateUi=read('assets/js/war-room-candidate-feature-ui.js');
const recipeLocal=read('assets/js/recipe-strategy-local.js');
const css=read('assets/css/editor.css');
const optimizer=read('assets/js/team-optimizer.js');
const local=read('assets/js/team-optimizer-local.js');

for(const required of [
  '自動組隊建議（本機 deterministic）','主要建議','隊長（呈現槽位）','重新計算隊伍','查看替代隊伍',
  '精準能量模型尚未啟用','Gemini 不參與成員挑選或數值排序','本機草稿',
  'weekly_ingredient_overlap','current_readiness_score','favorite_berry_match','specialty','reasons',
]) assert.equal(ui.includes(required),true,`Team Card UI token missing: ${required}`);

for(const forbidden of ['estimated_energy.toFixed','預估七日能量','總能量：','fetch(','persist(','snapshot(','run(']){
  assert.equal(ui.includes(forbidden),false,`Team Card UI must not fake energy or write data: ${forbidden}`);
}
assert.equal(ui.includes('buildLocalTeamOptimization'),true);
assert.equal(local.includes('player_data_write:false'),true);
assert.equal(local.includes('gemini_used:false'),true);
assert.equal(optimizer.includes('estimated_energy:null'),true);
assert.equal(optimizer.includes('PRESENTATION_SLOT_ONLY_NO_VERIFIED_BONUS'),true);

for(const required of ['isDatabaseReady','if(!isDatabaseReady())return','pokemon-sleep:database-ready','pokemon-sleep:strategy-goal-profile-changed','pokemon-sleep:data-changed']){
  assert.equal(bootstrap.includes(required),true,`Team bootstrap DB lifecycle token missing: ${required}`);
}
assert.equal(bootstrap.includes('renderWarRoomTeamOptimizer'),true);
assert.equal(bootstrap.includes("goal.insertAdjacentElement('afterend',root)"),true,'Team result must mount directly after Goal Profile');
assert.equal(candidateBootstrap.includes('warroomTeamOptimizer'),true,'candidate pool must place itself after Team Optimizer when present');
assert.equal(candidateBootstrap.includes("team.insertAdjacentElement('afterend',root)"),true);

const teamImportIndex=recipeLocal.indexOf("import('./war-room-team-optimizer-bootstrap.js')");
const candidateImportIndex=recipeLocal.indexOf("import('./war-room-candidate-feature-bootstrap.js')");
assert.ok(teamImportIndex>=0,'Team Optimizer runtime bootstrap missing');
assert.ok(candidateImportIndex>teamImportIndex,'Team Optimizer bootstrap must precede candidate detail bootstrap');

for(const required of ['候選／替補池','<details class="war-candidate-pool">','不是最終隊伍'])assert.equal(candidateUi.includes(required),true,`Candidate pool demotion missing: ${required}`);
assert.equal(candidateUi.includes('<details class="war-candidate-pool" open'),false,'candidate pool should remain collapsed by default');

for(const required of [
  '.war-team-optimizer-panel','.war-team-card','.war-team-member','.war-team-member.leader','.war-team-summary','.war-team-alternatives',
  'min-height:44px','@media(max-width:700px)',
]) assert.equal(css.includes(required),true,`Team Card mobile CSS missing: ${required}`);

// The engine must remain pure and provider-free; the UI is presentation-only and does not create formal team rows.
for(const source of [optimizer,local,ui,bootstrap]){
  assert.equal(source.includes('ai-project-pool-runtime'),false,'Team optimizer path imported provider runtime');
  assert.equal(source.includes('INSERT INTO teams'),false,'Team optimizer path directly wrote teams');
  assert.equal(source.includes('UPDATE teams'),false,'Team optimizer path directly wrote teams');
}

process.stdout.write(`${JSON.stringify({
  status:'PASS',gate:'R2.6_FIVE_MEMBER_WAR_ROOM_TEAM_CARD_UX',
  team_result_before_candidate_pool:true,leader_text_visible:true,member_text_visible:true,alternatives_collapsible:true,
  candidate_pool_collapsed:true,precise_energy_claim:false,leader_bonus_claim:false,direct_team_write:false,gemini_dependency:false,
  db_ready_lifecycle_guard:true,mobile_touch_target_contract:true,
},null,2)}\n`);
