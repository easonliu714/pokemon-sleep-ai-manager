import fs from 'node:fs';

function replace(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`patch target missing: ${path}: ${from.slice(0,80)}`);
  fs.writeFileSync(path, source.replace(from, to));
}
function replaceAll(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`patch target missing: ${path}`);
  fs.writeFileSync(path, source.split(from).join(to));
}

const build='20260805-v0384-database-catalog-recovery';

replace('assets/js/v0383-catalog-ocr-review-contract.js',
  "const match=part.match(/^(.*)×(\\\\d+)$/);",
  "const match=part.match(/^(.*)×(\\d+)$/);");

replace('assets/js/v0383-catalog-ocr-review-contract.js',
  "async function applyRecipeCatalog(){\n  run('DROP VIEW IF EXISTS recipe_catalog_state');",
  `function databaseReady(){try{return Number(rows('SELECT COUNT(*) AS count FROM schema_migrations')[0]?.count||0)>0;}catch{return false;}}\n\nasync function applyRecipeCatalog(){\n  if(!databaseReady())throw new Error('database_not_ready');\n  run('DROP VIEW IF EXISTS item_catalog_state');\n  run(\`CREATE VIEW item_catalog_state AS\n    SELECT m.item_name,m.item_category,m.effect_description_zh_tw,m.effect_source_type,m.effect_source_ref,\n           COALESCE(i.quantity,0) AS quantity,COALESCE(i.safe_reserve,0) AS safe_reserve,i.recommendation,\n           CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END AS player_record_exists,i.updated_at,m.data_version\n      FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name\`);\n  run('DROP VIEW IF EXISTS recipe_catalog_state');`);

replace('assets/js/v0383-catalog-ocr-review-contract.js',
  "    for(const item of ingredients)run('INSERT OR REPLACE INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)',[actual,item.name,item.quantity]);",
  "    for(const item of ingredients){run(`INSERT OR IGNORE INTO ingredient_master(ingredient_name,source_type,source_name,source_ref,verified_at,data_version) VALUES(?,?,?,?,?,?)`,[item.name,'mixed_evidence','v0.3.84 recipe catalog recovery','v0384-recipe-evidence','2026-08-05',CATALOG_VERSION]);run('INSERT OR REPLACE INTO recipe_master_ingredients(recipe_id,ingredient_name,quantity) VALUES(?,?,?)',[actual,item.name,item.quantity]);}");

replace('assets/js/v0383-catalog-ocr-review-contract.js',
`async function initialize(){
  try{await applyRecipeCatalog();}catch(error){trace('recipe_catalog_failed',{message:error?.message||String(error)},'failed',error);}
  installOcrTerminalPatch();
  installServiceWorkerScopeRepair();
  globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
  trace('v0383_contract_ready',{version:APP_VERSION,build:APP_BUILD});
}
setTimeout(initialize,1800);`,
`let initialized=false,retryCount=0,retryTimer=null;
async function initialize(){
  if(initialized)return;
  if(!databaseReady()){
    retryCount+=1;
    trace('database_ready_wait',{retry_count:retryCount});
    clearTimeout(retryTimer);retryTimer=setTimeout(initialize,Math.min(2500,150+retryCount*100));
    return;
  }
  try{
    await applyRecipeCatalog();
    initialized=true;
    installOcrTerminalPatch();
    installServiceWorkerScopeRepair();
    globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
    trace('v0384_database_catalog_recovery_ready',{version:'v0.3.84',build:'${build}',retry_count:retryCount});
  }catch(error){
    trace('recipe_catalog_retryable_failed',{message:error?.message||String(error),retry_count:retryCount},'failed',error);
    clearTimeout(retryTimer);retryTimer=setTimeout(initialize,1000);
  }
}
initialize();
globalThis.addEventListener('pokemon-sleep:database-ready',initialize);`);

replace('assets/js/public-catalog-workbench.js',
  "<td><textarea class=\"inline-text canonical-item-note\" data-name=\"${esc(row.item_name)}\">${esc(row.recommendation||'')}</textarea></td>",
  "<td><div class=\"notice canonical-item-effect\"><strong>功能：</strong>${esc(row.effect_description_zh_tw||'官方說明待補')}</div><textarea class=\"inline-text canonical-item-note\" data-name=\"${esc(row.item_name)}\" placeholder=\"玩家備註\">${esc(row.recommendation||'')}</textarea></td>");

replace('assets/js/pokemon-detail.js',
  "<div class=\"skill-item\"><b>Lv${l}</b><span>${x?`${esc(x.ingredient_name)}${x.quantity?` × ${x.quantity}`:''}`:'<span class=\"unknown\">尚未匯入</span>'}</span></div>",
  "<div class=\"skill-item\"><b>Lv${l}${Number(p.level)>=l?' ✓':''}</b><span>${x?`${esc(x.ingredient_name)}${x.quantity?` × ${x.quantity}`:''}`:'<span class=\"unknown\">尚未匯入</span>'}</span></div>");
replace('assets/js/pokemon-detail.js',
  "<div class=\"skill-item\"><b>Lv${l}${x?.is_unlocked?' ✓':''}</b><span>${x?esc(x.subskill_name):'<span class=\"unknown\">尚未匯入</span>'}</span></div>",
  "<div class=\"skill-item\"><b>Lv${l}${x&&(x.is_unlocked||Number(p.level)>=l)?' ✓':''}</b><span>${x?esc(x.subskill_name):'<span class=\"unknown\">尚未匯入</span>'}</span></div>");
replace('assets/js/pokemon-detail.js',
  "${sub(l).is_unlocked?'checked':''}> 已解鎖",
  "${sub(l).is_unlocked||Number(p.level)>=l?'checked':''}> 已解鎖");

replaceAll('assets/js/bootstrap.js','v0.3.83','v0.3.84');
replaceAll('assets/js/bootstrap.js','20260805-v0383-catalog-ocr-review-contract',build);
replaceAll('service-worker.js','v0.3.83','v0.3.84');
replaceAll('service-worker.js','20260805-v0383-catalog-ocr-review-contract',build);
replaceAll('service-worker.js','pokemon-sleep-ai-v0.3.84-v0383-catalog-ocr-review-contract','pokemon-sleep-ai-v0.3.84-v0384-database-catalog-recovery');
replaceAll('index.html','20260805-v0383-catalog-ocr-review-contract',build);
replaceAll('assets/js/v0382-release-authority.js','v0.3.83','v0.3.84');
replaceAll('assets/js/v0382-release-authority.js','20260805-v0383-catalog-ocr-review-contract',build);

console.log('v0.3.84 recovery patch applied');
