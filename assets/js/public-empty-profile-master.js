import {PUBLIC_ITEM_MASTER,PUBLIC_ITEM_MASTER_VERSION} from './public-item-master.js';

export function applyPublicEmptyProfileMaster(db){
  for(const item of PUBLIC_ITEM_MASTER){
    db.run(`INSERT INTO item_master(item_name,item_category,effect_description_zh_tw,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET
      item_category=excluded.item_category,
      effect_description_zh_tw=excluded.effect_description_zh_tw,
      source_type=excluded.source_type,
      source_name=excluded.source_name,
      source_ref=excluded.source_ref,
      verified_at=excluded.verified_at,
      data_version=excluded.data_version`,
      [item.item_name,item.item_category,item.effect_description_zh_tw,item.source_type,item.source_name,item.source_ref,item.verified_at,item.data_version]);
  }

  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_item_master_version',?,datetime('now'))`,[JSON.stringify(PUBLIC_ITEM_MASTER_VERSION)]);

  // Public master refresh only updates item_master. Player-owned inventory,
  // reserve, recommendation, recipe unlock, capacity and Pokémon rows remain untouched.
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at)
    VALUES('public_profile_contract',?,datetime('now'))`,[JSON.stringify({
      version:PUBLIC_ITEM_MASTER_VERSION,
      personal_seed:false,
      player_tables_untouched:true,
      item_effect_authority:'public-item-master.js',
      catalog_defaults:{quantity:0,recipe_unlocked:false},
      public_item_count:PUBLIC_ITEM_MASTER.length,
    })]);
}

// The commit gate is a browser-only controller. Dynamic loading here avoids a
// database-module cycle while ensuring it registers before the later
// multi-capture document-level transaction handler.
if(typeof window!=='undefined'){
  import('./canonical-commit-gate.js?v=20260804-v0379-canonical-commit-gate').catch((error)=>{
    console.error('Canonical commit gate load failed',error);
    globalThis.UpdateCenterLiveDebug?.record?.('canonical_commit_gate_load_failed',{message:error?.message||String(error)});
  });
}
