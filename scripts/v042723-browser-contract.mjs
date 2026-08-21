import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const supported=['v0.4.27.23','v0.4.27.24'];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction versions=>versions.includes(globalThis.PokemonSleepVersionAuthority?.app_version),supported,{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepPlayerProfileConsistencyV042723),{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepPlayerEvolutionOverrideV042721),{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000});

  const result=await page.evaluate(async()=>{
    const api=globalThis.PokemonSleepPlayerProfileConsistencyV042723;
    const rawDraft={
      species:'皮卡丘',nickname:'皮卡丘（船長）',level:16,sp:867,specialty:'樹果',type:'電',
      main_skill:'食材獲取S',main_skill_level:2,nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',
      helper_seconds:2182,carry_limit:21,favorite_berry:'柿仔果',sleep_hours:0,
      registered_at:'2026年8月20日',obtained_at:'2026年8月20日',
      subskills:[],ingredients:[],source_refs:['fixture-captain-pikachu.png'],analysis_ids:['v042723-browser-fixture'],field_evidence:{},
      analysis_target_context:{mode:'new',target_pokemon_id:null,capture_group_id:'fixture-capture-v042723'},
    };
    const rawBefore=JSON.stringify(rawDraft);
    const repaired=api.repairPlayerProfileDraft(rawDraft);
    const pure={
      date:repaired.draft.registered_at,
      berry:repaired.draft.favorite_berry,
      corrections:repaired.corrections.map(row=>row.field),
      rawUnchanged:JSON.stringify(rawDraft)===rawBefore,
      missingBerryPreserved:api.repairPlayerProfileDraft({...rawDraft,favorite_berry:''}).draft.favorite_berry,
    };

    const revision={analysis_id:'v042723-browser-fixture',analysis_type:'ai',revision_no:1,source_image_ref:'fixture-captain-pikachu.png',provider:'fixture'};
    globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail:{group_id:'v042723-browser-group',revision,draft:rawDraft,reason:'v042723_browser_fixture'}}));
    await new Promise(resolve=>setTimeout(resolve,160));
    const form=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');
    const confirmation={
      date:form?.querySelector('[data-field="registered_at"]')?.value||null,
      berry:form?.querySelector('[data-field="favorite_berry"]')?.value||null,
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
    return {version:globalThis.PokemonSleepVersionAuthority?.app_version,apiVersion:api.version,pure,confirmation,detail};
  });

  assert.ok(supported.includes(result.version));
  assert.equal(result.apiVersion,'v0.4.27.23-player-profile-consistency-2026-08-20-a');
  assert.equal(result.pure.date,'2026-08-20');
  assert.equal(result.pure.berry,'萄葡果');
  assert.deepEqual(result.pure.corrections,['registered_at','favorite_berry']);
  assert.equal(result.pure.rawUnchanged,true);
  assert.equal(result.pure.missingBerryPreserved,'');
  assert.equal(result.confirmation.date,'2026-08-20');
  assert.equal(result.confirmation.berry,'萄葡果');
  assert.match(result.confirmation.notice,/AI 原始 JSON 保留不變/);
  assert.match(result.confirmation.notice,/柿仔果/);
  assert.match(result.confirmation.notice,/萄葡果/);
  assert.equal(result.detail.status,'PLAYER_OVERRIDE_PROJECTED');
  assert.equal(result.detail.authority,'CANNOT_EVOLVE');
  assert.match(result.detail.text,/此特殊個體無法進化/);
  assert.match(result.detail.text,/活動特殊造型（船長）不可進化/);
  assert.doesNotMatch(result.detail.text,/×80|雷之石/);
  assert.match(result.detail.publicText,/進化條件由玩家覆寫 Authority 決定/);

  console.log(JSON.stringify({status:'PASS',gate:'V042723_BROWSER_PLAYER_PROFILE_CONSISTENCY_SUCCESSOR_AWARE',result},null,2));
}finally{await browser.close();}
