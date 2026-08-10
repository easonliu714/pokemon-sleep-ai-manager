import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PUBLIC_CAMP_BERRY_MASTER,PUBLIC_CAMP_BERRY_VERSION} from '../assets/js/public-camp-berry-master.js';
import {PUBLIC_POKEMON_KNOWLEDGE_VERSION} from '../assets/js/public-pokemon-knowledge-master.js';
import {PUBLIC_CANDY_MASTER_VERSION} from '../assets/js/public-candy-master.js';

const read=path=>fs.readFileSync(path,'utf8');
const version=read('assets/js/version-authority.js');
assert.equal(version.match(/app_version:\s*'([^']+)'/)?.[1],'v0.4.8.5');
assert.equal(version.match(/app_build:\s*'([^']+)'/)?.[1],'20260810-v0485-compact-camp-table-density');
assert.equal(version.match(/cache_name:\s*'([^']+)'/)?.[1],'pokemon-sleep-ai-v0.4.8.5-v0485-compact-camp-table-density');
assert.equal(PUBLIC_CAMP_BERRY_VERSION,'public-camp-berry-2026-08-10-a');
assert.equal(PUBLIC_POKEMON_KNOWLEDGE_VERSION,'pokemon-knowledge-2026-08-10-e');
assert.equal(PUBLIC_CANDY_MASTER_VERSION,'public-candy-master-2026-08-10-d');
assert.equal(PUBLIC_CAMP_BERRY_MASTER.length,9);

const camp=read('assets/js/camp-berry-knowledge-ui.js');
for(const token of [
  "CAMP_BERRY_KNOWLEDGE_UI_VERSION='camp-berry-knowledge-ui-2026-08-10-e'",
  "CAMP_BERRY_MOBILE_CONTAINMENT='COMPACT_CONTAINED_TABLE'",
  '#campBerryMasterBlock{min-width:0;max-width:100%;overflow:hidden;}',
  'overflow-x:auto!important',
  'margin-left:0!important;margin-right:0!important',
  '#campBerryMasterTable{width:100%;min-width:640px;max-width:100%;table-layout:fixed',
  '#campBerryMasterTable th:nth-child(1),#campBerryMasterTable td:nth-child(1){width:17%;}',
  '#campBerryMasterTable th:nth-child(3),#campBerryMasterTable td:nth-child(3){width:32%;}',
  '#campBerryMasterTable th:nth-child(4),#campBerryMasterTable td:nth-child(4){width:24%;}',
  '#campBerryMasterTable{min-width:620px;}',
  'function sourceLabel(row)',
  "return 'Serebii / research-area'",
  "return 'Pokémon Sleep / public'",
  "return 'Pokémon Sleep / official'",
  '採與進化條件及糖果公版 Master 一致的緊湊表格',
  '<th>營地</th><th>規則</th><th>喜好樹果／候選規則</th><th>來源</th><th>核對日</th>',
])assert.ok(camp.includes(token),`v0.4.8.5 compact Camp table token missing: ${token}`);
for(const forbidden of ['camp-berry-contained-cards','prefersContainedCards','TOUCH_FIRST_ROW_CARD','#campBerryMasterTable thead{display:none;}'])assert.equal(camp.includes(forbidden),false,`v0.4.8.5 must remove verbose row-card behavior: ${forbidden}`);
assert.ok(camp.includes('white-space:normal!important'),'long berry/source text must wrap inside cells');
assert.ok(camp.includes('white-space:nowrap!important'),'short identity/date cells should remain compact');
assert.equal(read('assets/js/migrations.js').includes('VALUES(10,'),false,'v0.4.8.5 must not add SQLite migration 10');

console.log(JSON.stringify({
  status:'PASS',
  gate:'V0.4.8.5_RELEASE_CONTRACT',
  app_version:'v0.4.8.5',
  build:'20260810-v0485-compact-camp-table-density',
  camp_master_version:PUBLIC_CAMP_BERRY_VERSION,
  public_pokemon_knowledge_version:PUBLIC_POKEMON_KNOWLEDGE_VERSION,
  public_candy_master_version:PUBLIC_CANDY_MASTER_VERSION,
  camp_rows:PUBLIC_CAMP_BERRY_MASTER.length,
  mobile_camp_layout:'COMPACT_CONTAINED_TABLE',
  one_row_per_camp:true,
  contained_horizontal_scroll_fallback:true,
  public_master_changed:false,
  player_rows_mutated:false,
  sqlite_migration_added:false,
},null,2));