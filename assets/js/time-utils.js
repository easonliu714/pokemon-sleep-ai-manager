export function localIso(date=new Date()){
  const pad=n=>String(Math.trunc(Math.abs(n))).padStart(2,'0');
  const y=date.getFullYear(),m=pad(date.getMonth()+1),d=pad(date.getDate());
  const hh=pad(date.getHours()),mm=pad(date.getMinutes()),ss=pad(date.getSeconds());
  const offset=-date.getTimezoneOffset();
  const sign=offset>=0?'+':'-';
  const oh=pad(offset/60),om=pad(offset%60);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}
export function formatLocal(value){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
}
