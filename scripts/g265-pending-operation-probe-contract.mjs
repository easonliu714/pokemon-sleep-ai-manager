import assert from 'node:assert/strict';
import {observePendingOperation} from './lib/g265-pending-operation-probe.mjs';
function clock(){
  let id=0;const timers=new Map(),events=[];
  return {events,timers,setTimer:fn=>{timers.set(++id,fn);return id;},clearTimer:key=>timers.delete(key),
    emit:(event,detail)=>events.push({event,detail}),tick(){const item=timers.entries().next().value;assert.ok(item);timers.delete(item[0]);item[1]();}};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
{
  const c=clock();let calls=0;
  assert.equal(await observePendingOperation(async()=>42,{...c,probe:()=>{calls++;}}),42);
  assert.equal(calls,0);assert.equal(c.timers.size,0);assert.deepEqual(c.events,[]);
}
{
  const c=clock();let finish,settled=false,primaryCalls=0;
  const p=observePendingOperation(()=>{primaryCalls++;return new Promise(r=>finish=r);},{...c,probe:async()=>2}).then(v=>{settled=true;return v;});
  c.tick();await flush();
  assert.equal(settled,false,'independent probe must never substitute for primary result');
  assert.equal(primaryCalls,1);
  assert.deepEqual(c.events.map(x=>x.event),['WATCHDOG_BEGIN','PROBE_ACK']);
  finish('original SQL result');assert.equal(await p,'original SQL result');
  assert.equal(c.events.at(-1).event,'PRIMARY_SETTLED_AFTER_WATCHDOG');assert.equal(c.timers.size,0);
}
{
  const c=clock();let fail,finishProbe;
  const original=Error('original failure');
  const p=observePendingOperation(()=>new Promise((_,r)=>fail=r),{...c,probe:()=>new Promise(r=>finishProbe=r)});
  const rejected=assert.rejects(p,e=>e===original);
  c.tick();await flush();c.tick();
  assert.deepEqual(c.events.map(x=>x.event),['WATCHDOG_BEGIN','PROBE_DEADLINE']);
  fail(original);await rejected;finishProbe(2);await flush();
  assert.equal(c.events.at(-1).event,'PROBE_ACK');assert.equal(c.timers.size,0);
}
{
  const c=clock();let finish;const p=observePendingOperation(()=>new Promise(r=>finish=r),{...c,probe:async()=>{throw Error('CDP failure');}});
  c.tick();await flush();assert.equal(c.events.at(-1).event,'PROBE_ERROR');
  finish('primary');assert.equal(await p,'primary');
}
console.log('PASS G265_PENDING_PROBE_NO_RETRY_NO_SUBSTITUTION_OR_TIMEOUT_OVERRIDE');
