import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('dbStatus')?.textContent?.includes('就緒'),{timeout:60000});

  const result=await page.evaluate(async()=>{
    const recognition=await import('./assets/js/public-master-recognition.js?gate=v042748');
    const zero=await import('./assets/js/uc-img-explicit-zero-confirmation-v042748.js?gate=v042748');
    const importer=await import('./assets/js/importer.js?gate=v042748');
    const database=await import('./assets/js/database.js?gate=v042748');

    const snapshot=recognition.buildPublicMasterCatalogSnapshot('ingredients');
    const ingredientName='特選蛋';
    const row=snapshot.rows.find(item=>item.ingredient_name===ingredientName);
    if(!row)throw new Error('ingredient_master_missing:特選蛋');

    database.run(`INSERT INTO ingredient_inventory(ingredient_name,quantity,updated_at,source_update_id)
      VALUES(?,?,datetime('now'),?)
      ON CONFLICT(ingredient_name) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,
      [ingredientName,7,'V042748-SEED']);

    const payload={
      schema:recognition.PUBLIC_MASTER_RECOGNITION_SCHEMA,
      recognition_version:recognition.PUBLIC_MASTER_RECOGNITION_VERSION,
      scenario:snapshot.scenario,
      authority:snapshot.authority,
      data_version:snapshot.data_version,
      catalog_snapshot_id:snapshot.catalog_snapshot_id,
      generated_at:'2026-08-31T00:00:00.000Z',
      visible_target_count:1,
      observations:[{
        observation_id:'obs-zero-egg',
        status:'UNMATCHED',
        observed_text:ingredientName,
        observed_data:{quantity:0},
        source_image_ref:'IMG-ZERO-001',
        confidence:0,
        reason:'Target identified but not visible in the current snapshot',
      }],
    };

    const requiresBefore=zero.zeroObservationRequiresExplicitUserConfirmation(payload.observations[0]);
    const confirmed=zero.confirmIngredientZeroObservation(payload,'obs-zero-egg',ingredientName,{confirmedAt:'2026-08-31T00:00:01.000Z'});
    const requiresAfter=zero.zeroObservationRequiresExplicitUserConfirmation(confirmed.observations[0]);
    const validation=recognition.validatePublicMasterRecognitionPayload(confirmed,'ingredients');
    const compiled=recognition.compilePublicMasterRecognitionToUpdatePackage(confirmed,'ingredients');
    const operation=compiled.update_package.operations[0];
    const preview=importer.dryRun(compiled.update_package);
    const change=preview.changes[0];
    const applyResult=await importer.applyPayload(compiled.update_package);
    const stored=database.rows('SELECT ingredient_name,quantity FROM ingredient_inventory WHERE ingredient_name=?',[ingredientName])[0]||null;

    return {
      requiresBefore,
      requiresAfter,
      userResolution:confirmed.observations[0].user_resolution,
      validation:{ok:validation.ok,errors:validation.errors,unresolved:validation.unresolved},
      compiled:{ok:compiled.ok,operation},
      preview:{ready_count:preview.ready_count,conflict_count:preview.conflict_count,change},
      applyResult,
      stored,
    };
  });

  assert.equal(result.requiresBefore,true);
  assert.equal(result.requiresAfter,false);
  assert.equal(result.userResolution.action,'USER_CONFIRMED_ZERO');
  assert.equal(result.userResolution.confirmed_quantity,0);
  assert.equal(result.validation.ok,true);
  assert.deepEqual(result.validation.errors,[]);
  assert.equal(result.compiled.ok,true);
  assert.equal(result.compiled.operation.data.quantity,0);
  assert.equal(result.preview.conflict_count,0);
  assert.equal(result.preview.ready_count,1);
  assert.equal(result.preview.change.status,'ready');
  assert.equal(result.preview.change.after.quantity,0);
  assert.equal(result.applyResult.operation_count,1);
  assert.equal(result.stored.ingredient_name,'特選蛋');
  assert.equal(result.stored.quantity,0);

  console.log(JSON.stringify({status:'PASS',gate:'V042748_INGREDIENT_EXPLICIT_ZERO_DRYRUN_APPLY',result},null,2));
}finally{await browser.close();}
