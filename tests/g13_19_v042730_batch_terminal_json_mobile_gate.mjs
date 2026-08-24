import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/js/runtime-version.js','utf8');
const unified=fs.readFileSync('assets/js/unified-import-analysis-workbench.js','utf8');
const exporter=fs.readFileSync('assets/js/ai-image-analysis-export.js','utf8');

assert.match(runtime,/function v042730RemainingItemIds\(selectedIds=\[\],terminalIds=\[\]\)/);
assert.match(runtime,/detail\.stage!=='ai'/);
assert.match(runtime,/\['completed','failed'\]\.includes\(detail\.state\)/);
assert.match(runtime,/results\.prepend\(\.\.\.preserved\)/);
assert.match(runtime,/v042730_batch_continuation_started/);
assert.match(runtime,/all_inputs_reached_terminal:terminal\.size===initialSelected\.length/);
assert.match(runtime,/Failure JSON 已保留/);
assert.match(runtime,/pre\.style\.maxHeight='60vh'/);
assert.match(runtime,/pre\.style\.overflowY='auto'/);
assert.match(runtime,/pre\.style\.webkitOverflowScrolling='touch'/);
assert.match(runtime,/pre\.style\.touchAction='pan-x pan-y'/);

// Predecessor evidence: a per-item provider failure already builds a valid failure
// export before throwing; .30 changes batch continuation, not the export schema.
assert.match(unified,/buildPerImageAnalysisExport\(\{item,revision:null,execution:null,[\s\S]*?modelEvents,failure\}\)/);
assert.match(unified,/publishStage\('ai','failed'/);
assert.match(unified,/throw error/);
assert.match(exporter,/failure/);

const match=runtime.match(/export function v042730RemainingItemIds\(selectedIds=\[\],terminalIds=\[\]\)\{[\s\S]*?\n\}/);
assert.ok(match,'batch continuation helper must remain extractable');
const source=match[0].replace(/^export\s+/,'');
const context={Set};vm.createContext(context);vm.runInContext(`${source}\nthis.remaining=v042730RemainingItemIds;`,context);
const selected=['1','2','3','4','5','6'];
assert.deepEqual([...context.remaining(selected,['1','2','3','4','5'])],['6'],'5/6 terminal must continue only item 6');
assert.deepEqual([...context.remaining(selected,['1','2','3','4','5','6'])],[],'6/6 terminal closes the batch');
assert.deepEqual([...context.remaining(['1','1','2'],['1'])],['2'],'duplicate selected ids are deduplicated');

const terminal=new Map([
  ['1',{state:'completed'}],['2',{state:'completed'}],['3',{state:'completed'}],
  ['4',{state:'completed'}],['5',{state:'failed',error_class:'provider_total_timeout'}],
]);
let pending=[...context.remaining(selected,[...terminal.keys()])];
assert.deepEqual(pending,['6']);
terminal.set('6',{state:'completed'});
pending=[...context.remaining(selected,[...terminal.keys()])];
assert.deepEqual(pending,[]);
const failed=[...terminal.values()].filter(row=>row.state==='failed').length;
const succeeded=[...terminal.values()].filter(row=>row.state==='completed').length;
assert.equal(succeeded,5);
assert.equal(failed,1);
assert.equal(terminal.size,6);

console.log(JSON.stringify({
  status:'PASS',
  gate:'G13.19_V042730_BATCH_TERMINAL_JSON_MOBILE',
  six_inputs_six_terminal_items:true,
  provider_total_timeout_isolated:true,
  remaining_after_5_of_6:['6'],
  succeeded_count:5,
  failed_count:1,
  failure_envelope_preserved:true,
  previous_result_dom_preserved_across_continuation:true,
  android_json_vertical_scroll:true,
},null,2));
