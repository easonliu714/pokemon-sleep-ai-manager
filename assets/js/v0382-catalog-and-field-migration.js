import {run,persist} from './database.js';

const VERSION='canonical-registry-2026-08-05-a';
const BUILD='20260805-v0382-file-snapshot-public-catalog';
const ITEM_EFFECTS=[
  ['大師沙布蕾','biscuit','能讓寶可夢的親密度直接達到最大。'],
  ['高級沙布蕾','biscuit','餵給寶可夢後，可增加3格親密度。'],
  ['超級沙布蕾','biscuit','餵給寶可夢後，可增加5格親密度。'],
  ['寶可沙布蕾','biscuit','餵給寶可夢後，可增加1格親密度。'],
  ['主技能種子','skill_seed','使寶可夢的主技能等級提升1級。'],
  ['副技能種子','skill_seed','使可提升的副技能品質提升1階。'],
  ['回復薰香','incense','睡眠研究後，幫手寶可夢回復的活力變為2倍；使用一次後消耗。'],
  ['專注薰香','incense','睡眠研究後獲得的研究EXP變為2倍；使用一次後消耗。'],
  ['幸運薰香','incense','睡眠研究後獲得的夢之碎片變為2倍；使用一次後消耗。'],
  ['成長薰香','incense','睡眠研究後幫手寶可夢獲得的EXP變為2倍；使用一次後消耗。'],
  ['友好薰香','incense','點心時間至少會有1隻寶可夢以肚子餓狀態出現；使用一次後消耗。'],
  ['活力枕頭','recovery','使1隻幫手寶可夢回復50點活力。'],
  ['幫手哨子','helper','立即獲得目前隊伍約3小時份的樹果與食材；不會觸發主技能。'],
  ['食材券S','ingredient_ticket','可兌換10個隨機料理食材。'],
  ['食材券M','ingredient_ticket','可兌換30個隨機料理食材。'],
  ['食材券L','ingredient_ticket','可兌換100個隨機料理食材。'],
  ['萬能糖果S','candy','可轉換為任一寶可夢的糖果3個。'],
  ['萬能糖果M','candy','可轉換為任一寶可夢的糖果20個。'],
  ['萬能糖果L','candy','可轉換為任一寶可夢的糖果100個。'],
  ['營地移動券','ticket','可在任何時間移動到已解鎖的營地。'],
  ['好露營券','ticket','可使用好露營組合7天，協助睡眠研究與培育卡比獸。'],
  ['夢之塊S','dream_cluster','使用後可獲得依研究等級變動的夢之碎片。'],
  ['夢之塊M','dream_cluster','使用後可獲得依研究等級變動的夢之碎片。'],
  ['夢之塊L','dream_cluster','使用後可獲得依研究等級變動的夢之碎片。'],
  ['火之石','evolution','能讓特定寶可夢進化的特殊石頭。'],['水之石','evolution','能讓特定寶可夢進化的特殊石頭。'],
  ['雷之石','evolution','能讓特定寶可夢進化的特殊石頭。'],['葉之石','evolution','能讓特定寶可夢進化的特殊石頭。'],
  ['冰之石','evolution','能讓特定寶可夢進化的特殊石頭。'],['月之石','evolution','能讓特定寶可夢進化的特殊石頭。'],
  ['光之石','evolution','能讓特定寶可夢進化的特殊石頭。'],['暗之石','evolution','能讓特定寶可夢進化的特殊石頭。'],
  ['覺醒之石','evolution','能讓特定寶可夢進化的特殊石頭。'],['渾圓之石','evolution','能讓特定寶可夢進化的特殊石頭。'],
  ['王者之證','evolution','能讓特定寶可夢進化的特殊道具。'],['聯繫繩','evolution','散發不可思議能量、可讓特定寶可夢進化的繩子。'],
  ['金屬膜','evolution','能讓特定寶可夢進化的特殊金屬膜。'],['銳利之爪','evolution','能讓特定寶可夢進化的特殊道具。']
];
const trace=(event,details={},status='completed',error=null)=>globalThis.DebugTrace?.record?.('v0382_migration',event,{status,details,error});

function addColumn(table,column,definition){try{run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);}catch(error){if(!/duplicate column name/i.test(error?.message||''))throw error;}}
async function apply(){
  try{
    for(const [name,definition] of Object.entries({gender:'TEXT',current_energy:'REAL',species_candy_count:'INTEGER',exp_to_next_level:'INTEGER',encounter_location:'TEXT',encountered_at:'TEXT',berry_quantity:'INTEGER'}))addColumn('pokemon',name,definition);
    addColumn('item_master','effect_description_zh_tw','TEXT');addColumn('item_master','effect_source_type','TEXT');addColumn('item_master','effect_source_ref','TEXT');
    for(const [name,category,effect] of ITEM_EFFECTS){
      run(`INSERT INTO item_master(item_name,item_category,source_type,source_name,source_ref,verified_at,data_version,effect_description_zh_tw,effect_source_type,effect_source_ref)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(item_name) DO UPDATE SET item_category=excluded.item_category,data_version=excluded.data_version,effect_description_zh_tw=excluded.effect_description_zh_tw,effect_source_type=excluded.effect_source_type,effect_source_ref=excluded.effect_source_ref`,
        [name,category,'mixed_verified_reference','Pokémon Sleep official terminology first; structured reference supplemental','official-game-text-and-structured-reference','2026-08-05',VERSION,effect,'official_or_game_text_preferred','pokemon-sleep-official-and-serebii-cross-check']);
    }
    run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('v0382_catalog_revision',?,datetime('now'))`,[JSON.stringify({version:VERSION,item_count:ITEM_EFFECTS.length,player_tables_untouched:true,build:BUILD})]);
    await persist();trace('v0382_catalog_and_field_migration_completed',{version:VERSION,item_count:ITEM_EFFECTS.length});
    globalThis.dispatchEvent(new CustomEvent('pokemon-sleep:catalog-updated',{detail:{version:VERSION}}));
  }catch(error){trace('v0382_catalog_and_field_migration_failed',{message:error?.message||String(error)},'failed',error);}
}
setTimeout(apply,1500);
export {apply as applyV0382CatalogAndFieldMigration};
