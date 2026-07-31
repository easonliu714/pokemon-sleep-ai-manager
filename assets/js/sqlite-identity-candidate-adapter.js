const array=value=>Array.isArray(value)?value:[];

function normalizeResult(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.rows))return result.rows;
  if(Array.isArray(result?.values)&&Array.isArray(result?.columns)){
    return result.values.map(values=>Object.fromEntries(result.columns.map((column,index)=>[column,values[index]])));
  }
  return [];
}

async function queryAll(db,sql,params=[]){
  if(typeof db?.all==='function'){
    const result=await db.all(sql,params);
    return normalizeResult(result);
  }
  if(typeof db?.query==='function'){
    const result=await db.query(sql,params);
    return normalizeResult(result);
  }
  if(typeof db?.exec==='function'){
    const result=await db.exec(sql,params);
    if(Array.isArray(result)&&result.length===1)return normalizeResult(result[0]);
    return normalizeResult(result);
  }
  throw new TypeError('SQLite adapter requires db.all, db.query, or db.exec');
}

const DEFAULT_SQL={
  instances:`
    SELECT
      pi.pokemon_instance_id,
      pi.pokemon_id,
      pi.update_token,
      pi.nickname,
      pi.species,
      pi.current_species,
      pi.capture_species,
      pi.level,
      pi.nature,
      pi.specialty,
      pi.type,
      pi.main_skill,
      pi.registered_date
    FROM pokemon_instance pi
  `,
  ingredients:`
    SELECT pokemon_instance_id, unlock_level, ingredient_name
    FROM pokemon_instance_ingredient
    ORDER BY pokemon_instance_id, unlock_level
  `,
  subskills:`
    SELECT pokemon_instance_id, unlock_level, subskill_name
    FROM pokemon_instance_subskill
    ORDER BY pokemon_instance_id, unlock_level
  `,
  evolution:`
    SELECT pokemon_instance_id, species_name
    FROM pokemon_instance_evolution_chain
    ORDER BY pokemon_instance_id, evolution_order
  `
};

export function createSqliteIdentityCandidateAdapter(db,{sql={}}={}){
  const statements={...DEFAULT_SQL,...sql};
  return {
    async loadCandidates(){
      const [instances,ingredients,subskills,evolution]=await Promise.all([
        queryAll(db,statements.instances),
        queryAll(db,statements.ingredients),
        queryAll(db,statements.subskills),
        queryAll(db,statements.evolution)
      ]);
      const ingredientMap=new Map();
      const subskillMap=new Map();
      const evolutionMap=new Map();
      for(const row of array(ingredients)){
        const key=row.pokemon_instance_id;
        if(!ingredientMap.has(key))ingredientMap.set(key,[]);
        ingredientMap.get(key).push({unlock_level:Number(row.unlock_level),ingredient_name:row.ingredient_name});
      }
      for(const row of array(subskills)){
        const key=row.pokemon_instance_id;
        if(!subskillMap.has(key))subskillMap.set(key,[]);
        subskillMap.get(key).push({unlock_level:Number(row.unlock_level),subskill_name:row.subskill_name});
      }
      for(const row of array(evolution)){
        const key=row.pokemon_instance_id;
        if(!evolutionMap.has(key))evolutionMap.set(key,[]);
        if(row.species_name)evolutionMap.get(key).push(row.species_name);
      }
      return array(instances).map(row=>({
        ...row,
        level:row.level==null?null:Number(row.level),
        ingredients:ingredientMap.get(row.pokemon_instance_id)||[],
        subskills:subskillMap.get(row.pokemon_instance_id)||[],
        evolution_chain_species:evolutionMap.get(row.pokemon_instance_id)||[]
      }));
    }
  };
}

export {DEFAULT_SQL as SQLITE_IDENTITY_CANDIDATE_SQL};
