import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.PokemonSleepVersionAuthority?.app_version==='v0.4.27.18',{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:30000}).catch(()=>{});
  const result=await page.evaluate(async()=>{
    await import(new URL('./assets/js/unified-import-analysis-workbench.js',location.href).href);
    const mod=await import(new URL('./assets/js/review-group-isolation-v042717.js',location.href).href);
    let wizard=document.getElementById('identityImportWizardRoot');
    if(!wizard){wizard=document.createElement('section');wizard.id='identityImportWizardRoot';document.getElementById('updates')?.append(wizard);}
    const items=['A1','A2','B1','C1','D1','D2'].map(id=>({sha256:`img-${id}`,source_image_ref:`${id}.png`,file_name:`${id}.png`,path:`${id}.png`,status:'new'}));
    dispatchEvent(new CustomEvent('pokemon-sleep:identity-import-files-selected',{detail:{source_type:'v042718_browser_fixture',inventory:{items},archives:[]}}));
    await new Promise(resolve=>setTimeout(resolve,400));
    const workbench=document.getElementById('unifiedImportAnalysisWorkbench');
    const cards=[...workbench.querySelectorAll('.light-review-item')];
    const assignmentSections=[...workbench.querySelectorAll('[data-v042718-target-assignment]')];
    const existingSelects=[...workbench.querySelectorAll('[data-v042718-existing-target]')];
    const newSelects=[...workbench.querySelectorAll('[data-v042718-new-group]')];

    const shell=document.createElement('section');shell.id='v042718SyntheticReview';shell.innerHTML='<section class="analysis-confirmation" data-fixture-group="B"></section>';document.body.append(shell);
    const groupMap=new Map([
      ['A',{id:'A',order:1,status:'active',draft:{species:'拉帝歐斯',nickname:'',analysis_ids:['A1'],source_refs:['A.png']}}],
      ['B',{id:'B',order:2,status:'pending',draft:{species:'信使鳥',nickname:'',analysis_ids:['B1'],source_refs:['B.png']}}],
      ['C',{id:'C',order:3,status:'pending',draft:{species:'雷丘',nickname:'',analysis_ids:['C1'],source_refs:['C.png']}}],
      ['D',{id:'D',order:4,status:'pending',draft:{species:'小鍛匠',nickname:'',analysis_ids:['D1'],source_refs:['D.png']}}],
    ]);
    let active='D';
    const clone=value=>JSON.parse(JSON.stringify(value));
    const api={getState:()=>({active_group_id:active,groups:[...groupMap.values()].map(clone)}),selectGroup:id=>{active=id;return {id,draft:clone(groupMap.get(id).draft)};}};
    const authority=mod.createImmutableFormGroupAuthority(api,{getVisibleGroupId:()=>shell.querySelector('.analysis-confirmation').dataset.fixtureGroup});
    for(const row of groupMap.values())authority.acceptCoreDraft(row.id,row.draft,{reason:'browser_seed'});
    authority.noteRenderedGroup('B');
    authority.replaceVisibleDraft({...groupMap.get('B').draft,nickname:'B_BROWSER_MANUAL'},{reason:'browser_manual'});
    const activeAfterWrite=active;
    const bDraft=authority.getDraft('B');
    const cBefore=authority.getDraft('C');
    const contaminated={...groupMap.get('D').draft,analysis_ids:['C1'],source_refs:['C.png']};
    const cAfter=authority.acceptCoreDraft('C',contaminated,{reason:'browser_contamination'}).draft;
    const prev=authority.navigateVisible(-1,{reason:'browser_previous'});

    return {
      version:globalThis.PokemonSleepVersionAuthority?.app_version,
      cardCount:cards.length,
      assignmentCount:assignmentSections.length,
      existingSelectCount:existingSelects.length,
      firstExistingOptionCount:existingSelects[0]?.options?.length||0,
      newSelectCount:newSelects.length,
      newGroupOptionCount:newSelects[0]?.options?.length||0,
      notice:Boolean(workbench.querySelector('#v042718PerImageTargetNotice')),
      oldGlobalPanelHidden:workbench.querySelector('#unifiedIdentityTargetPanel')?.classList.contains('hidden')||false,
      activeAfterWrite,bNickname:bDraft?.nickname,cBefore:cBefore?.species,cAfter:cAfter?.species,previousId:prev?.id||null,
      globalTargetRuntimeVersion:globalThis.PokemonSleepPerImageTargetAssignmentV042718?.version||null,
      groupAuthorityRuntimeVersion:globalThis.PokemonSleepReviewGroupAuthorityV042718?.version||null,
    };
  });

  assert.equal(result.version,'v0.4.27.18');
  assert.equal(result.cardCount,6);
  assert.equal(result.assignmentCount,6,'every imported image must receive its own target assignment controls');
  assert.equal(result.existingSelectCount,6);
  assert.ok(result.firstExistingOptionCount>=1,'existing roster selector must be present per image');
  assert.equal(result.newSelectCount,6);
  assert.ok(result.newGroupOptionCount>=13,'new group selector must provide blank + 12 local group slots');
  assert.equal(result.notice,true);
  assert.equal(result.oldGlobalPanelHidden,true,'legacy one-target-per-batch panel must be hidden');
  assert.equal(result.activeAfterWrite,'D','form write must not mutate active pointer');
  assert.equal(result.bNickname,'B_BROWSER_MANUAL');
  assert.equal(result.cBefore,'雷丘');
  assert.equal(result.cAfter,'雷丘','same-revision D->C contamination must be rejected');
  assert.equal(result.previousId,'A','navigation must use visible B as source even while active pointer began at D');
  assert.equal(result.globalTargetRuntimeVersion,'v0.4.27.18-per-image-target-assignment-2026-08-19-a');
  assert.equal(result.groupAuthorityRuntimeVersion,'v0.4.27.18-immutable-form-group-2026-08-19-a');
  console.log(JSON.stringify({status:'PASS',gate:'V042718_BROWSER_PER_IMAGE_TARGET_AND_FORM_GROUP_AUTHORITY',result},null,2));
}finally{await browser.close();}
