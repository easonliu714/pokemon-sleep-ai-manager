import fs from 'node:fs';

function patch(path, transform) {
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after===before) throw new Error(`no change produced: ${path}`);
  fs.writeFileSync(path,after);
}
function mustReplace(source,from,to,label){if(!source.includes(from))throw new Error(`missing ${label}`);return source.replace(from,to);}
function all(source,from,to,label){if(!source.includes(from))throw new Error(`missing ${label}`);return source.split(from).join(to);}
const build='20260805-v0385-database-boot-isolation';

patch('assets/js/v0383-catalog-ocr-review-contract.js',source=>{
  source=all(source,"const APP_VERSION='v0.3.83';","const APP_VERSION='v0.3.85';",'contract version');
  source=all(source,"const APP_BUILD='20260805-v0383-catalog-ocr-review-contract';",`const APP_BUILD='${build}';`,'contract build');
  source=mustReplace(source,"const RECIPES=",'const RECIPES=','recipe registry anchor');
  source=mustReplace(source,
`let initialized=false,retryCount=0,retryTimer=null;
async function initialize(){
  if(initialized)return;
  if(!databaseReady()){
    retryCount+=1;trace('database_ready_wait',{retry_count:retryCount});
    clearTimeout(retryTimer);retryTimer=setTimeout(initialize,Math.min(2500,150+retryCount*100));return;
  }
  try{
    await applyRecipeCatalog();initialized=true;installOcrTerminalPatch();installServiceWorkerScopeRepair();
    globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
    trace('v0384_database_catalog_recovery_ready',{version:'v0.3.84',build:'20260805-v0384-database-catalog-recovery',retry_count:retryCount});
  }catch(error){trace('recipe_catalog_retryable_failed',{message:error?.message||String(error),retry_count:retryCount},'failed',error);clearTimeout(retryTimer);retryTimer=setTimeout(initialize,1000);}
}
initialize();globalThis.addEventListener('pokemon-sleep:database-ready',initialize);`,
`let initialized=false;
function initialize(){
  if(initialized)return;
  initialized=true;
  globalThis.PokemonSleepPublicRecipeRegistry=Object.freeze(RECIPES.map(([category,recipe_name,summary])=>Object.freeze({category,recipe_name,summary})));
  installOcrTerminalPatch();
  installServiceWorkerScopeRepair();
  globalThis.addEventListener('pokemon-sleep:analysis-revision-saved',event=>applyReviewProjection(event.detail));
  globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:public-recipe-registry-ready',{detail:{recipe_count:RECIPES.length,version:CATALOG_VERSION}}));
  trace('v0385_boot_isolation_ready',{version:'v0.3.85',build:'${build}',recipe_count:RECIPES.length,database_write_performed:false});
}
initialize();`,'v0384 initialize block');
  return source;
});

patch('assets/js/public-catalog-workbench.js',source=>{
  source=mustReplace(source,
    "const data=rows('SELECT *,MAX(0,quantity-safe_reserve) AS available FROM item_catalog_state ORDER BY item_category,item_name');",
    "const data=rows(`SELECT m.item_name,m.item_category,m.effect_description_zh_tw,m.effect_source_type,m.effect_source_ref,m.data_version,COALESCE(i.quantity,0) quantity,COALESCE(i.safe_reserve,0) safe_reserve,COALESCE(i.recommendation,'') recommendation,i.updated_at,CASE WHEN i.item_name IS NULL THEN 0 ELSE 1 END player_record_exists,MAX(0,COALESCE(i.quantity,0)-COALESCE(i.safe_reserve,0)) available FROM item_master m LEFT JOIN item_inventory i ON i.item_name=m.item_name ORDER BY m.item_category,m.item_name`);",
    'item catalog join');
  const start=source.indexOf('function renderRecipeCatalog(){');
  const end=source.indexOf('\n\nfunction renderCatalogStatus()',start);
  if(start<0||end<0)throw new Error('missing renderRecipeCatalog block');
  const replacement=`function publicRecipeRows(){
  const registry=Array.from(globalThis.PokemonSleepPublicRecipeRegistry||[]);
  const privateRows=rows('SELECT * FROM recipes');
  const privateByName=new Map(privateRows.map(row=>[row.recipe_name,row]));
  const slug=value=>'recipe_public_'+Array.from(new TextEncoder().encode(value)).reduce((h,b)=>((h*33)^b)>>>0,5381).toString(16).padStart(8,'0');
  const parse=summary=>String(summary||'').split('、').map(part=>{const m=part.match(/^(.*)×(\\d+)$/);return m?{name:m[1].trim(),quantity:Number(m[2])}:null;}).filter(Boolean);
  const publicRows=registry.map(item=>{
    const personal=privateByName.get(item.recipe_name)||null;
    const ingredients=parse(item.summary);
    return {recipe_id:personal?.recipe_id||slug(item.recipe_name),category:item.category,recipe_name:item.recipe_name,base_energy:null,total_ingredients:ingredients.reduce((s,x)=>s+x.quantity,0),unlocked:personal?.unlocked||0,recipe_level:personal?.recipe_level||1,current_energy:personal?.current_energy??null,updated_at:personal?.updated_at??null,notes:personal?.notes??null,player_record_exists:personal?1:0,data_version:'canonical-registry-v0385-static',ingredients,summary:item.summary};
  });
  const publicNames=new Set(publicRows.map(row=>row.recipe_name));
  return [...publicRows,...privateRows.filter(row=>!publicNames.has(row.recipe_name)).map(row=>({...row,ingredients:[],summary:'',data_version:'PLAYER_ONLY',player_record_exists:1}))];
}
function renderRecipeCatalog(){
  const table=$('recipeTable');if(!table)return;
  const data=publicRecipeRows().sort((a,b)=>String(a.category).localeCompare(String(b.category),'zh-Hant')||String(a.recipe_name).localeCompare(String(b.recipe_name),'zh-Hant'));
  const notice=document.querySelector('#recipes .notice');if(notice)notice.textContent=\`公版主檔 \${data.filter(row=>row.data_version!=='PLAYER_ONLY').length} 筆；公版預設未解鎖、料理等級 1，只有玩家手動儲存、圖片確認或 JSON 匯入才建立私人紀錄。\`;
  table.innerHTML=\`<thead><tr><th>分類</th><th>料理</th><th>基礎能量</th><th>配方</th><th>已解鎖</th><th>料理等級</th><th>目前能量</th><th>主檔版本</th><th>操作</th></tr></thead><tbody>\${data.map(row=>\`<tr><td>\${esc(row.category)}</td><td>\${esc(row.recipe_name)}</td><td>\${esc(row.base_energy??'—')}</td><td>\${esc(row.summary||'—')}</td><td><input class="canonical-recipe-unlocked" type="checkbox" \${row.unlocked?'checked':''} data-id="\${esc(row.recipe_id)}"></td><td><input class="inline-number canonical-recipe-level" type="number" min="1" value="\${esc(row.recipe_level??1)}" data-id="\${esc(row.recipe_id)}"></td><td><input class="inline-number canonical-recipe-energy" type="number" min="0" value="\${esc(row.current_energy??'')}" data-id="\${esc(row.recipe_id)}"></td><td>\${esc(row.data_version||'')}</td><td><button class="canonical-save-recipe" data-id="\${esc(row.recipe_id)}">儲存</button></td></tr>\`).join('')}</tbody>\`;
  table.querySelectorAll('.canonical-save-recipe').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.id,row=data.find(item=>item.recipe_id===id),selector=CSS.escape(id);
    const unlocked=table.querySelector(\`.canonical-recipe-unlocked[data-id="\${selector}"]\`).checked;
    const level=table.querySelector(\`.canonical-recipe-level[data-id="\${selector}"]\`).value;
    const energy=table.querySelector(\`.canonical-recipe-energy[data-id="\${selector}"]\`).value;
    try{await saveRecipeState(row,unlocked,level,energy);renderRecipeCatalog();window.dispatchEvent(new CustomEvent('pokemon-sleep:data-changed',{detail:{entity:'recipes',operation:'manual_upsert'}}));}catch(error){alert(error.message);}
  }));
}`;
  source=source.slice(0,start)+replacement+source.slice(end);
  source=mustReplace(source,"window.addEventListener('pokemon-sleep:data-changed',scheduleRender);window.addEventListener('pageshow',scheduleRender);","window.addEventListener('pokemon-sleep:data-changed',scheduleRender);window.addEventListener('pokemon-sleep:public-recipe-registry-ready',scheduleRender);window.addEventListener('pageshow',scheduleRender);",'catalog event');
  return source;
});

for(const [path,pairs] of Object.entries({
  'assets/js/bootstrap.js':[['v0.3.84','v0.3.85'],['20260805-v0384-database-catalog-recovery',build]],
  'service-worker.js':[['v0.3.84','v0.3.85'],['20260805-v0384-database-catalog-recovery',build],['pokemon-sleep-ai-v0.3.85-v0384-database-catalog-recovery','pokemon-sleep-ai-v0.3.85-v0385-database-boot-isolation']],
  'index.html':[['20260805-v0384-database-catalog-recovery',build]],
  'assets/js/v0382-release-authority.js':[['v0.3.84','v0.3.85'],['20260805-v0384-database-catalog-recovery',build]]
}))patch(path,source=>pairs.reduce((s,[a,b])=>all(s,a,b,`${path}:${a}`),source));

console.log('v0.3.85 boot isolation patch applied');
