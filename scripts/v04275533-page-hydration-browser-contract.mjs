import {chromium} from 'playwright';
import '../assets/js/version-authority.js';

const expected=globalThis.PokemonSleepVersionAuthority;
const baseUrl=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:412,height:915},serviceWorkers:'block'});
page.setDefaultTimeout(30_000);
const observed={consoleErrors:[],pageErrors:[],failedRequests:[]};
page.on('console',m=>{if(m.type()==='error')observed.consoleErrors.push(m.text());});
page.on('pageerror',e=>observed.pageErrors.push(e.message||String(e)));
page.on('requestfailed',r=>observed.failedRequests.push(`${r.failure()?.errorText||'failed'}: ${r.url()}`));
const failures=[];
const fail=(condition,message)=>{if(!condition)failures.push(message);};

try{
  await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:30_000});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.trim()==='App 已就緒',null,{timeout:30_000});

  const startup=await page.evaluate(()=>({
    version:document.documentElement.dataset.appVersion,
    build:document.documentElement.dataset.appBuild,
    active:document.querySelector('.view.active')?.id||null,
    itemRows:document.querySelectorAll('#itemTable tbody tr').length,
    recipeRows:document.querySelectorAll('#recipeTable tbody tr').length,
    historyRows:document.querySelectorAll('#historyTable tbody tr').length,
    candyReview:Boolean(document.getElementById('candyQuantityScreenshotB5')),
    screenshotWorkbench:Boolean(document.getElementById('ucImgA')),
    analysisWorkbench:Boolean(document.getElementById('analysisConfirmationWorkbench')),
    identityWizard:Boolean(document.getElementById('identityImportWizardRoot')),
  }));
  fail(startup.version===expected.app_version,`version mismatch ${startup.version}`);
  fail(startup.build===expected.app_build,`build mismatch ${startup.build}`);
  fail(startup.active==='dashboard',`startup active view ${startup.active}`);
  fail(startup.itemRows===0,`item DOM was rendered offscreen at startup: ${startup.itemRows}`);
  fail(startup.recipeRows===0,`recipe DOM was rendered offscreen at startup: ${startup.recipeRows}`);
  fail(startup.historyRows===0,`history DOM was rendered offscreen at startup: ${startup.historyRows}`);
  fail(!startup.candyReview&&!startup.screenshotWorkbench&&!startup.analysisWorkbench&&!startup.identityWizard,'Update Center feature roots must remain unloaded before navigation');

  await page.click('nav [data-view="items"]');
  await page.waitForFunction(()=>document.getElementById('items')?.classList.contains('active')&&document.querySelectorAll('#itemTable tbody tr').length>0&&document.getElementById('itemsCandySlot')?.dataset.hydrationState==='ready');
  const items=await page.evaluate(()=>({
    active:document.getElementById('items')?.classList.contains('active')||false,
    rows:document.querySelectorAll('#itemTable tbody tr').length,
    candyReady:document.getElementById('itemsCandySlot')?.dataset.hydrationState||null,
    tableParent:document.getElementById('itemTable')?.closest('.view')?.id||null,
  }));
  fail(items.active&&items.rows>0,'Items page did not hydrate from local projection');
  fail(items.candyReady==='ready','Items Candy slot did not reach ready');
  fail(items.tableParent==='items','itemTable escaped Items page ownership');

  await page.click('nav [data-view="knowledge"]');
  await page.waitForFunction(()=>document.getElementById('knowledgePokemonSlot')?.dataset.hydrationState==='ready'&&document.getElementById('knowledgeCandySlot')?.dataset.hydrationState==='ready'&&document.querySelectorAll('#candyMasterTable tbody tr').length>0);
  const knowledgeBefore=await page.evaluate(()=>({
    pokemonOwner:document.getElementById('knowledgePokemonSlot')?.parentElement?.id||null,
    candyOwner:document.getElementById('candyMasterTable')?.closest('#knowledgeCandySlot')?.id||null,
    candyRows:document.querySelectorAll('#candyMasterTable tbody tr').length,
    evolutionRows:document.querySelectorAll('#evolutionMasterTable tbody tr').length,
    candyCount:document.querySelectorAll('#candyMasterTable').length,
  }));
  await page.waitForTimeout(500);
  const knowledgeAfter=await page.evaluate(()=>({
    candyOwner:document.getElementById('candyMasterTable')?.closest('#knowledgeCandySlot')?.id||null,
    candyRows:document.querySelectorAll('#candyMasterTable tbody tr').length,
    candyCount:document.querySelectorAll('#candyMasterTable').length,
  }));
  fail(knowledgeBefore.pokemonOwner==='sharedKnowledgePanel','Knowledge Pokémon slot escaped shared layout');
  fail(knowledgeBefore.candyOwner==='knowledgeCandySlot','Candy master not owned by knowledgeCandySlot');
  fail(knowledgeBefore.candyCount===1&&knowledgeAfter.candyCount===1,'Candy master duplicated or disappeared');
  fail(knowledgeBefore.candyRows===knowledgeAfter.candyRows&&knowledgeAfter.candyRows>0,'Candy master rows changed/disappeared after Knowledge hydration');
  fail(knowledgeBefore.evolutionRows>0,'Knowledge Pokémon tables did not hydrate');

  await page.click('nav [data-view="updates"]');
  await page.waitForFunction(()=>['candy','analysis','ocr'].every(key=>document.querySelector(`[data-update-static-shell="${key}"]`)?.dataset.hydrationState==='ready'),null,{timeout:30_000});
  const updates=await page.evaluate(()=>{
    const details=document.getElementById('importHistoryDetailsV042745');
    const wrap=document.getElementById('importHistoryWrap');
    const table=document.getElementById('historyTable');
    return {
      candyOwned:Boolean(document.getElementById('updateCenterCandyMount')?.contains(document.getElementById('candyQuantityScreenshotB5'))),
      screenshotOwned:Boolean(document.getElementById('updateCenterScreenshotMount')?.contains(document.getElementById('ucImgA'))),
      analysisOwned:Boolean(document.getElementById('updateCenterAnalysisMount')?.contains(document.getElementById('analysisConfirmationWorkbench'))),
      identityOwned:Boolean(document.getElementById('updateCenterIdentityMount')?.contains(document.getElementById('identityImportWizardRoot'))),
      detailsCount:document.querySelectorAll('#importHistoryDetailsV042745').length,
      wrapCount:document.querySelectorAll('#importHistoryWrap').length,
      tableCount:document.querySelectorAll('#historyTable').length,
      detailsContainsWrap:Boolean(details?.contains(wrap)),
      wrapContainsTable:Boolean(wrap?.contains(table)),
      open:Boolean(details?.open),
      collapsedDisplay:wrap?getComputedStyle(wrap).display:null,
      rowCount:table?.querySelectorAll('tbody tr').length||0,
    };
  });
  fail(updates.candyOwned,'Candy review root is not mounted in Candy static slot');
  fail(updates.screenshotOwned,'Screenshot workbench is not mounted in screenshot slot');
  fail(updates.analysisOwned,'Analysis confirmation is not mounted in analysis slot');
  fail(updates.identityOwned,'Identity wizard is not mounted in OCR slot');
  fail(updates.detailsCount===1&&updates.wrapCount===1&&updates.tableCount===1,'Import History DOM IDs are duplicated');
  fail(updates.detailsContainsWrap&&updates.wrapContainsTable,'Import History table is not owned by native details tree');
  fail(updates.open===false,'Import History must be collapsed by default');
  fail(updates.collapsedDisplay==='none',`collapsed Import History still occupies layout: ${updates.collapsedDisplay}`);

  const expanded=await page.evaluate(()=>{
    const details=document.getElementById('importHistoryDetailsV042745');
    const wrap=document.getElementById('importHistoryWrap');
    const table=document.getElementById('historyTable');
    details.open=true;
    return {display:getComputedStyle(wrap).display,rowCount:table.querySelectorAll('tbody tr').length};
  });
  fail(expanded.display!=='none','Import History table did not expand');
  fail(expanded.rowCount===updates.rowCount,'Import History row count changed on expand');

  await page.evaluate(()=>{document.getElementById('importHistoryDetailsV042745').open=false;});
  const collapsedAgain=await page.evaluate(()=>getComputedStyle(document.getElementById('importHistoryWrap')).display);
  fail(collapsedAgain==='none','Import History table did not collapse again');

  for(let i=0;i<3;i+=1){
    await page.click('nav [data-view="dashboard"]');
    await page.click('nav [data-view="updates"]');
    await page.waitForFunction(()=>document.getElementById('updateCenterCandyStaticShell')?.dataset.hydrationState==='ready');
  }
  const repeat=await page.evaluate(()=>({
    details:document.querySelectorAll('#importHistoryDetailsV042745').length,
    wrap:document.querySelectorAll('#importHistoryWrap').length,
    table:document.querySelectorAll('#historyTable').length,
    owned:document.getElementById('importHistoryDetailsV042745')?.contains(document.getElementById('importHistoryWrap'))&&document.getElementById('importHistoryWrap')?.contains(document.getElementById('historyTable')),
    candyTables:document.querySelectorAll('#candyMasterTable').length,
  }));
  fail(repeat.details===1&&repeat.wrap===1&&repeat.table===1&&repeat.owned,'Repeated navigation broke Import History ownership');
  fail(repeat.candyTables===1,'Repeated navigation duplicated Candy master table');

  const blockingConsole=observed.consoleErrors.filter(x=>!/favicon\.ico|Receiving end does not exist/i.test(x));
  const blockingRequests=observed.failedRequests.filter(x=>!/favicon\.ico|cdn\.jsdelivr\.net/i.test(x));
  if(observed.pageErrors.length)failures.push(`pageerror: ${observed.pageErrors.join(' | ')}`);
  if(blockingConsole.length)failures.push(`console: ${blockingConsole.join(' | ')}`);
  if(blockingRequests.length)failures.push(`request: ${blockingRequests.join(' | ')}`);

  console.log(JSON.stringify({ok:failures.length===0,gate:'V04275533_PAGE_HYDRATION_BROWSER',expected,startup,items,knowledgeBefore,knowledgeAfter,updates,expanded,repeat,observed,failures},null,2));
}finally{
  await browser.close();
}
process.exit(failures.length?1:0);
