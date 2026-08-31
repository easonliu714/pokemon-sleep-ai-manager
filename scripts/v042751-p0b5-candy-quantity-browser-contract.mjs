import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000});

  // P0-B5 screenshot UI normally mounts only when Update Center creates its dynamic host.
  // The regression gate boot page does not navigate into that view, so create the exact host
  // and import a cache-busted copy of the real UI module. This validates mountability without
  // weakening the production mount contract or depending on unrelated navigation state.
  await page.evaluate(async()=>{
    let host=document.getElementById('updateCenterDynamicContent');
    if(!host){
      host=document.createElement('div');
      host.id='updateCenterDynamicContent';
      document.body.appendChild(host);
    }
    await import('./assets/js/candy-quantity-screenshot-ui.js?gate=v042751-browser-mount');
  });
  // The synthetic host is intentionally outside the active Update Center view, so production
  // CSS may keep the mounted panel hidden. This gate verifies exact DOM mountability here;
  // visibility/navigation is a separate live PWA concern and must not create a false CI failure.
  await page.waitForSelector('#candyQuantityScreenshotB5',{state:'attached',timeout:60000});

  const result=await page.evaluate(async()=>{
    const governed=await import('./assets/js/candy-quantity-confirmation-authority.js?gate=v042751');
    const baseRecognition=await import('./assets/js/public-master-recognition.js?gate=v042751');
    const importer=await import('./assets/js/importer.js?gate=v042751');
    // importer.js binds the canonical queryless database singleton.
    const database=await import('./assets/js/database.js');
    if(!database.isDatabaseReady())await database.initializeDatabase();

    const snapshot=governed.buildPublicMasterCatalogSnapshot('candies');
    const candidate=snapshot.rows.find(row=>row?.candy_id&&row?.candy_name);
    if(!candidate)throw new Error('candy_master_candidate_missing');
    database.run(`INSERT INTO candy_inventory(candy_id,quantity,safe_reserve,updated_at,source_update_id)
      VALUES(?,?,0,datetime('now'),?)
      ON CONFLICT(candy_id) DO UPDATE SET quantity=excluded.quantity,safe_reserve=0,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,
      [candidate.candy_id,5,'V042751-SEED']);

    const recognition={
      schema:baseRecognition.PUBLIC_MASTER_RECOGNITION_SCHEMA,
      recognition_version:baseRecognition.PUBLIC_MASTER_RECOGNITION_VERSION,
      scenario:snapshot.scenario,
      authority:snapshot.authority,
      data_version:snapshot.data_version,
      catalog_snapshot_id:snapshot.catalog_snapshot_id,
      generated_at:'2026-08-31T11:10:00.000Z',
      visible_target_count:1,
      observations:[{
        observation_id:'candy-browser-001',status:'MATCHED',observed_text:candidate.candy_name,
        observed_data:{quantity:7},canonical_key:{candy_id:candidate.candy_id,candy_name:candidate.candy_name},canonical_name:candidate.candy_name,
        source_image_ref:'candy-image-001',confidence:0.99,reason:'quantity visible in screenshot',
      }],
    };

    const governedBefore=governed.compileCandyQuantityGovernedRecognitionToUpdatePackage(recognition,'candies',{allowedImageRefs:['candy-image-001']});
    const unsafeBase=baseRecognition.compilePublicMasterRecognitionToUpdatePackage(recognition,'candies',{allowedImageRefs:['candy-image-001']});
    let unsafeImporterError=null;
    try{importer.dryRun(unsafeBase.update_package);}catch(error){unsafeImporterError=String(error?.message||error);}

    const confirmed=governed.confirmCandyScreenshotQuantity(recognition,'candies','candy-browser-001',{confirmedAt:'2026-08-31T11:11:00.000Z'});
    const compiled=governed.compileCandyQuantityGovernedRecognitionToUpdatePackage(confirmed,'candies',{allowedImageRefs:['candy-image-001']});
    const preview=importer.dryRun(compiled.update_package);
    const change=preview.changes[0]||null;
    const applied=await importer.applyPayload(compiled.update_package);
    const storedAfterSeven=database.rows('SELECT candy_id,quantity,safe_reserve,source_update_id FROM candy_inventory WHERE candy_id=?',[candidate.candy_id])[0]||null;

    const zeroRecognition={
      ...recognition,
      generated_at:'2026-08-31T11:12:00.000Z',
      observations:[{...recognition.observations[0],observation_id:'candy-browser-zero',observed_data:{quantity:0}}],
    };
    const zeroConfirmed=governed.confirmCandyScreenshotQuantity(zeroRecognition,'candies','candy-browser-zero',{confirmedAt:'2026-08-31T11:13:00.000Z'});
    const zeroCompiled=governed.compileCandyQuantityGovernedRecognitionToUpdatePackage(zeroConfirmed,'candies',{allowedImageRefs:['candy-image-001']});
    const zeroPreview=importer.dryRun(zeroCompiled.update_package);
    await importer.applyPayload(zeroCompiled.update_package);
    const storedAfterZero=database.rows('SELECT candy_id,quantity,safe_reserve,source_update_id FROM candy_inventory WHERE candy_id=?',[candidate.candy_id])[0]||null;

    return {
      uiPresent:Boolean(document.getElementById('candyQuantityScreenshotB5')),
      candidate,
      governedBefore:{ok:governedBefore.ok,operations:governedBefore.update_package.operations.length,pending:governedBefore.unresolved?.[0]?.reason||null},
      unsafeBaseOperations:unsafeBase.update_package.operations.length,
      unsafeImporterError,
      confirmedResolution:confirmed.observations[0].user_resolution,
      compiledOperation:compiled.update_package.operations[0]||null,
      preview:{ready_count:preview.ready_count,conflict_count:preview.conflict_count,change},
      applied,
      storedAfterSeven,
      zeroPreview:{ready_count:zeroPreview.ready_count,conflict_count:zeroPreview.conflict_count,change:zeroPreview.changes[0]||null},
      storedAfterZero,
    };
  });

  assert.equal(result.uiPresent,true);
  assert.equal(result.governedBefore.ok,false);
  assert.equal(result.governedBefore.operations,0);
  assert.equal(result.governedBefore.pending,'CANDY_QUANTITY_REQUIRES_USER_CONFIRMATION');
  assert.equal(result.unsafeBaseOperations,1,'base predecessor compiler should demonstrate the bypass candidate');
  assert.match(result.unsafeImporterError||'',/截圖糖果 quantity 必須由使用者明確確認/,'importer must fail closed on unconfirmed screenshot candy write');
  assert.equal(result.confirmedResolution.action,'USER_CONFIRMED_CANDY_QUANTITY');
  assert.equal(result.confirmedResolution.confirmed_quantity,7);
  assert.equal(result.compiledOperation.evidence.quantity_confirmed_by_user,true);
  assert.equal(result.compiledOperation.evidence.confirmed_quantity,7);
  assert.equal(result.preview.ready_count,1);
  assert.equal(result.preview.conflict_count,0);
  assert.equal(result.preview.change.after.quantity,7);
  assert.equal(result.applied.operation_count,1);
  assert.equal(result.storedAfterSeven.quantity,7);
  assert.equal(result.zeroPreview.ready_count,1);
  assert.equal(result.zeroPreview.conflict_count,0);
  assert.equal(result.zeroPreview.change.after.quantity,0);
  assert.equal(result.storedAfterZero.quantity,0,'explicit confirmed zero must persist as a real value');

  console.log(JSON.stringify({status:'PASS',gate:'V042751_P0B5_CANDY_QUANTITY_BROWSER_TRANSACTION',result},null,2));
}finally{await browser.close();}
