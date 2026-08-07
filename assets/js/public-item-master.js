export const PUBLIC_ITEM_MASTER_VERSION='public-item-master-2026-08-07-c';

const SOURCE_POLICY=Object.freeze({
  source_type:'game_screenshot_and_reference_verified',
  source_name:'Pokémon Sleep Traditional Chinese game UI / structured reference',
  source_ref:'rescue-catalog-item-effects-promoted-to-canonical-authority',
  verified_at:'2026-08-07',
});

const RAW_ITEMS=[
['大師沙布蕾','biscuit','友好度增加最多的特別沙布蕾。'],['高級沙布蕾','biscuit','友好度大幅增加的高級沙布蕾。'],['超級沙布蕾','biscuit','友好度增加較多的沙布蕾。'],['寶可沙布蕾','biscuit','餵給寶可夢後可增加友好度。'],
['主技能種子','skill_seed','提升主技能等級。'],['副技能種子','skill_seed','提升可強化的副技能等級。'],['活力枕頭','recovery','回復指定幫手寶可夢的活力。'],['幫手哨子','helper','立即獲得一段時間的幫手成果。'],
['食材券S','ingredient_ticket','隨機獲得少量食材。'],['食材券M','ingredient_ticket','隨機獲得中量食材。'],['食材券L','ingredient_ticket','隨機獲得大量食材。'],
['萬能糖果S','candy','可交換為少量指定寶可夢的糖果。'],['萬能糖果M','candy','可交換為中量指定寶可夢的糖果。'],['萬能糖果L','candy','可交換為大量指定寶可夢的糖果。'],
['龍屬性的糖果S','candy','可交換為少量龍屬性寶可夢的糖果。'],['超能力屬性的糖果S','candy','可交換為少量超能力屬性寶可夢的糖果。'],
['夢之塊S','dream_cluster','使用後獲得少量夢之碎片。'],['夢之塊M','dream_cluster','使用後獲得中量夢之碎片。'],['夢之塊L','dream_cluster','使用後獲得大量夢之碎片。'],
['營地移動券','ticket','重新抽選目前營地。'],['EX券','ticket','可用於指定活動或交換用途。'],['好露營券','ticket','在一定期間內獲得好露營組合的效果。'],['午睡放鬆券','ticket','可用於指定的午睡放鬆用途。'],
['回復薰香','incense','睡眠研究後可獲得更多活力回復效果。'],['專注薰香','incense','睡眠研究後可獲得更多研究EXP。'],['幸運薰香','incense','睡眠研究後可獲得更多夢之碎片。'],['成長薰香','incense','睡眠研究後寶可夢可獲得更多EXP。'],['友好薰香','incense','睡眠研究時更容易遇到肚子餓的寶可夢。'],['波加曼的薰香','incense','睡眠研究時可吸引波加曼。'],['妙蛙種子的薰香','incense','睡眠研究時可吸引妙蛙種子。'],
['火之石','evolution','部分寶可夢進化所需的特殊道具。'],['水之石','evolution','部分寶可夢進化所需的特殊道具。'],['雷之石','evolution','部分寶可夢進化所需的特殊道具。'],['葉之石','evolution','部分寶可夢進化所需的特殊道具。'],['冰之石','evolution','部分寶可夢進化所需的特殊道具。'],['月之石','evolution','部分寶可夢進化所需的特殊道具。'],['光之石','evolution','部分寶可夢進化所需的特殊道具。'],['暗之石','evolution','部分寶可夢進化所需的特殊道具。'],['覺醒之石','evolution','部分寶可夢進化所需的特殊道具。'],['渾圓之石','evolution','部分寶可夢進化所需的特殊道具。'],['王者之證','evolution','部分寶可夢進化所需的特殊道具。'],['聯繫繩','evolution','部分寶可夢進化所需的特殊道具。'],['金屬膜','evolution','部分寶可夢進化所需的特殊道具。'],['銳利之爪','evolution','部分寶可夢進化所需的特殊道具。'],
];

export const PUBLIC_ITEM_MASTER=Object.freeze(RAW_ITEMS.map(([item_name,item_category,effect_description_zh_tw])=>Object.freeze({
  item_name,item_category,effect_description_zh_tw,...SOURCE_POLICY,data_version:PUBLIC_ITEM_MASTER_VERSION,
})));
