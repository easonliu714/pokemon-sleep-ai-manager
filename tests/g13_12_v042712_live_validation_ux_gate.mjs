import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const version=fs.readFileSync('assets/js/version-authority.js','utf8');
const diagnostic=fs.readFileSync('assets/js/data1d1-ocr-ai-ab-diagnostic.js','utf8');
const app=fs.readFileSync('assets/js/app.js','utf8');
const confirmation=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
const multicapture=fs.readFileSync('assets/js/data-consistency-multicapture.js','utf8');
const detail=fs.readFileSync('assets/js/pokemon-detail.js','utf8');

assert.match(version,/app_version:\s*'v0\.4\.27\.12'/);
assert.match(version,/20260818-v042712-live-validation-model-confirmation-ux/);

// Model fallback is observable in the same functional status area as elapsed seconds.
assert.ok(diagnostic.includes("event==='ai_model_candidate_started'"));
assert.ok(diagnostic.includes("event==='ai_model_failover'"));
assert.ok(diagnostic.includes('模型切換 ${detail.from_model'));
assert.ok(diagnostic.includes('elapsedSeconds()'));
assert.ok(diagnostic.includes('setInterval(renderLiveStatus,1000)'));
assert.ok(diagnostic.includes('完成；使用模型 ${result.model'));

// Direct analysis confirmation must refresh the in-memory roster immediately.
assert.ok(app.includes("pokemon-sleep:analysis-confirmed-applied"));
assert.ok(app.includes("refresh().catch"));
assert.ok(app.includes("pokemon.original_label || pokemon.species"));

// Registration-date authority and post-confirmation state must not remain stale.
assert.ok(confirmation.includes("field('登錄日期','registered_at'"));
assert.ok(confirmation.includes('registered_at:registeredAt'));
assert.ok(confirmation.includes('original_label:draft.species'));
assert.ok(confirmation.includes("pokemon-sleep:analysis-confirmation-reset"));
assert.ok(confirmation.includes('resetConfirmation(`已${mode==='));
assert.ok(confirmation.includes('dateText(identity.registered_date??raw.registered_at)'));

// Detail view keeps legacy rows readable and preserves verified-not-required semantics.
assert.ok(detail.includes('p.registered_at||p.obtained_at'));
assert.ok(detail.includes('DISPLAY_NOT_REQUIRED'));
assert.ok(detail.includes("state==='VERIFIED_NOT_REQUIRED'"));
assert.ok(detail.includes('storedEvolutionStates(p)'));

// Execute the pure multicapture contracts without a browser/database runtime.
const executable=multicapture
  .replace(/^import .*$/gm,'')
  .replace(/^export \{.*$/gm,'')
  + '\nglobalThis.__gate={normalizeRevision,mergeDraft,shouldStartNewGroup,dateText};';
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
context.dispatchEvent=()=>true;
vm.createContext(context);
vm.runInContext(executable,context);
const {normalizeRevision,shouldStartNewGroup,dateText}=context.__gate;

assert.equal(dateText('2026年8月18日'),'2026-08-18');
const tink=normalizeRevision({analysis_type:'ai',analysis_id:'tink',source_image_ref:'tink.png',result:{analysis:{observations:[{identity:{registered_date:'2026年8月18日'},profile:{header_name_text:'小鍛匠',level:14},ingredients:[],subskills:[]}]}}});
const raichu=normalizeRevision({analysis_type:'ai',analysis_id:'raichu',source_image_ref:'raichu.png',result:{analysis:{observations:[{identity:{registered_date:null},profile:{header_name_text:'雷丘',level:25},ingredients:[],subskills:[]}]}}});
const tink2=normalizeRevision({analysis_type:'ai',analysis_id:'tink2',source_image_ref:'tink2.png',result:{analysis:{observations:[{identity:{registered_date:null},profile:{header_name_text:'小鍛匠',level:14},ingredients:[],subskills:[]}]}}});
assert.equal(tink.registered_at,'2026-08-18');
assert.equal(tink.obtained_at,'2026-08-18','legacy predecessor field remains populated');
assert.equal(shouldStartNewGroup(tink,raichu),true,'different observed species must auto-separate before merge');
assert.equal(shouldStartNewGroup(tink,tink2),false,'same species remains eligible for multicapture merge');
assert.equal(shouldStartNewGroup({species:''},raichu),false,'missing identity must not invent a cross-species decision');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V042712_G13_12_LIVE_VALIDATION_UX',
  version:'v0.4.27.12',
  checks:{
    model_candidate_visible_with_elapsed_seconds:true,
    model_failover_visible:true,
    confirmed_roster_refresh:true,
    roster_name_species_fallback:true,
    registered_date_normalized:true,
    legacy_obtained_date_compatible:true,
    cross_species_group_auto_split:true,
    verified_not_required_rendering:true,
    stale_confirmation_reset:true,
  },
},null,2));
