export const DATA_VERSION='G2A-20260730';

export const CORE_POKEMON=[
 ['pkm_latios_b','拉帝歐斯','拉帝歐斯B','拉帝歐斯S+',31,'技能','龍','S+','龍系技能核心／泛用技能隊'],
 ['pkm_altaria','七夕青鳥','七夕青鳥','七夕青鳥S+B',32,'樹果','龍','S+','龍系BFS樹果核心'],
 ['pkm_typhlosion','火暴獸','火暴獸','火暴獸S+B',31,'樹果','火','S+','火系BFS樹果核心／灰褐洞窟'],
 ['pkm_clodsire','土王','土王','土王S+CK',30,'食材','毒','S+','咖啡＋可可核心'],
 ['pkm_dratini_main','迷你龍','迷你龍（主力）','迷你龍S+G',18,'食材','龍','S+','香草／玉米長線快龍'],
 ['pkm_monferno','猛火猴','猛火猴','猛火猴S+S',21,'技能','格鬥','S+','技能核心／進化烈焰猴'],
 ['pkm_sylveon','仙子伊布','仙子伊布','仙子伊布S+',33,'技能','妖精','S+','全隊活力回復核心'],
 ['pkm_toxicroak','毒骷蛙','毒骷蛙','毒骷蛙SO',30,'食材','毒','S','純粹油核心'],
 ['pkm_diglett_c','地鼠','地鼠C','地鼠ST',20,'食材','地面','S','番茄核心'],
 ['pkm_arbok_c','阿柏怪','阿柏怪C','阿柏怪SB',23,'樹果','毒','S','毒系BFS樹果核心'],
 ['pkm_delibird','信使鳥','信使鳥','信使鳥SE',18,'食材','飛行','S','特選蛋核心'],
 ['pkm_ampharos','電龍','電龍','電龍S+S',25,'技能','電','S','技能輸出核心'],
 ['pkm_drampa','老翁龍','老翁龍','老翁龍SI',32,'食材','龍','S','龍系食材手'],
 ['pkm_raichu','雷丘','雷丘','雷丘SB',24,'樹果','電','S','高速樹果／幫手獎勵'],
 ['pkm_togekiss','波克基斯','波克基斯','波克基斯AE',25,'技能','飛行','A','蛋源與技能支援'],
 ['pkm_comfey','花療環環','花療環環','花療環環AN',31,'食材','妖精','A','玉米供應'],
 ['pkm_cetoddle','走鯨','走鯨','走鯨AB',30,'食材','冰','A','冰系BFS混合手'],
 ['pkm_wartortle','卡咪龜','卡咪龜','卡咪龜AM',19,'食材','水','A','鮮奶來源'],
 ['pkm_gengar','耿鬼','耿鬼','耿鬼AG',24,'食材','幽靈','A','火辣香草來源'],
 ['pkm_metapod','鐵甲蛹','鐵甲蛹','鐵甲蛹AB',24,'樹果','蟲','A','進化巴大蝶／幫手獎勵']
];

export const CORE_ITEMS=[
 ['波加曼的薰香',2,0,'活動／研究指定時使用'],['妙蛙種子的薰香',1,0,'需要妙蛙種子或甜甜蜜來源時使用'],
 ['月之石',1,1,'保留給需要月之石的進化'],['冰之石',1,1,'保留給冰系進化'],['葉之石',1,1,'保留給草系進化'],['火之石',1,1,'保留給火系進化'],
 ['聯繫繩',45,10,'數量充足；有明確進化目標即可使用'],['友好薰香',1,0,'點心時間額外寶可夢；活動週可用'],
 ['回復薰香',10,3,'需要恢復隊伍活力時使用'],['幸運薰香',2,1,'高能量／活動研究日提高夢之碎片收益'],
 ['好露營券',2,1,'重要活動週或要衝食譜／能量時使用'],['EX券',1,1,'保留至EX營地需求'],
 ['寶可沙布蕾',10,3,'一般捕捉，避免浪費在低優先個體'],['副技能種子',2,2,'極稀有；只投入核心且可升級的副技能'],
 ['主技能種子',5,3,'優先仙子伊布／拉帝歐斯S+／電龍'],['夢之塊M',15,5,'大型升級時使用'],['夢之塊S',48,20,'缺碎片時再兌換'],
 ['食材券S',2,0,'缺料或活動料理週使用'],['龍屬性的糖果S',4,4,'集中主力迷你龍／龍系核心'],
 ['超能力屬性的糖果S',3,2,'保留高價值超能力個體'],['萬能糖果S',16,8,'優先稀有、長線主力'],['活力枕頭',1,0,'臨時補單隻活力']
];

function nicknameUnits(value){return [...value].reduce((n,ch)=>n+(ch.charCodeAt(0)<=127?1:2),0)}

export function applyG2ASeed(db){
 const result=db.exec("SELECT value_json FROM settings WHERE key='data_seed_version'");
 const current=result?.[0]?.values?.[0]?.[0]||'';
 if(current===DATA_VERSION)return false;
 const now=new Date().toISOString();
 db.run('BEGIN IMMEDIATE');
 try{
  for(const [id,species,label,nickname,level,specialty,type,rating,role] of CORE_POKEMON){
   db.run(`INSERT OR IGNORE INTO pokemon(pokemon_id,species,original_label,nickname,nickname_halfwidth_units,nickname_valid,level,specialty,type,rating,status,core_role,last_updated_at,source_update_id)
           VALUES(?,?,?,?,?,1,?,?,?,?, 'active',?,?,?)`,[id,species,label,nickname,nicknameUnits(nickname),level,specialty,type,rating,role,now,DATA_VERSION]);
  }
  for(const [name,qty,reserve,rec] of CORE_ITEMS){
   db.run(`INSERT OR IGNORE INTO item_inventory(item_name,quantity,safe_reserve,recommendation,updated_at,source_update_id) VALUES(?,?,?,?,?,?)`,[name,qty,reserve,rec,now,DATA_VERSION]);
  }
  db.run(`INSERT INTO settings(key,value_json,updated_at) VALUES('data_seed_version',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`,[DATA_VERSION,now]);
  db.run('COMMIT');return true;
 }catch(e){db.run('ROLLBACK');throw e}
}
