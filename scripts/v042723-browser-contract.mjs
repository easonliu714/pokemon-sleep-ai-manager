import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const minimumPatch=23;
const isSupportedVersion=version=>{const match=/^v0\.4\.27\.(\d+)$/.exec(String(version||''));return Boolean(match)&&Number(match[1])>=minimumPatch;};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction((minimum)=>{const match=/^v0\.4\.27\.(\d+)$/.exec(String(globalThis.PokemonSleepVersionAuthority?.app_version||''));return Boolean(match)&&Number(match[1])>=minimum;},minimumPatch,{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepPlayerProfileConsistencyV042723),{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepPlayerEvolutionOverrideV042721),{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepMultiCaptureConsistency),{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000});

  const result=await page.evaluate(async()=>{
    const api=globalThis.PokemonSleepPlayerProfileConsistencyV042723;
    const rawDraft={
      species:'皮卡丘',nickname:'皮卡丘（船長）',level:16,sp:867,specialty:'樹果',type:'電',
      main_skill:'食材獲取S',main_skill_level:2,nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',
      helper_seconds:2182,carry_limit:21,favorite_berry:'柿仔果',sleep_hours:0,
      registered_at:'2026年8月20日',obtained_at:'2026年8月20日',
      subskills:[],ingredients:[],source_refs:['fixture-captain-pikachu.png'],analysis_ids:['v042723-browser-fixture'],field_evidence:{},
      analysis_target_context:{mode:'new',target_pokemon_id:null,capture_group_id:'fixture-capture-v042736'},
    };
    const rawBefore=JSON.stringify(rawDraft);
    const repaired=api.repairPlayerProfileDraft(rawDraft);
    const berryCorrection=repaired.corrections.find(row=>row.field==='favorite_berry')||null;
    const pure={
      date:repaired.draft.registered_at,
      berry:repaired.draft.favorite_berry,
      corrections:repaired.corrections.map(row=>({field:row.field,status:row.status,auto_rewrite:row.auto_rewrite??null,canonical_value:row.canonical_value??null})),
      berryReviewStatus:berryCorrection?.status||null,
      berryAutoRewrite:berryCorrection?.auto_rewrite??null,
      rawUnchanged:JSON.stringify(rawDraft)===rawBefore,
      missingBerryPreserved:api.repairPlayerProfileDraft({...rawDraft,favorite_berry:''}).draft.favorite_berry,
    };

    // Use the production multicapture API rather than dispatching a synthetic group
    // event. v0.4.27.36 intentionally rejects events that cannot map to an exact
    // active + visible capture group.
    const targetContext={
      schema:'pokemon-sleep-analysis-target-context/1.1',mode:'new',
      target_pokemon_id:null,target_pokemon_instance_id:null,
      capture_group_id:'fixture-capture-v042736',target_species_snapshot:null,
      target_label_snapshot:null,baseline_reference:null,
    };
    const revision={
      analysis_id:'v042723-browser-fixture',analysis_type:'ai',revision_no:1,
      image_sha256:'v042723-browser-image',source_image_ref:'fixture-captain-pikachu.png',provider:'fixture',
      identity_context:targetContext,
      result:{
        schema_version:'2.0-observation',source:'ai_screenshot_observation',
        observations:[{
          identity:{registered_date:'2026年8月20日'},
          profile:{
            species:'皮卡丘',nickname:null,level:16,sp:867,specialty:'樹果',type:'電',
            main_skill:'食材獲取S',main_skill_level:2,nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',
            helper_seconds:2182,carry_limit:21,favorite_berry:'柿仔果',sleep_hours:0,
          },
          subskills:[],ingredients:[],is_favorite:false,
        }],
      },
    };
    const group=globalThis.PokemonSleepMultiCaptureConsistency.upsertRevision(revision);
    await new Promise(resolve=>setTimeout(resolve,200));
    const form=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');
    const confirmation={
      groupId:group?.id||null,
      visibleGroupId:form?.dataset?.v042718GroupId||null,
      date:form?.querySelector('[data-field="registered_at"]')?.value||null,
      berry:form?.querySelector('[data-field="favorite_berry"]')?.value||null,
      type:form?.querySelector('[data-field="type"]')?.value||null,
      notice:form?.querySelector('#playerProfileConsistencyNoticeV042723')?.textContent||'',
    };

    const db=await import('./assets/js/database.js');
    globalThis.PokemonSleepPlayerEvolutionOverrideV042721.ensureTable();
    const pokemonId='v042723-detail-fixture';
    const now=new Date().toISOString();
    db.run(`INSERT OR REPLACE INTO pokemon_evolution_override(
      pokemon_id,authority_mode,override_status,target_override,override_reason,
      required_level,required_sleep_hours,required_candy,required_item,other_requirement,
      source_analysis_id,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      pokemonId,'PLAYER_OVERRIDE','CANNOT_EVOLVE','','活動特殊造型（船長）不可進化',
      null,null,null,'','', 'v042723-fixture',now,now,
    ]);
    const body=document.getElementById('detailBody');
    body.innerHTML=`<div class="detail-section"><h3>進化條件</h3><div class="notice"><b>公版進化條件</b></div><div class="detail-grid"><div class="detail-card"><b>糖果需求</b>×80</div><div class="detail-card"><b>進化道具</b>雷之石</div></div></div><div class="detail-section"><h3>公版引用</h3><div class="notice">性格影響、主技能顯示／說明與進化條件為公版 Projection；只有玩家實際觀察值會寫入個體資料。</div></div>`;
    const detailResult=api.reconcilePokemonDetail(pokemonId);
    const evolutionSection=[...body.querySelectorAll('.detail-section')].find(section=>section.querySelector('h3')?.textContent==='進化條件');
    const publicSection=[...body.querySelectorAll('.detail-section')].find(section=>section.querySelector('h3')?.textContent==='公版引用');
    const detail={
      status:detailResult.status,
      text:evolutionSection?.textContent||'',
      authority:evolutionSection?.dataset.v042723EvolutionAuthority||null,
      publicText:publicSection?.textContent||'',
    };
    db.run('DELETE FROM pokemon_evolution_override WHERE pokemon_id=?',[pokemonId]);
    globalThis.PokemonSleepMultiCaptureConsistency.closeActiveGroup?.('v042723_browser_fixture_cleanup');
    return {version:globalThis.PokemonSleepVersionAuthority?.app_version,apiVersion:api.version,pure,confirmation,detail};
  });

  assert.equal(isSupportedVersion(result.version),true);
  assert.equal(result.apiVersion,'v0.4.27.36-player-profile-consistency-review-only-2026-08-25-a');
  assert.equal(result.pure.date,'2026-08-20');
  assert.equal(result.pure.berry,'柿仔果','successor must preserve observed berry');
  assert.deepEqual(result.pure.corrections.map(row=>row.field),['registered_at','favorite_berry']);
  assert.equal(result.pure.berryReviewStatus,'REVIEW_REQUIRED_TYPE_BERRY_MISMATCH');
  assert.equal(result.pure.berryAutoRewrite,false);
  assert.equal(result.pure.corrections.find(row=>row.field==='favorite_berry')?.canonical_value,'萄葡果');
  assert.equal(result.pure.rawUnchanged,true);
  assert.equal(result.pure.missingBerryPreserved,'');
  assert.equal(result.confirmation.groupId,result.confirmation.visibleGroupId,'browser fixture must bind exact visible group');
  assert.equal(result.confirmation.date,'2026-08-20');
  assert.equal(result.confirmation.type,'電');
  assert.equal(result.confirmation.berry,'柿仔果','confirmation must not silently rewrite berry');
  assert.match(result.confirmation.notice,/需要人工覆核/);
  assert.match(result.confirmation.notice,/平台不會自動改寫/);
  assert.match(result.confirmation.notice,/柿仔果/);
  assert.match(result.confirmation.notice,/萄葡果/);
  assert.equal(result.detail.status,'PLAYER_OVERRIDE_PROJECTED');
  assert.equal(result.detail.authority,'CANNOT_EVOLVE');
  assert.match(result.detail.text,/此特殊個體無法進化/);
  assert.match(result.detail.text,/活動特殊造型（船長）不可進化/);
  assert.doesNotMatch(result.detail.text,/×80|雷之石/);
  assert.match(result.detail.publicText,/進化條件由玩家覆寫 Authority 決定/);

  console.log(JSON.stringify({
    status:'PASS',gate:'V042723_BROWSER_PLAYER_PROFILE_CONSISTENCY_SUCCESSOR_AWARE',result,minimum_patch:minimumPatch,
    exact_group_fixture:true,type_berry_review_only:true,type_berry_auto_rewrite:false,
  },null,2));
}finally{await browser.close();}
