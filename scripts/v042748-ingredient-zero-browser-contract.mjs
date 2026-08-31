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
    const integrity=await import('./assets/js/ingredient-inventory-integrity-contract.js?gate=v042748');
    const successor=await import('./assets/js/ingredient-inferred-zero-integrity-v042748.js?gate=v042748');
    const importer=await import('./assets/js/importer.js?gate=v042748');
    const database=await import('./assets/js/database.js?gate=v042748');

    const snapshot=recognition.buildPublicMasterCatalogSnapshot('ingredients');
    const ingredientName='特選蛋';
    if(!snapshot.rows.some(row=>row.ingredient_name===ingredientName))throw new Error('ingredient_master_missing:特選蛋');

    database.run(`INSERT INTO ingredient_inventory(ingredient_name,quantity,unlocked,updated_at,source_update_id)
      VALUES(?,?,1,datetime('now'),?)
      ON CONFLICT(ingredient_name) DO UPDATE SET quantity=excluded.quantity,unlocked=1,updated_at=excluded.updated_at,source_update_id=excluded.source_update_id`,
      [ingredientName,7,'V042748-SEED']);

    const raw={
      schema:recognition.PUBLIC_MASTER_RECOGNITION_SCHEMA,
      recognition_version:recognition.PUBLIC_MASTER_RECOGNITION_VERSION,
      scenario:snapshot.scenario,
      authority:snapshot.authority,
      data_version:snapshot.data_version,
      catalog_snapshot_id:snapshot.catalog_snapshot_id,
      generated_at:'2026-08-31T00:00:00.000Z',
      visible_target_count:1,
      observations:[{
        observation_id:'obs-zero-egg',status:'UNMATCHED',observed_text:ingredientName,
        observed_data:{quantity:0},source_image_ref:'IMG-ZERO-001',confidence:0,
        reason:'Target identified but not visible in the current snapshot',
      }],
    };

    const matched=recognition.applyPublicMasterRecognitionResolution(raw,'ingredients','obs-zero-egg','MATCH',ingredientName);
    const compiled=recognition.compilePublicMasterRecognitionToUpdatePackage(matched,'ingredients',{allowedImageRefs:['IMG-ZERO-001']});
    const inferredAudit=successor.auditIngredientInferredZeroIntegrity(compiled.update_package);
    const established=database.rows(`SELECT ingredient_name,quantity,unlocked,unlock_state,player_record_exists FROM ingredient_catalog_state WHERE ingredient_name=?`,[ingredientName]);
    const candidates=integrity.buildIngredientAbsenceCandidates({
      coverage:'USER_CONFIRMED_COMPLETE',
      recognizedIngredientNames:successor.ingredientNamesWithDirectInventoryEvidence(compiled.update_package),
      establishedInventoryRows:established,
      confirmations:[],
    });
    const candidate=candidates[0]||null;
    if(!candidate)throw new Error('expected_integrity_review_candidate_missing');

    const confirmations=[{
      ingredient_name:ingredientName,previous_quantity:Number(candidate.previous_quantity),
      resolution:'CONFIRMED_EXHAUSTED',confirmed_by_user:true,confirmed_at:'2026-08-31T00:00:01.000Z',
    }];
    const promoted=successor.applyIngredientAbsenceConfirmationsWithInferredZeroPromotion(compiled.update_package,confirmations,{sourceImageRefs:['IMG-ZERO-001']});
    const validation=integrity.validateIngredientAbsenceConfirmationPackage(promoted,{coverage:'USER_CONFIRMED_COMPLETE'});
    const eggOps=promoted.operations.filter(operation=>operation?.key?.ingredient_name===ingredientName);
    const preview=importer.dryRun(promoted);
    const change=preview.changes.find(item=>item?.key?.ingredient_name===ingredientName)||preview.changes[0]||null;
    const applied=await importer.applyPayload(promoted);
    const stored=database.rows('SELECT ingredient_name,quantity,unlocked,source_update_id FROM ingredient_inventory WHERE ingredient_name=?',[ingredientName])[0]||null;

    return {
      recognition_user_resolution:matched.observations[0].user_resolution,
      compiled_ok:compiled.ok,
      inferredAudit,
      candidate,
      validation,
      eggOps,
      preview:{ready_count:preview.ready_count,conflict_count:preview.conflict_count,change},
      applied,
      stored,
    };
  });

  assert.equal(result.recognition_user_resolution.action,'USER_CONFIRMED_MATCH');
  assert.equal(result.compiled_ok,true);
  assert.deepEqual(result.inferredAudit.inferred_zero_names,['特選蛋']);
  assert.deepEqual(result.inferredAudit.direct_observed_names,[]);
  assert.equal(result.candidate.review_kind,'INVENTORY_QUANTITY_REVIEW');
  assert.equal(result.candidate.status,'REVIEW_REQUIRED');
  assert.equal(result.validation.ok,true,result.validation.errors?.join('\n'));
  assert.equal(result.eggOps.length,1);
  assert.equal(result.eggOps[0].data.quantity,0);
  assert.equal(result.eggOps[0].data.unlocked,1);
  assert.equal(result.eggOps[0].evidence.confirmed_by_user,true);
  assert.equal(result.eggOps[0].evidence.absence_reason,'CONFIRMED_EXHAUSTED');
  assert.equal(result.preview.conflict_count,0);
  assert.equal(result.preview.ready_count,1);
  assert.equal(result.preview.change.status,'ready');
  assert.equal(result.preview.change.after.quantity,0);
  assert.equal(result.preview.change.after.unlocked,1);
  assert.equal(result.applied.operation_count,1);
  assert.equal(result.stored.ingredient_name,'特選蛋');
  assert.equal(result.stored.quantity,0);
  assert.equal(result.stored.unlocked,1);

  console.log(JSON.stringify({status:'PASS',gate:'V042748_INGREDIENT_ZERO_BROWSER_DRYRUN_APPLY',result},null,2));
}finally{await browser.close();}
