import assert from 'node:assert/strict';
import {buildScreenshotGroupKey,groupPokemonScreenshots,mergeGroupedScreenshotFields} from '../assets/js/pokemon-screenshot-grouping.js';

const screenshots=[
  {source_ref:'q-1',capture_order:1,header:{species:'土王',level:31,sp:1183,thumbnail_hash:'thumb-q'},fields:{nature:'慢吞吞',level:31}},
  {source_ref:'q-2',capture_order:2,header:{species:'土王',level:31,sp:1183,thumbnail_hash:'thumb-q'},fields:{main_skill:'活力填充S'}},
  {source_ref:'q-3',capture_order:3,header:{species:'土王',level:31,sp:1183,thumbnail_hash:'thumb-q'},contains_sleep_time:true,fields:{sleep_hours_with_helper:42.5}},
  {source_ref:'m-1',capture_order:4,header:{species:'猛火猴',level:25,sp:1341,thumbnail_hash:'thumb-m'},fields:{nature:'勇敢'}},
  {source_ref:'bad',capture_order:5,header:{species:'猛火猴',level:null,sp:1341},fields:{}},
];

assert.equal(buildScreenshotGroupKey(screenshots[0]),'土王||31|1183');
const grouped=groupPokemonScreenshots(screenshots);
assert.equal(grouped.summary.input_count,5);
assert.equal(grouped.summary.group_count,2);
assert.equal(grouped.summary.ungrouped_count,1);
assert.equal(grouped.summary.complete_count,1);
const quagsire=grouped.groups.find(item=>item.header.species==='土王');
assert.equal(quagsire.screenshots.length,3);
assert.equal(quagsire.status,'exact_header_match');
const merged=mergeGroupedScreenshotFields(quagsire);
assert.equal(merged.fields.sleep_hours_with_helper,42.5);
assert.equal(merged.complete_to_sleep_time,true);
assert.equal(merged.conflicts.length,0);

const conflict=groupPokemonScreenshots([
  {source_ref:'a',header:{species:'土王',level:31,sp:1183,thumbnail_hash:'x'}},
  {source_ref:'b',header:{species:'土王',level:31,sp:1183,thumbnail_hash:'y'}},
]);
assert.equal(conflict.groups[0].status,'header_conflict');
assert.equal(conflict.summary.conflict_count,1);
console.log('PASS TECH.2D N screenshot grouping and merge');
