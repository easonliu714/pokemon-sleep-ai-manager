export const PUBLIC_POKEMON_KNOWLEDGE_VERSION='pokemon-knowledge-2026-08-08-b';

const BASE_SOURCE=Object.freeze({
  source_type:'official_first_reference_verified',
  source_name:'Pokémon Sleep official notices + current reference verification',
  verified_at:'2026-08-08',
  data_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
});

// Nature effect directions are public game knowledge. Percent modifiers are
// deliberately not inferred here; only the game-visible boosted/reduced axis
// is projected into player Pokémon details.
export const PUBLIC_NATURE_MASTER=Object.freeze([
  ['勤奮','無','無'],['怕寂寞','幫忙速度','活力回復量'],['固執','幫忙速度','食材機率'],['頑皮','幫忙速度','主技能發動機率'],['勇敢','幫忙速度','EXP獲得量'],
  ['大膽','活力回復量','幫忙速度'],['坦率','無','無'],['淘氣','活力回復量','食材機率'],['樂天','活力回復量','主技能發動機率'],['悠閒','活力回復量','EXP獲得量'],
  ['內斂','食材機率','幫忙速度'],['慢吞吞','食材機率','活力回復量'],['害羞','無','無'],['馬虎','食材機率','主技能發動機率'],['冷靜','食材機率','EXP獲得量'],
  ['溫和','主技能發動機率','幫忙速度'],['溫順','主技能發動機率','活力回復量'],['慎重','主技能發動機率','食材機率'],['浮躁','無','無'],['自大','主技能發動機率','EXP獲得量'],
  ['膽小','EXP獲得量','幫忙速度'],['急躁','EXP獲得量','活力回復量'],['爽朗','EXP獲得量','食材機率'],['天真','EXP獲得量','主技能發動機率'],['認真','無','無'],
].map(([nature_name,positive_effect,negative_effect])=>Object.freeze({
  nature_name,positive_effect,negative_effect,
  description_zh_tw:positive_effect==='無'&&negative_effect==='無'?'沒有提升或降低的性格效果。':`提升：${positive_effect}；降低：${negative_effect}。`,
  source_ref:'https://www.serebii.net/pokemonsleep/natures.shtml',...BASE_SOURCE,
})));

const SKILL=(main_skill_name,description_zh_tw,source_ref,verification_status='REFERENCE_VERIFIED')=>Object.freeze({main_skill_name,description_zh_tw,source_ref,verification_status,...BASE_SOURCE});
export const PUBLIC_MAIN_SKILL_MASTER=Object.freeze([
  SKILL('活力全體療癒S','讓幫手隊伍的所有寶可夢回復活力。','https://www.pokemonsleep.net/zh/news/323436343633383531373435323437323333/','OFFICIAL_VERIFIED'),
  SKILL('活力療癒S','讓隊伍中的幫手寶可夢回復活力。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('活力填充S','讓使用者自身回復活力。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('能量填充S','增加卡比獸的能量；效果量依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('能量填充M','大量增加卡比獸的能量；效果量依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333730373330303838373837383639363937/','OFFICIAL_NAME_VERIFIED'),
  SKILL('料理成功S','提升下一次料理漂亮成功的機率；效果依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('料理成功率提升S','提升下一次料理漂亮成功的機率；此名稱保留供既有玩家資料相容。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','COMPATIBILITY_ALIAS'),
  SKILL('料理強化S','增加下一次料理可放入的食材數量；效果依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('食材獲取S','隨機獲得食材；獲得量依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('食材精選S','從特定食材候選中隨機選擇1種食材取得；獲得量依主技能等級而異。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('幫手支援S','讓幫手寶可夢立即進行額外幫忙；效果依主技能等級而異。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('夢之碎片獲取S','獲得夢之碎片；獲得量依主技能等級而異。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_NAME_VERIFIED'),
  SKILL('夢之碎片獲取M','獲得夢之碎片；獲得量依主技能等級而異。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('揮指','隨機發動其他主技能的效果。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_VERIFIED'),
  SKILL('十項全能','發動已設置的主技能效果，並獲得隊伍中1隻寶可夢的糖果。','https://www.pokemonsleep.net/zh/news/333832393735353631373931373030393935/','OFFICIAL_VERIFIED'),
  SKILL('蓄力（能量填充S）','累積蓄力；發動噴出時依蓄力次數增加卡比獸能量，之後重置蓄力次數。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('樹果遽增','獲得自己的樹果，並獲得隊伍中其他寶可夢會撿來的樹果。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('樹果速增','獲得自己的樹果，並獲得隊伍中其他寶可夢會撿來的樹果；此舊名稱保留供既有玩家資料相容。','https://www.serebii.net/pokemonsleep/skills.shtml','COMPATIBILITY_ALIAS'),
  SKILL('禮物（食材獲取S）','隨機獲得食材；有時會額外獲得隊伍中1隻寶可夢的糖果。','https://www.serebii.net/pokemonsleep/skills.shtml'),
  SKILL('夢魘（能量填充M）','大量增加卡比獸的能量，但會讓隊伍中惡屬性以外的幫手寶可夢活力稍微減少。','https://www.pokemonsleep.net/zh/news/323536313935363036303134333238383333/','OFFICIAL_VERIFIED'),
  SKILL('夢魘','大量增加卡比獸的能量；此簡稱映射到「夢魘（能量填充M）」的公版說明。','https://www.pokemonsleep.net/zh/news/323536313935363036303134333238383333/','COMPATIBILITY_ALIAS'),
  SKILL('新月祈禱（活力全體療癒S）','讓隊伍所有寶可夢回復活力，並獲得隊伍中寶可夢會撿來的樹果。','https://www.pokemonsleep.net/zh/news/323436343633383531373435323437323333/','OFFICIAL_VERIFIED'),
  SKILL('樹果汁（活力全體療癒S）','讓隊伍所有寶可夢回復活力；有時還會額外獲得「樹果汁」。','https://www.pokemonsleep.net/zh/news/333532393338323736383037353037393639/','OFFICIAL_VERIFIED'),
  SKILL('健美（料理輔助S）','隨機獲得多個食材，且料理漂亮成功的機率稍微提升。','https://www.pokemonsleep.net/zh/news/333730373330303838373837383639363937/','OFFICIAL_VERIFIED'),
  SKILL('流星群（樹果遽增）','獲得自己以及隊伍中的寶可夢會撿來的樹果；龍屬性隊伍組成會影響獲得量。','https://www.pokemonsleep.net/zh/news/343031343531353932363432393835393839/','OFFICIAL_VERIFIED'),
  SKILL('流星群（樹果速增）','獲得自己以及隊伍中的寶可夢會撿來的樹果；此舊名稱保留供既有玩家資料相容。','https://www.pokemonsleep.net/zh/news/343031343531353932363432393835393839/','COMPATIBILITY_ALIAS'),
  SKILL('治癒波動（活力療癒S）','隨機讓隊伍的2隻寶可夢回復活力，並讓牠們立刻完成一定次數的幫忙。','https://www.pokemonsleep.net/zh/news/333831353535333734393439343030353833/','OFFICIAL_VERIFIED'),
  SKILL('治癒波動','隨機讓隊伍的2隻寶可夢回復活力，並讓牠們立刻完成一定次數的幫忙。','https://www.pokemonsleep.net/zh/news/333831353535333734393439343030353833/','COMPATIBILITY_ALIAS'),
]);

const EVO=(from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,other_requirement,source_ref)=>Object.freeze({
  from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,other_requirement,
  source_ref,verification_status:'REFERENCE_VERIFIED',...BASE_SOURCE,
});
const EVO_STATUS=(species_name,evolution_status,source_ref,verification_status='REFERENCE_VERIFIED')=>Object.freeze({
  species_name,evolution_status,source_ref,verification_status,...BASE_SOURCE,
});

// Only source-verified routes are seeded. Missing rows mean "public master not
// yet verified", never "this Pokémon cannot evolve".
export const PUBLIC_EVOLUTION_MASTER=Object.freeze([
  EVO('妙蛙種子','妙蛙草',12,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/bulbasaur.shtml'),
  EVO('妙蛙草','妙蛙花',24,null,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/bulbasaur.shtml'),
  EVO('小火龍','火恐龍',12,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/charmander.shtml'),
  EVO('火恐龍','噴火龍',27,null,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/charmander.shtml'),
  EVO('傑尼龜','卡咪龜',12,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/squirtle.shtml'),
  EVO('卡咪龜','水箭龜',27,null,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/squirtle.shtml'),
  EVO('小果然','果然翁',11,null,20,null,null,'https://www.serebii.net/pokemonsleep/pokemon/wynaut.shtml'),
  EVO('小拳石','隆隆石',19,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/geodude.shtml'),
  EVO('隆隆石','隆隆岩',null,null,80,'連結繩',null,'https://www.serebii.net/pokemonsleep/pokemon/geodude.shtml'),
  EVO('小磁怪','三合一磁怪',23,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/magnemite.shtml'),
  EVO('三合一磁怪','自爆磁怪',null,null,80,'雷之石',null,'https://www.serebii.net/pokemonsleep/pokemon/magnemite.shtml'),
  EVO('不良蛙','毒骷蛙',28,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/croagunk.shtml'),
  EVO('六尾','九尾',null,null,80,'火之石',null,'https://www.serebii.net/pokemonsleep/pokemon/vulpix.shtml'),
  EVO('皮丘','皮卡丘',null,50,20,null,null,'https://www.serebii.net/pokemonsleep/pokemon/pichu.shtml'),
  EVO('皮卡丘','雷丘',null,null,80,'雷之石',null,'https://www.serebii.net/pokemonsleep/pokemon/pichu.shtml'),
  EVO('咩利羊','茸茸羊',11,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/mareep.shtml'),
  EVO('茸茸羊','電龍',23,null,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/mareep.shtml'),
  EVO('懶人獺','過動猿',14,null,40,null,null,'https://www.serebii.net/pokemonsleep/pokemon/slakoth.shtml'),
  EVO('過動猿','請假王',27,null,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/slakoth.shtml'),
  EVO('利歐路','路卡利歐',null,150,80,null,'6:00～18:00 之間進化','https://www.serebii.net/pokemonsleep/pokemon/riolu.shtml'),
  EVO('小福蛋','吉利蛋',null,null,80,'渾圓之石','6:00～18:00 之間進化','https://www.serebii.net/pokemonsleep/pokemon/happiny.shtml'),
  EVO('吉利蛋','幸福蛋',null,150,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/chansey.shtml'),
  EVO('伊布','水伊布',null,null,80,'水之石',null,'https://www.serebii.net/pokemonsleep/pokemon/vaporeon.shtml'),
  EVO('伊布','雷伊布',null,null,80,'雷之石',null,'https://www.serebii.net/pokemonsleep/pokemon/jolteon.shtml'),
  EVO('伊布','火伊布',null,null,80,'火之石',null,'https://www.serebii.net/pokemonsleep/pokemon/vaporeon.shtml'),
  EVO('伊布','太陽伊布',null,150,80,null,'6:00～18:00 之間進化','https://www.serebii.net/pokemonsleep/pokemon/espeon.shtml'),
  EVO('伊布','月亮伊布',null,150,80,null,'18:00～6:00 之間進化','https://www.serebii.net/pokemonsleep/pokemon/umbreon.shtml'),
  EVO('伊布','葉伊布',null,null,80,'葉之石',null,'https://www.serebii.net/pokemonsleep/pokemon/leafeon.shtml'),
  EVO('伊布','冰伊布',null,null,80,'冰之石',null,'https://www.serebii.net/pokemonsleep/pokemon/glaceon.shtml'),
  EVO('伊布','仙子伊布',null,150,80,null,null,'https://www.serebii.net/pokemonsleep/pokemon/sylveon.shtml'),
]);

// A terminal row is source-verified for the current Pokémon Sleep public
// reference only. It does not assert that the franchise can never add another
// evolution in a future game update.
export const PUBLIC_EVOLUTION_STATUS_MASTER=Object.freeze([
  EVO_STATUS('果然翁','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/wynaut.shtml'),
  EVO_STATUS('隆隆岩','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/geodude.shtml'),
  EVO_STATUS('自爆磁怪','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/magnemite.shtml'),
  EVO_STATUS('毒骷蛙','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/croagunk.shtml'),
  EVO_STATUS('九尾','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/vulpix.shtml'),
  EVO_STATUS('巴大蝶','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/butterfree.shtml'),
  EVO_STATUS('土王','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/clodsire.shtml'),
  EVO_STATUS('七夕青鳥','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/altaria.shtml'),
  EVO_STATUS('火暴獸','VERIFIED_TERMINAL_CURRENT_SLEEP','https://www.serebii.net/pokemonsleep/pokemon/typhlosion.shtml'),
]);

export function applyPublicPokemonKnowledgeSchema(db){
  db.run(`CREATE TABLE IF NOT EXISTS nature_master(
    nature_name TEXT PRIMARY KEY,positive_effect TEXT,negative_effect TEXT,description_zh_tw TEXT,
    source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS main_skill_master(
    main_skill_name TEXT PRIMARY KEY,description_zh_tw TEXT,verification_status TEXT NOT NULL,
    source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pokemon_evolution_master(
    from_species TEXT NOT NULL,to_species TEXT NOT NULL,required_level INTEGER,required_sleep_hours REAL,required_candy INTEGER,
    required_item TEXT,other_requirement TEXT,verification_status TEXT NOT NULL,
    source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL,
    PRIMARY KEY(from_species,to_species)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pokemon_evolution_status_master(
    species_name TEXT PRIMARY KEY,evolution_status TEXT NOT NULL,verification_status TEXT NOT NULL,
    source_type TEXT NOT NULL,source_name TEXT NOT NULL,source_ref TEXT,verified_at TEXT,data_version TEXT NOT NULL
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_public_evolution_from_species ON pokemon_evolution_master(from_species)');
  db.run('CREATE INDEX IF NOT EXISTS idx_public_evolution_status ON pokemon_evolution_status_master(evolution_status)');
}

export function applyPublicPokemonKnowledgeData(db){
  applyPublicPokemonKnowledgeSchema(db);
  for(const row of PUBLIC_NATURE_MASTER){
    db.run(`INSERT INTO nature_master(nature_name,positive_effect,negative_effect,description_zh_tw,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(nature_name) DO UPDATE SET positive_effect=excluded.positive_effect,negative_effect=excluded.negative_effect,
      description_zh_tw=excluded.description_zh_tw,source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,
      verified_at=excluded.verified_at,data_version=excluded.data_version`,[row.nature_name,row.positive_effect,row.negative_effect,row.description_zh_tw,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version]);
  }
  for(const row of PUBLIC_MAIN_SKILL_MASTER){
    db.run(`INSERT INTO main_skill_master(main_skill_name,description_zh_tw,verification_status,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(main_skill_name) DO UPDATE SET description_zh_tw=excluded.description_zh_tw,verification_status=excluded.verification_status,
      source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [row.main_skill_name,row.description_zh_tw,row.verification_status,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version]);
  }
  for(const row of PUBLIC_EVOLUTION_MASTER){
    db.run(`INSERT INTO pokemon_evolution_master(from_species,to_species,required_level,required_sleep_hours,required_candy,required_item,other_requirement,verification_status,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(from_species,to_species) DO UPDATE SET required_level=excluded.required_level,required_sleep_hours=excluded.required_sleep_hours,
      required_candy=excluded.required_candy,required_item=excluded.required_item,other_requirement=excluded.other_requirement,verification_status=excluded.verification_status,
      source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [row.from_species,row.to_species,row.required_level,row.required_sleep_hours,row.required_candy,row.required_item,row.other_requirement,row.verification_status,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version]);
  }
  for(const row of PUBLIC_EVOLUTION_STATUS_MASTER){
    db.run(`INSERT INTO pokemon_evolution_status_master(species_name,evolution_status,verification_status,source_type,source_name,source_ref,verified_at,data_version)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(species_name) DO UPDATE SET evolution_status=excluded.evolution_status,verification_status=excluded.verification_status,
      source_type=excluded.source_type,source_name=excluded.source_name,source_ref=excluded.source_ref,verified_at=excluded.verified_at,data_version=excluded.data_version`,
      [row.species_name,row.evolution_status,row.verification_status,row.source_type,row.source_name,row.source_ref,row.verified_at,row.data_version]);
  }
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_pokemon_knowledge_version',?,datetime('now'))`,[JSON.stringify(PUBLIC_POKEMON_KNOWLEDGE_VERSION)]);
  db.run(`INSERT OR REPLACE INTO settings(key,value_json,updated_at) VALUES('public_pokemon_knowledge_contract',?,datetime('now'))`,[JSON.stringify({
    version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,player_tables_untouched:true,projection_only:true,
    nature_count:PUBLIC_NATURE_MASTER.length,main_skill_count:PUBLIC_MAIN_SKILL_MASTER.length,evolution_route_count:PUBLIC_EVOLUTION_MASTER.length,
    evolution_terminal_count:PUBLIC_EVOLUTION_STATUS_MASTER.length,
    missing_evolution_route_semantics:'UNKNOWN_NOT_YET_VERIFIED_AFTER_TERMINAL_TRIAGE',
  })]);
}
