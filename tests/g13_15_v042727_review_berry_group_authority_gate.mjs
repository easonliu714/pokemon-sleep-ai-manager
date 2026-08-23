import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const consistencySource=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
const workbenchSource=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');

assert.ok(consistencySource.includes('function resolveFavoriteBerryAuthority'),'multicapture must expose explicit favorite berry authority');
assert.ok(workbenchSource.includes('function resolveFavoriteBerryAuthority'),'confirmation fallback normalizer must use the same favorite berry authority');
assert.ok(consistencySource.includes('favorite_berry:resolveFavoriteBerryAuthority({raw,profile})'));
assert.ok(workbenchSource.includes('favorite_berry:resolveFavoriteBerryAuthority({raw,profile})'));
assert.equal(consistencySource.includes('favorite_berry:clean(raw?.favorite_berry??profile?.favorite_berry)'),false,'Observation v2 must not prefer legacy top-level berry');
assert.equal(workbenchSource.includes('favorite_berry:text(raw.favorite_berry??profile.favorite_berry)'),false,'confirmation fallback must not prefer legacy top-level berry');
assert.ok(workbenchSource.includes('if(!shouldAcceptMergedGroup(currentGroupId,detail.group_id))'),'merged review events must be exact-group gated');
assert.ok(workbenchSource.includes("trace('confirmation_merged_group_ignored'"),'rejected adjacent/missing group events must remain diagnosable');

const executable=consistencySource
  .replace(/^import .*$/gm,'')
  .replace(/^export \{.*$/gm,'')
  + '\nglobalThis.__gate={normalizeRevision,resolveFavoriteBerryAuthority};';
const context={
  console,
  setTimeout:()=>0,
  CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},
  rows:()=>[],
  resolveEvolutionAuthority:()=>({status:'PUBLIC_MASTER_NOT_YET_VERIFIED',requirements:{}}),
  hydrateEvolutionDraft:(draft,authority)=>({...draft,evolution_authority:authority}),
  evolutionAuthorityLabel:()=>'',
  resolveRevisionAnalysisTarget:revision=>revision?.identity_context||null,
  analysisTargetIdentityKey:context=>context?.target_id?`${context.mode||'new'}:${context.target_id}`:null,
};
context.globalThis=context;
context.addEventListener=()=>{};
context.dispatchEvent=()=>true;
vm.createContext(context);
vm.runInContext(executable,context);
const {normalizeRevision}=context.__gate;

function v2({id,species,berry,legacyBerry}){
  return normalizeRevision({
    analysis_type:'ai',analysis_id:id,source_image_ref:`${id}.png`,
    result:{analysis:{
      favorite_berry:legacyBerry,
      observations:[{profile:{species,favorite_berry:berry},identity:{},subskills:[],ingredients:[]}],
    }},
  });
}

const a=v2({id:'A',species:'信使鳥',berry:'椰木果',legacyBerry:'橙橙果'});
const b=v2({id:'B',species:'波加曼',berry:'橙橙果',legacyBerry:'桃桃果'});
const c=v2({id:'C',species:'小鍛匠',berry:'桃桃果',legacyBerry:'椰木果'});
assert.deepEqual([a.favorite_berry,b.favorite_berry,c.favorite_berry],['椰木果','橙橙果','桃桃果'],'A/B/C must retain their own Observation v2 berry even when each legacy top-level value is the next Pokemon berry');

const explicitMissing=v2({id:'MISSING',species:'小果然',berry:null,legacyBerry:'芒芒果'});
assert.equal(explicitMissing.favorite_berry,'','Observation v2 null berry must remain unobserved instead of backfilling legacy compatibility data');

const legacy=normalizeRevision({analysis_type:'ai',analysis_id:'LEGACY',result:{analysis:{pokemon_name:'小果然',favorite_berry:'芒芒果'}}});
assert.equal(legacy.favorite_berry,'芒芒果','legacy payload without observations must preserve top-level compatibility behavior');

const groupHelperMatch=workbenchSource.match(/function shouldAcceptMergedGroup\(currentId,incomingId\)\{[\s\S]*?\n\}/);
assert.ok(groupHelperMatch,'exact group acceptance helper must remain present');
const groupContext={};
vm.createContext(groupContext);
vm.runInContext("const text=v=>v==null?'':String(v).trim();\n"+groupHelperMatch[0]+'\nglobalThis.__accept=shouldAcceptMergedGroup;',groupContext);
const accept=groupContext.__accept;
assert.equal(accept('A','A'),true);
assert.equal(accept('A','B'),false,'next Pokemon merge must not mutate current Pokemon A');
assert.equal(accept('B','A'),false,'previous Pokemon merge must not mutate current Pokemon B');
assert.equal(accept('A',null),false,'missing incoming group id must fail closed');
assert.equal(accept(null,'A'),false,'no visible current group must fail closed');
assert.equal(accept(' C ','C'),true,'normalized exact identifiers remain accepted');

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.15_V042727_REVIEW_BERRY_GROUP_AUTHORITY',
  observation_v2_profile_berry_authority:true,
  v2_null_fail_closed:true,
  legacy_top_level_compatibility:true,
  exact_group_merge_authority:true,
  abc_distinct_berries:[a.favorite_berry,b.favorite_berry,c.favorite_berry],
},null,2));
