// G14.1 #482 — disposable REAL production renderReport layout regression.
// Uses the exact function extracted from backup-truth-restore.js and actual app.css.
// It never reads, changes, imports or clears any Owner SQLite / IndexedDB.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const source=readFileSync('assets/js/backup-truth-restore.js','utf8');
const start=source.indexOf('function renderReport(');
const end=source.indexOf('\nasync function stageRestore(',start);
assert.ok(start>=0 && end>start,'G141_CURRENT_PRODUCTION_REPORT_REQUIRED');
const productionRender=source.slice(start,end);
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4173/');
assert.equal(base.hostname,'127.0.0.1','disposable local test only');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/g141-backup-sha-disposable',route=>route.fulfill({
    status:200,contentType:'text/html',
    body:'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/app.css"></head><body><main><section class="panel" id="backup"><section class="panel" id="backupTruthReport"></section></section></main></body></html>'
  }));
  for(const width of [320,360,393,430]){
    const page=await context.newPage({viewport:{width,height:800}});
    try{
      await page.setViewportSize({width,height:800});
      await page.goto(new URL('g141-backup-sha-disposable',base).href);
      for(const sha of ['a'.repeat(64),'4f2d2201'+'b'.repeat(56),'b698c7a5'+'d'.repeat(56)]){
        const result=await page.evaluate(({productionRender,sha})=>{
          const $=id=>document.getElementById(id);
          const render=new Function('$',productionRender+'\nreturn renderReport;')($);
          render('目前資料庫自我檢查',{
            integrity_ok:true,foreign_key_errors:[],database_sha256:sha,
            database_size:12034048,pokemon_active:75,
            table_counts:{schema_migrations:16,pokemon:81,pokemon_subskills:398,
              pokemon_ingredients:239,import_changes:4032}
          });
          const panel=$('backupTruthReport'),code=panel.querySelector('code');
          const container=panel.getBoundingClientRect();
          const rect=code.getBoundingClientRect();
          const css=getComputedStyle(code);
          return {
            rendered:code.textContent,
            scrollWidth:document.documentElement.scrollWidth,
            panelClient:panel.clientWidth,panelScroll:panel.scrollWidth,
            codeClient:code.clientWidth,codeScroll:code.scrollWidth,
            right:rect.right,panelRight:container.right,
            overflowWrap:css.overflowWrap,wordBreak:css.wordBreak,
            whiteSpace:css.whiteSpace
          };
        },{productionRender,sha});
        assert.equal(result.rendered,sha,'full original 64-hex digest must remain selectable and untruncated');
        assert.ok(result.scrollWidth<=width+1,
          'G141_SHA_PRODUCTION_MOBILE_PAGE_HORIZONTAL_OVERFLOW:'+JSON.stringify({width,result}));
        assert.ok(result.panelScroll<=result.panelClient+1,
          'G141_SHA_PRODUCTION_REPORT_HORIZONTAL_OVERFLOW:'+JSON.stringify({width,result}));
        assert.ok(result.right<=result.panelRight+1,
          'G141_SHA_CODE_EXCEEDS_REPORT_CARD:'+JSON.stringify({width,result}));
        assert.ok(result.codeScroll<=result.codeClient+1,
          'G141_SHA_CODE_UNBROKEN_OVERFLOW:'+JSON.stringify({width,result}));
        assert.ok(['anywhere','break-word'].includes(result.overflowWrap) ||
          result.wordBreak==='break-all','G141_SHA_MUST_WRAP_WITHIN_MOBILE_CARD');
        assert.equal(result.whiteSpace,'normal','G141_SHA_NOT_PERMITTED_TO_FORCE_NOWRAP');
      }
      console.log('PASS G141_BACKUP_REAL_RENDER_SHA64_WRAP_'+width);
    }finally{await page.close();}
  }
  await context.close();
}finally{await browser.close();}
