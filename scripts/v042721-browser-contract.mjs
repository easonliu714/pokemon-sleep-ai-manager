import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const minimumPatch=21;
// Nested hotfixes (for example v0.4.27.55.1) are valid successors; preserve the minimum patch gate while allowing additional numeric components.
const isSupportedVersion=version=>{const match=/^v0\.4\.27\.(\d+)(?:\.\d+)*$/.exec(String(version||''));return Boolean(match)&&Number(match[1])>=minimumPatch;};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction((minimum)=>{const match=/^v0\.4\.27\.(\d+)(?:\.\d+)*$/.exec(String(globalThis.PokemonSleepVersionAuthority?.app_version||''));return Boolean(match)&&Number(match[1])>=minimum;},minimumPatch,{timeout:30000});
  await page.waitForFunction(()=>Boolean(globalThis.PokemonSleepPlayerEvolutionOverrideV042721),{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000}).catch(()=>{});

  const result=await page.evaluate(async()=>{
    const revision={analysis_id:'v042721-browser-fixture',analysis_type:'ai',revision_no:1,source_image_ref:'fixture-captain-pikachu.png',provider:'fixture'};
    const draft={
      species:'皮卡丘',nickname:'皮卡丘（船長）',level:16,sp:867,specialty:'樹果',type:'電',
      main_skill:'食材獲取S',main_skill_level:2,nature:'勇敢',nature_bonus:'幫忙速度',nature_penalty:'EXP獲得量',
      helper_seconds:2182,carry_limit:21,sleep_hours:0,registered_at:'2026-08-20',
      subskills:[],ingredients:[],source_refs:['fixture-captain-pikachu.png'],analysis_ids:['v042721-browser-fixture'],
      field_evidence:{},analysis_target_context:{mode:'new',target_pokemon_id:null,capture_group_id:'fixture-capture'},
    };
    globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail:{group_id:'v042721-browser-group',revision,draft,reason:'v042721_browser_fixture'}}));
    await new Promise(resolve=>setTimeout(resolve,100));
    const form=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');
    const panel=form?.querySelector('#playerEvolutionOverridePanel');
    if(!form||!panel)throw new Error('V042721_OVERRIDE_PANEL_MISSING');
    const mode=panel.querySelector('#evolutionAuthorityMode');
    const status=panel.querySelector('#evolutionOverrideStatus');
    const reason=panel.querySelector('#evolutionOverrideReason');
    const candy=form.querySelector('[data-field="evolution_candy_required"]');
    const item=form.querySelector('[data-field="evolution_item_required"]');
    const fields=['evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement'].map(name=>form.querySelector(`[data-field="${name}"]`));
    const publicBefore={candy:candy?.value??'',item:item?.value??''};

    mode.value='PLAYER_OVERRIDE';mode.dispatchEvent(new Event('change',{bubbles:true}));
    status.value='CANNOT_EVOLVE';status.dispatchEvent(new Event('change',{bubbles:true}));
    reason.value='活動特殊造型不可進化';reason.dispatchEvent(new Event('input',{bubbles:true}));
    const cannot={mode:mode.value,status:status.value,reason:reason.value,candy:candy?.value??null,item:item?.value??null,disabled:fields.every(node=>node?.disabled===true),notice:form.querySelector('#playerEvolutionOverrideEffective')?.textContent||'',publicHeading:form.querySelector('[data-evolution-authority-status] strong')?.textContent||''};

    globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:analysis-confirmation-group-selected',{detail:{group_id:'v042721-browser-group',revision,draft,reason:'v042721_browser_return'}}));
    await new Promise(resolve=>setTimeout(resolve,100));
    const returned=document.querySelector('#analysisConfirmationWorkbench .analysis-confirmation');
    const returnedPanel=returned?.querySelector('#playerEvolutionOverridePanel');
    const afterReturn={mode:returnedPanel?.querySelector('#evolutionAuthorityMode')?.value||null,status:returnedPanel?.querySelector('#evolutionOverrideStatus')?.value||null,reason:returnedPanel?.querySelector('#evolutionOverrideReason')?.value||null,candy:returned?.querySelector('[data-field="evolution_candy_required"]')?.value??null,item:returned?.querySelector('[data-field="evolution_item_required"]')?.value??null,disabled:['evolution_level_required','evolution_sleep_hours_required','evolution_candy_required','evolution_item_required','evolution_other_requirement'].every(name=>returned?.querySelector(`[data-field="${name}"]`)?.disabled===true)};
    return {publicBefore,cannot,afterReturn,version:globalThis.PokemonSleepVersionAuthority?.app_version,apiVersion:globalThis.PokemonSleepPlayerEvolutionOverrideV042721?.version};
  });

  assert.equal(isSupportedVersion(result.version),true);
  assert.equal(result.apiVersion,'pokemon-sleep-player-evolution-override/1.0-v042721');
  assert.equal(result.cannot.mode,'PLAYER_OVERRIDE');
  assert.equal(result.cannot.status,'CANNOT_EVOLVE');
  assert.equal(result.cannot.reason,'活動特殊造型不可進化');
  assert.equal(result.cannot.candy,'');
  assert.equal(result.cannot.item,'');
  assert.equal(result.cannot.disabled,true);
  assert.match(result.cannot.notice,/無法進化/);
  assert.match(result.cannot.publicHeading,/僅參考/);
  assert.equal(result.afterReturn.mode,'PLAYER_OVERRIDE');
  assert.equal(result.afterReturn.status,'CANNOT_EVOLVE');
  assert.equal(result.afterReturn.reason,'活動特殊造型不可進化');
  assert.equal(result.afterReturn.candy,'');
  assert.equal(result.afterReturn.item,'');
  assert.equal(result.afterReturn.disabled,true);

  console.log(JSON.stringify({status:'PASS',gate:'V042721_BROWSER_PLAYER_EVOLUTION_OVERRIDE_SUCCESSOR_AWARE',result,minimum_patch:minimumPatch},null,2));
}finally{await browser.close();}
