// Bounded observation only. Never resolve/reject or retry the primary operation.
// Keep the original deadline and SQL result as the sole acceptance authority.
export async function observePendingOperation(operation,{probe,emit,delayMs=5000,probeMs=3000,setTimer=setTimeout,clearTimer=clearTimeout}){
  let settled=false,started=false,timer,probeTimer;
  const report=(event,detail={})=>{try{emit(event,detail);}catch{}};
  timer=setTimer(()=>{
    if(settled)return;
    started=true;report('WATCHDOG_BEGIN');
    // Independent protocol probe only; a responsive probe cannot make a
    // hung operation pass. A deadline is diagnostic, never a retry.
    probeTimer=setTimer(()=>report('PROBE_DEADLINE'),probeMs);
    Promise.resolve().then(probe).then(
      value=>report('PROBE_ACK',{value}),
      error=>report('PROBE_ERROR',{message:String(error?.message??error)})
    ).finally(()=>clearTimer(probeTimer));
  },delayMs);
  try{return await operation();}
  finally{
    settled=true;clearTimer(timer);
    if(started)report('PRIMARY_SETTLED_AFTER_WATCHDOG');
  }
}
