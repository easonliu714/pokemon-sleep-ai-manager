import {rows} from './database.js';
import {localWeekStart} from './evaluation-week.js';
import {normalizeWeeklyContext} from './weekly-context-normalization.js';
import {resolveCampFavoriteBerries} from './public-camp-berry-master.js';

export const WEEKLY_CONTEXT_STORE_VERSION='weekly-context-store-2026-08-10-a';

export function currentWeeklyContext({date=new Date()}={}){
  const epoch=localWeekStart(date);
  const row=rows('SELECT * FROM weekly_context WHERE week_start=? ORDER BY updated_at DESC, context_id DESC LIMIT 1',[epoch])[0]||null;
  if(!row)return Object.freeze({
    context_id:null,week_start:epoch,camp:null,dish_category:null,event_name:null,pot_size:null,
    favorite_berry_1:null,favorite_berry_2:null,favorite_berry_3:null,event_effects:null,base_notes:null,updated_at:null,
    context_status:'CURRENT_WEEK_MISSING',berry_policy:'UNKNOWN',berry_source:'MISSING_PLAYER_WEEK_OBSERVATION',favorite_berries:Object.freeze([]),
  });
  const normalized=normalizeWeeklyContext(row);
  const berry=resolveCampFavoriteBerries(normalized.camp,[normalized.favorite_berry_1,normalized.favorite_berry_2,normalized.favorite_berry_3]);
  const berries=[...berry.berries];
  return Object.freeze({
    ...normalized,
    favorite_berry_1:berries[0]||null,
    favorite_berry_2:berries[1]||null,
    favorite_berry_3:berries[2]||null,
    favorite_berries:Object.freeze(berries),
    berry_policy:berry.policy,
    berry_locked:berry.locked,
    berry_source:berry.source,
    context_status:'CURRENT_WEEK_READY',
  });
}

export function weeklyContextForEpoch(weekStart){
  const epoch=String(weekStart??'').trim();
  if(!epoch)return null;
  const row=rows('SELECT * FROM weekly_context WHERE week_start=? ORDER BY updated_at DESC, context_id DESC LIMIT 1',[epoch])[0]||null;
  if(!row)return null;
  const normalized=normalizeWeeklyContext(row);
  const berry=resolveCampFavoriteBerries(normalized.camp,[normalized.favorite_berry_1,normalized.favorite_berry_2,normalized.favorite_berry_3]);
  const berries=[...berry.berries];
  return Object.freeze({...normalized,favorite_berry_1:berries[0]||null,favorite_berry_2:berries[1]||null,favorite_berry_3:berries[2]||null,favorite_berries:Object.freeze(berries),berry_policy:berry.policy,berry_locked:berry.locked,berry_source:berry.source,context_status:'READY'});
}
