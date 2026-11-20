// G265 #861 — production source admission guard, supplemental to (NOT a substitute for)
// the required disposable native Chromium two-tab/IDB durable proof.
// Fail closed if the imported-authority account-pot writer regresses to bare SQL/persist.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../assets/js/weekly-context-ui-bridge.js',import.meta.url),'utf8');

function functionBody(text,name){
  const marker='async function '+name+'(';
  const start=text.indexOf(marker);
  assert.ok(start>=0,'G265_ACCOUNT_POT_WRITER_MISSING');
  const open=text.indexOf('{',start+marker.length);
  assert.ok(open>=0,'G265_ACCOUNT_POT_BODY_MISSING');
  let depth=0,quote=null,escaped=false;
  // The current function has no template literals; reject a new template literal
  // instead of incorrectly certifying a lexical scan as an AST.
  for(let i=open;i<text.length;i++){
    const c=text[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c===quote)quote=null;
      continue;
    }
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='`')throw Error('G265_ACCOUNT_POT_TEMPLATE_REQUIRES_PARSER_REVIEW');
    if(c==='{')depth++;
    if(c==='}'&&--depth===0)return text.slice(open,i+1);
    if(c!=='}')depth+=0; // no-op: explicit close handling above
  }
  throw Error('G265_ACCOUNT_POT_UNCLOSED_FUNCTION');
}
function admissionContract(body){
  const required=[
    ['same-page', 'beginSqliteExclusiveWriteWindow()'],
    ['native-lease','withPrimarySqliteMutationLock(async lease=>'],
    ['authority','const admitted=currentWeeklyContext()'],
    ['snapshot','await snapshot('],
    ['transaction','withSqliteCoordinatedMutation(begin)'],
    ['account-write','writeAccountPotCapacity(value,edit.source)'],
    ['commit','withSqliteCoordinatedMutation(commit)'],
    ['durable-ack','persist({primaryMutationLease:lease})'],
    ['acknowledged','acknowledged=true'],
    ['sticky-close','close({uncertainOutcome:!acknowledged})']
  ];
  const positions=required.map(([label,needle])=>{
    const at=body.indexOf(needle);
    assert.ok(at>=0,'G265_ACCOUNT_POT_MISSING_'+label);
    return at;
  });
  for(let i=1;i<positions.length;i++)
    assert.ok(positions[i]>positions[i-1],'G265_ACCOUNT_POT_ORDER_'+required[i][0]);
  assert.match(body,/hasImportedAuthority\(admitted\)/,'G265_ACCOUNT_POT_AUTHORITY_RECHECK_MISSING');
  assert.match(body,/ACCOUNT_POT_IMPORTED_AUTHORITY_RELOAD_REQUIRED/);
  assert.match(body,/if\(begun&&!committed\)withSqliteCoordinatedMutation\(rollback\)/);
  assert.doesNotMatch(body,/await persist\(\)/,'G265_ACCOUNT_POT_BARE_PERSIST');
}
const body=functionBody(source,'saveAccountPotCapacity');
admissionContract(body);
// Negative controls prove the assertions detect actual unsafe source mutations.
for(const [name,from,to] of [
  ['bare-persist','persist({primaryMutationLease:lease})','persist()'],
  ['missing-lease','withPrimarySqliteMutationLock(async lease=>','(async lease=>'],
  ['missing-sticky','close({uncertainOutcome:!acknowledged})','close()'],
  ['missing-authority','hasImportedAuthority(admitted)','true'],
  ['sql-before-admission','withSqliteCoordinatedMutation(begin)','withSqliteCoordinatedMutation(begin)']
]){
  const mutated=name==='sql-before-admission'
    ?body.replace('const admitted=currentWeeklyContext()','withSqliteCoordinatedMutation(begin);const admitted=currentWeeklyContext()')
    :body.replace(from,to);
  assert.notEqual(mutated,body,'G265_ACCOUNT_POT_NEGATIVE_FIXTURE_NOT_APPLIED_'+name);
  assert.throws(()=>admissionContract(mutated),undefined,'G265_ACCOUNT_POT_NEGATIVE_NOT_REJECTED_'+name);
}
console.log('PASS_G265_ACCOUNT_POT_PRODUCTION_SOURCE_ADMISSION_ORDER_AND_NEGATIVE_CONTROLS');
console.log('HOLD_G265_ACCOUNT_POT_NATIVE_CHROMIUM_TWO_TAB_IDB_NOT_VERIFIED');
