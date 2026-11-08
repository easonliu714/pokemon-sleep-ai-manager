// Frozen exact pre-admission weekly clear witness from main dbde00a74908d114de409922d03297ce0778b3f6.
// Historical lost-update evidence ONLY; never imported by the production application.
export async function clearWeeklyManualOverride(weekStart){
  const epoch=String(weekStart||'').trim();if(!epoch)return false;
  if(!readWeeklyManualOverride(epoch))return false;
  await snapshot('manual:weekly-context-override-clear');
  run('DELETE FROM settings WHERE key=?',[settingKey(epoch)]);
  await persist();
  return true;
}
