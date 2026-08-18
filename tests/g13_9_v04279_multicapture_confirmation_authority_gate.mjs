import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
const version=fs.readFileSync('assets/js/version-authority.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');

assert.match(version,/app_version:\s*'v0\.4\.27\.9'/);
assert.match(version,/20260818-v04279-confirmation-multicapture-authority-hotfix/);
assert.ok(source.includes("if(value===null||value===undefined||value==='')return null;"));
assert.ok(source.includes('profile?.main_skill_level??raw?.main_skill?.level'));
assert.ok(source.includes('profile?.header_name_text??profile?.species'));
assert.ok(source.includes('applyEvolutionAuthority(root,draft)'));
assert.ok(source.includes('resolveEvolutionAuthority(draft.species,rows)'));
assert.ok(source.includes('legacy_partial_writer_disabled:true'));
assert.equal(source.includes("document.addEventListener('click',safeApply,true)"),false);
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
};
context.globalThis=context;
context.addEventListener=()=>{};
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
assert.equal(first.species,'小鍛匠');
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
assert.equal(second.obtained_at,'2026-08-18');

const merged=mergeDraft({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[]},first);
const merged2=mergeDraft(merged,second);
assert.equal(merged2.species,'小鍛匠');
assert.equal(merged2.main_skill,'能量填充M');
assert.equal(merged2.main_skill_level,1,'later observed level 1 must fill prior missing value');
assert.equal(merged2.obtained_at,'2026-08-18');
assert.equal(merged2.conflicts.some(row=>row.field==='main_skill_level'),false);
assert.deepEqual([...merged2.source_refs],['a.png','b.png']);

const explicitZero=mergeDraft({source_refs:[],analysis_ids:[],subskills:[],ingredients:[],conflicts:[],main_skill_level:null},{...second,main_skill_level:0});
assert.equal(explicitZero.main_skill_level,0,'explicit numeric zero remains a valid observation');

console.log(JSON.stringify({status:'PASS',gate:'G13.9_V04279_MULTICAPTURE_CONFIRMATION_AUTHORITY',species:merged2.species,main_skill_level:merged2.main_skill_level,obtained_at:merged2.obtained_at,legacy_partial_writer_disabled:true,evolution_rehydration:true},null,2));
