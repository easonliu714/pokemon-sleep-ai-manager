export const EVALUATION_WEEK_VERSION='evaluation-week-2026-08-09-a';

const pad=value=>String(value).padStart(2,'0');

export function localDateKey(date=new Date()){
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export function localWeekStart(date=new Date()){
  const local=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  const mondayOffset=(local.getDay()+6)%7;
  local.setDate(local.getDate()-mondayOffset);
  return localDateKey(local);
}

export function weeklyContextMatchesEpoch(weeklyContext,epoch){
  const stored=String(weeklyContext?.week_start??'').trim();
  return Boolean(stored&&epoch&&stored===String(epoch));
}
