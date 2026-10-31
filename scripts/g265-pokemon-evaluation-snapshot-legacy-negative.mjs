// G265 next distinct direct legacy writer: unchanged evaluation snapshot refresh.
// Disposable Node VM tabs and synthetic derived rows only; PASS reproduces UNSAFE
// two-ACK stale full-image overwrite, NOT production admission or player-data safety.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/js/pokemon-evaluation-store.js',import.meta.url),'utf8');
const marker='export async function refreshFactEvaluationSnapshots(';
assert.equal(source.split(marker).length,2,'exact evaluation refresh writer must be unique');
const operation=marker+source.split(marker)[1];
assert.match(source,/import \{rows,run,persist,snapshot,isRescueReadonly\} from '\.\/database\.js'/);
assert.match(operation,/await snapshot\('war-room:evaluation-snapshots'\)/);
assert.match(operation,/INSERT INTO pokemon_evaluation_snapshot\(/);
assert.match(operation,/await persist\(\)/);
assert.doesNotMatch(operation,/navigator\.locks|runSqliteWriteSession|createSqliteFreshDurableTransactionAdapter/);
console.log('PASS G265_EVALUATION_SNAPSHOT_EXACT_LEGACY_REFRESH_SOURCE_BOUND_DIRECT_PERSIST');

const clone=value=>JSON.parse(JSON.stringify(value));
const seed={evaluation_id:'eval_seed',pokemon_id:'SYNTHETIC_SEED',input_fingerprint:'synthetic:seed'};
let durable={evaluation_snapshot:[clone(seed)],
  pokemon:[{pokemon_id:'SYNTHETIC_SEED',status:'active'}],
  public_master:[{id:'synthetic-public',value:'IMMUTABLE'}]};
let snapshots=0,acks=0,releaseFirst,notifyFirst;
const firstEntered=new Promise(resolve=>{notifyFirst=resolve;});
function tab(hold=false){
  const local=clone(durable);
  let snapshotReady=false;
  const context={
    isRescueReadonly:()=>false,
    planFactEvaluationSnapshotRefresh({pokemonIds}={}){
      const ids=(pokemonIds||[]).map(String).filter(Boolean);
      if(!ids.length)return {status:'NO_ACTIVE_POKEMON',skipped:0};
      return {status:'READY',write_required:true,refresh_targets:ids.map(pokemon_id=>({pokemon_id})),
        stale_snapshot_ids:[],reused_count:0,skipped:0};
    },
    getActiveStrategyGoalProfile:()=>null,
    latestWeeklyContext:()=>({}),
    currentEvaluationMasterVersions:()=>({}),
    pokemonDetail:id=>({pokemon:{pokemon_id:id,status:'active'},ingredients:[],subskills:[]}),
    pokemonEvaluationFingerprint:input=>'synthetic:'+input.pokemon.pokemon_id,
    snapshotId:id=>'eval_'+id,
    buildFactOnlyPokemonEvaluation:()=>({
      intrinsic_score:1,current_readiness_score:1,weekly_fit_score:1,
      roster_marginal_value_score:1,training_roi_score:1,
      score_breakdown:{},reasons:[],missing_inputs:[],
      hard_constraint_status:'PASS',failed_constraints:[],evaluation_status:'READY'
    }),
    POKEMON_EVALUATION_RULE_VERSION:'SYNTHETIC_RULE',
    localIso:()=> '2026-10-31T05:55:00.000Z',
    async snapshot(reason){
      assert.equal(reason,'war-room:evaluation-snapshots');
      snapshotReady=true;snapshots++;
      return {status:'SYNTHETIC_SNAPSHOT'};
    },
    run(sql,params){
      assert.ok(snapshotReady,'snapshot must precede evaluation SQL');
      assert.match(sql,/^INSERT INTO pokemon_evaluation_snapshot\(/);
      assert.equal(params.length,19);
      const row={evaluation_id:params[0],pokemon_id:params[1],input_fingerprint:params[2]};
      local.evaluation_snapshot=local.evaluation_snapshot.filter(x=>x.evaluation_id!==row.evaluation_id);
      local.evaluation_snapshot.push(row);
    },
    async persist(){
      assert.ok(snapshotReady,'persist without snapshot');
      const exported=clone(local);
      if(hold)await new Promise(resolve=>{releaseFirst=resolve;notifyFirst();});
      durable=exported;acks++;
    },
    window:{dispatchEvent(){}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    console,Promise,Error,JSON,Object,String,Set,
  };
  const ctx=vm.createContext(context);
  vm.runInContext(operation.replace(/^export /,'')+'\n;globalThis.__refresh=refreshFactEvaluationSnapshots;',ctx,{timeout:3000});
  return ctx.__refresh;
}
const firstTab=tab(true);
const empty=await firstTab({pokemonIds:[]});
assert.equal(empty.status,'NO_ACTIVE_POKEMON');
assert.equal(snapshots,0,'empty refresh must not snapshot');
assert.equal(acks,0,'empty refresh must not persist');
console.log('PASS G265_EVALUATION_SNAPSHOT_NO_ACTIVE_NO_SNAPSHOT_NO_DURABLE_WRITE');

const first=firstTab({pokemonIds:['SYNTHETIC_A']});
await firstEntered;
const secondTab=tab(false);
const second=await secondTab({pokemonIds:['SYNTHETIC_B']});
assert.equal(second.status,'READY');
assert.equal(second.created,1);
assert.equal(second.player_rows_modified,false);
assert.equal(acks,1);
assert.ok(durable.evaluation_snapshot.some(x=>x.pokemon_id==='SYNTHETIC_B'));
releaseFirst();
const earlier=await first;
assert.equal(earlier.status,'READY');
assert.equal(earlier.created,1);
assert.equal(earlier.player_rows_modified,false);
assert.equal(snapshots,2);
assert.equal(acks,2,'both legacy tabs returned durable success ACK');
assert.ok(durable.evaluation_snapshot.some(x=>x.pokemon_id==='SYNTHETIC_A'));
assert.ok(!durable.evaluation_snapshot.some(x=>x.pokemon_id==='SYNTHETIC_B'),
  'stale full-image export erased the other acknowledged derived evaluation');
assert.ok(durable.evaluation_snapshot.some(x=>x.evaluation_id===seed.evaluation_id));
assert.deepEqual(durable.pokemon,[{pokemon_id:'SYNTHETIC_SEED',status:'active'}]);
assert.deepEqual(durable.public_master,[{id:'synthetic-public',value:'IMMUTABLE'}]);
console.log('PASS G265_EVALUATION_SNAPSHOT_TWO_TABS_TWO_ACKS_DERIVED_ROW_LOST_UPDATE_NEGATIVE');
console.log('HOLD G265_EVALUATION_SNAPSHOT_LEGACY_UNADMITTED_CRASH_RESTORE_ANDROID');
