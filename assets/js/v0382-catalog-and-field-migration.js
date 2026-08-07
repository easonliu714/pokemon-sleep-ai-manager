import './version-authority.js';

const BUILD=globalThis.PokemonSleepVersionAuthority.app_build;
const trace=(event,details={},status='completed',error=null)=>globalThis.DebugTrace?.record?.('v0382_migration',event,{status,details,error});

// Historical compatibility entry only. Public catalog schema and versioned
// master synchronization are governed by migrations.js after SQLite is ready.
// This module must never own a duplicate item list or start a timer-based write.
export async function applyV0382CatalogAndFieldMigration(){
  const detail={
    build:BUILD,
    delegated_to:'migrations.auditAndSyncPublicMasters',
    self_starting_write:false,
    player_tables_untouched:true,
  };
  trace('v0382_catalog_and_field_migration_delegated',detail);
  return detail;
}

globalThis.addEventListener?.('pokemon-sleep:database-ready',()=>{
  void applyV0382CatalogAndFieldMigration();
},{once:true});
