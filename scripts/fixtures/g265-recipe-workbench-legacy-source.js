// Frozen exact pre-admission saveRecipeState function from production Git blob 69a7cab3bf17e0b73299ce79b77d51bb68d961ad.
// Historical two-ACK counterexample only; never imported by the PWA.
async function saveRecipeState(row,{unlocked,level,energy}){
  if(!dbReady())throw new Error('目前為唯讀／尚未完成資料庫初始化，無法修改玩家料理狀態');
  const playerRecipeId=String(row.recipe_id),before=rows('SELECT * FROM recipes WHERE recipe_id=?',[playerRecipeId])[0]||null;
  const parsedLevel=level===''?null:Number(level),parsedEnergy=energy===''?null:Number(energy);
  if(parsedLevel!==null&&(!Number.isInteger(parsedLevel)||parsedLevel<1))throw new Error('料理等級必須為 1 以上整數');
  if(parsedEnergy!==null&&(!Number.isInteger(parsedEnergy)||parsedEnergy<0))throw new Error('目前能量必須為 0 以上整數');
  await snapshot(`manual:recipe:${playerRecipeId}`);begin();
  try{
    run(`INSERT INTO recipes(recipe_id,category,recipe_name,unlocked,total_ingredients,source,recipe_level,current_energy,updated_at,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(recipe_id) DO UPDATE SET unlocked=excluded.unlocked,recipe_level=excluded.recipe_level,current_energy=excluded.current_energy,updated_at=excluded.updated_at`,
      [playerRecipeId,row.category,row.recipe_name,unlocked?1:0,row.total_ingredients,'public_catalog_manual',parsedLevel,parsedEnergy,localIso(),'']);
    const after=rows('SELECT * FROM recipes WHERE recipe_id=?',[playerRecipeId])[0],updateId=`MANUAL-RECIPE-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
    run('INSERT INTO import_batches(update_id,schema_version,generated_at,imported_at,source,operation_count,result_json) VALUES(?,?,?,?,?,?,?)',[updateId,'manual-1.0',localIso(),localIso(),'manual_frontend_edit',1,JSON.stringify({status:'applied'})]);
    run('INSERT INTO import_changes(update_id,operation_index,entity,action,key_json,before_json,after_json,status,message) VALUES(?,?,?,?,?,?,?,?,?)',[updateId,0,'recipes','manual_update',JSON.stringify({recipe_id:playerRecipeId}),JSON.stringify(before),JSON.stringify(after),'applied','Unified Recipe Workbench 玩家料理狀態修改']);
    commit();await persist();return after;
  }catch(error){rollback();throw error;}
}

function bindTable(){}
