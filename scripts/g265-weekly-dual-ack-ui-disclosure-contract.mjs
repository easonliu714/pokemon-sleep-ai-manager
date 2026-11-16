// G265 #861 negative-first: exercise the ACTUAL installSubmit function extracted
// from production source. This is an ACK/UI disclosure contract, not a mock
// SQLite/Native Chromium durability proof. No Player data or IndexedDB writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('assets/js/weekly-context-ui-bridge.js','utf8');
const start=source.indexOf('function installSubmit(form){');
const end=source.indexOf('\nasync function clearOverrideClick(',start);
assert.ok(start>=0&&end>start,'production installSubmit function boundary must remain source-bound');
const sourceFunction=source.slice(start,end)+'\n;installSubmit';

function harness({overrideFails=false,potFails=false}={}){
  const order=[],alerts=[];
  const current={
    week_start:'2026-11-16',authority_revision:'weekly-source-v1',
    authority_context_id:'weekly-1',pot_size:45,
    field_sources:{pot_size:'ACCOUNT_CAPACITY'}
  };
  const context={
    currentWeeklyContext:()=>current,
    validateManualForm:()=>{},
    localWeekStart:()=>current.week_start,
    potCapacityEdit:()=>({needsAccountWrite:true,changed:true,value:75,source:'MANUAL_WEEKLY_CONTEXT_UI'}),
    hasImportedAuthority:()=>true,
    changedOverrideFields:()=>({fields:{dish_category:'curry'},changed:true}),
    saveWeeklyManualOverride:async()=>{
      order.push('weekly-override-start');
      if(overrideFails)throw new Error('WEEKLY_OVERRIDE_DENIED');
      order.push('weekly-override-ack');
    },
    emitWeeklyChanged:()=>order.push('weekly-event'),
    saveAccountPotCapacity:async()=>{
      order.push('account-pot-start');
      if(potFails)throw new Error('SQLITE_PRIMARY_STALE_REVISION_RELOAD_REQUIRED');
      order.push('account-pot-ack');return 75;
    },
    emitPotChanged:()=>order.push('pot-event'),
    syncForm:()=>order.push('sync'),
    alert:message=>alerts.push(String(message)),
    Error,Object,String
  };
  const install=vm.runInNewContext(sourceFunction,context);
  const form={dataset:{}};
  install(form);
  return {order,alerts,submit:()=>form.onsubmit({preventDefault(){}})};
}

test('successful dual ACK must retain the existing success UX',async()=>{
  const h=harness();await h.submit();
  assert.deepEqual(h.order.slice(0,5),[
    'weekly-override-start','weekly-override-ack','weekly-event',
    'account-pot-start','account-pot-ack'
  ]);
  assert.match(h.alerts.at(-1),/本週環境已儲存/);
});

test('first writer denied must not falsely claim a weekly override ACK',async()=>{
  const h=harness({overrideFails:true});await h.submit();
  assert.equal(h.order.includes('account-pot-start'),false);
  assert.equal(h.alerts.length,1);
  assert.match(h.alerts[0],/本週環境儲存失敗/);
  assert.doesNotMatch(h.alerts[0],/本週人工覆寫已儲存/);
});

test('second writer denial after real first ACK must disclose partial success',async()=>{
  const h=harness({potFails:true});await h.submit();
  assert.deepEqual(h.order.slice(0,4),[
    'weekly-override-start','weekly-override-ack','weekly-event','account-pot-start'
  ]);
  assert.equal(h.order.includes('pot-event'),false);
  assert.equal(h.alerts.length,1);
  assert.match(h.alerts[0],/本週人工覆寫已儲存/,'G265_PARTIAL_WEEKLY_ACK_MUST_BE_DISCLOSED');
  assert.match(h.alerts[0],/鍋子容量.*(未確認|尚未更新)/);
  assert.match(h.alerts[0],/重新載入/);
  assert.doesNotMatch(h.alerts[0],/^本週環境儲存失敗/);
});
