import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
const version=fs.readFileSync('assets/js/version-authority.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const currentVersion=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
const platformIdentitySuccessor=currentVersion==='v0.4.27.15';

assert.match(version,/app_version:\s*'v0\.4\.27\.9'/);
assert.match(version,/20260818-v04279-confirmation-multicapture-authority-hotfix/);
assert.ok(source.includes("if(value===null||value===undefined||value==='')return null;"));
assert.ok(source.includes('profile?.main_skill_level??raw?.main_skill?.level'));
assert.ok(source.includes('profile?.header_name_text??profile?.species'));
assert.ok(source.includes('resolveEvolutionAuthority(draft.species,rows)'));
assert.ok(source.includes('hydrateEvolutionDraft'));
assert.ok(source.includes('resolveEvolutionDraftAuthority'));
assert.ok(source.includes('legacy_partial_writer_disabled:true'));
assert.ok(source.includes('registered_at:clean(identity?.registered_date)'),'successor multicapture must retain registered_date in registered_at');
assert.ok(source.includes('obtained_at:clean(raw?.obtained_at)'),'legacy obtained_at must remain a separate field');
assert.equal(source.includes('identity?.registered_date??raw?.obtained_at'),false,'successor multicapture must not collapse registered and legacy obtained dates');
assert.equal(source.includes("document.addEventListener('click',safeApply,true)"),false);
assert.ok(source.includes('pokemon-sleep:analysis-confirmation-group-selected'),'v0.4.27.13 successor must make capture groups navigable');
assert.ok(source.includes('confirmation_group_advanced'),'v0.4.27.13 successor must trace group advance');
if(platformIdentitySuccessor){
  assert.ok(source.includes('resolveRevisionAnalysisTarget'),'v0.4.27.15 must resolve platform-owned analysis target identity');
  assert.ok(source.includes('analysisTargetIdentityKey'),'v0.4.27.15 must group by platform target key before text fallback');
  assert.ok(source.includes('REVIEW_REQUIRED_CROSS_IMAGE_CONFLICT'),'v0.4.27.15 cross-image conflicts must fail closed');
}
assert.ok(sw.includes("'./assets/js/data-consistency-multicapture.js'"));
assert.ok(sw.includes("'./assets/js/analysis-confirmation-evolution-authority.js'"));

const executable=source
  .replace(/^import .*$/gm,'')
  .replace(/^export \{.*$/gm,'')
  + '\nglobalThis.__gate={normalizeRevision,mergeDraft};';
const context={
  console,
  setTimeout:()=>0,
  CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},
  rows:()=>[],
  resolveEvolutionAuthority:()=>({status:'PUBLIC_MASTER_NOT_YET_VERIFIED',requirements:{}}),
  hydrateEvolutionDraft:(draft,authority)=>({...draft,evolution_authority:authority}),
  evolutionAuthorityLabel:()=>'',
  resolveRevisionAnalysisTarget:()=>null,
  analysisTargetIdentityKey:()=>null,
};
context.globalThis=context;
context.addEventListener=()=>{};
context.dispatchEvent=()=>true;
vm.createContext(context);
vm.runInContext(executable,context);
const {normalizeRevision,mergeDraft}=context.__gate;

const first=normalizeRevision({
  analysis_type:'ai',analysis_id:'a',source_image_ref:'a.png',
  result:{analysis:{
    pokemon_name:null,
    main_skill:{name:null,level:null},
    observations:[{profile:{header_name_text:'小鍛匠',level:14,sp:467,main_skill:null,main_skill_level:null},identity:{registered_date:null},subskills:[],ingredients:[]}]
  }}
});
if(platformIdentitySuccessor)assert.equal(first.species,'','v0.4.27.15 must not promote editable header text into unbound identity');
else assert.equal(first.species,'小鍛匠');
assert.equal(first.main_skill_level,null,'missing main skill level must remain null, never coerce to 0');

const second=normalizeRevision({
  analysis_type:'ai',analysis_id:'b',source_image_ref:'b.png',
  result:{analysis:{
    pokemon_name:null,
    main_skill:{name:'能量填充M',level:1},
    observations:[{profile:{header_name_text:null,level:14,sp:467,main_skill:'能量填充M',main_skill_level:1},identity:{registered_date:'2026-08-18'},subskills:[],ingredients:[]}]
  }}
});
assert.equal(second.main_skill_level,1);
assert.equal(second.registered_at,'2026-08-18');
assert.equal(second.obtained_at,'','direct registered date must not be duplicated into legacy obtained_at');

const merged=mergeDraft({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[]},first);
const merged2=mergeDraft(merged,second);
assert.equal(merged2.species,platformIdentitySuccessor?'':'小鍛匠');
assert.equal(merged2.main_skill,'能量填充M');
assert.equal(merged2.main_skill_level,1,'later observed level 1 must fill prior missing value');
assert.equal(merged2.registered_at,'2026-08-18');
assert.equal(merged2.obtained_at??'','', 'blank legacy obtained_at is intentionally omitted by sparse merge');
assert.equal(merged2.conflicts.some(row=>row.field==='main_skill_level'),false);
assert.deepEqual([...merged2.source_refs],['a.png','b.png']);

const explicitZero=mergeDraft({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[],main_skill_level:null},{...second,main_skill_level:0});
assert.equal(explicitZero.main_skill_level,0,'explicit numeric zero remains a valid observation');

console.log(JSON.stringify({status:'PASS',gate:'G13.9_V04279_MULTICAPTURE_CONFIRMATION_AUTHORITY',current_version:currentVersion,platform_identity_successor:platformIdentitySuccessor,species:merged2.species,main_skill_level:merged2.main_skill_level,registered_at:merged2.registered_at,obtained_at:merged2.obtained_at??null,registered_date_successor_split:true,legacy_partial_writer_disabled:true,evolution_rehydration:true,navigable_capture_group_successor:true},null,2));
