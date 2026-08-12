from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
WATCHDOG=ROOT/'assets/js/v0394-startup-watchdog.js'
VERSION=ROOT/'assets/js/version-authority.js'


def match_pair(text,start,open_ch,close_ch):
    if text[start]!=open_ch:
        raise RuntimeError('pair start mismatch')
    depth=0; quote=None; escaped=False
    for i in range(start,len(text)):
        ch=text[i]
        if quote:
            if escaped: escaped=False
            elif ch=='\\': escaped=True
            elif ch==quote: quote=None
            continue
        if ch in ('\"',"'",'`'):
            quote=ch; continue
        if ch==open_ch: depth+=1
        elif ch==close_ch:
            depth-=1
            if depth==0:return i
    raise RuntimeError('unmatched pair')


def patch_watchdog():
    text=WATCHDOG.read_text(encoding='utf-8')
    if 'v04137-false-positive-guard' in text or '// v0.4.13.7 false-positive guard:' in text:
        return False
    target=text.find('main_thread_block_detected')
    if target<0: raise RuntimeError('main_thread_block_detected not found')
    candidates=[]
    for m in re.finditer(r'\bif\s*\(',text[:target]):
        paren=text.find('(',m.start())
        try: pend=match_pair(text,paren,'(',')')
        except Exception: continue
        j=pend+1
        while j<len(text) and text[j].isspace():j+=1
        if j>=len(text) or text[j]!='{':continue
        try:bend=match_pair(text,j,'{','}')
        except Exception:continue
        if j<target<bend:candidates.append((m.start(),paren,pend,j,bend))
    if not candidates: raise RuntimeError('enclosing main-thread block if not found')
    _,paren,pend,_,_=max(candidates,key=lambda x:x[0])
    original=text[paren+1:pend]
    if 'v04137ShouldSuppressBlock' in original:return False
    guarded=f'({original}) && !v04137ShouldSuppressBlock()'
    text=text[:paren+1]+guarded+text[pend:]

    guard=r'''// v0.4.13.7 false-positive guard:
// Native blocking dialogs and Android/PWA background suspension pause JavaScript timers.
// The startup watchdog must not reinterpret the first resumed heartbeat as application CPU deadlock.
const V04137_WATCHDOG_RESUME_GRACE_MS=5000;
let v04137ResumeGraceUntil=0;

function v04137Now(){
  try{return performance.now();}catch{return Date.now();}
}
function v04137MarkResumeGrace(){
  v04137ResumeGraceUntil=v04137Now()+V04137_WATCHDOG_RESUME_GRACE_MS;
}
function v04137DocumentHidden(){
  try{return typeof document!=='undefined'&&(document.hidden===true||document.visibilityState==='hidden');}catch{return false;}
}
function v04137ShouldSuppressBlock(){
  return v04137DocumentHidden()||v04137Now()<v04137ResumeGraceUntil;
}
function v04137InstallLifecycleGuards(){
  if(typeof document!=='undefined'){
    document.addEventListener('visibilitychange',()=>{
      if(!v04137DocumentHidden())v04137MarkResumeGrace();
    },{passive:true});
  }
  if(typeof globalThis.addEventListener==='function'){
    globalThis.addEventListener('pageshow',v04137MarkResumeGrace,{passive:true});
    globalThis.addEventListener('focus',v04137MarkResumeGrace,{passive:true});
    globalThis.addEventListener('resume',v04137MarkResumeGrace,{passive:true});
  }
  for(const name of ['alert','confirm','prompt']){
    const native=globalThis[name];
    if(typeof native!=='function'||native.__pokemonSleepV04137Guarded)continue;
    const wrapped=function(...args){
      try{return native.apply(this,args);}
      finally{v04137MarkResumeGrace();}
    };
    try{Object.defineProperty(wrapped,'__pokemonSleepV04137Guarded',{value:true});}catch{}
    try{globalThis[name]=wrapped;}catch{}
  }
}
v04137InstallLifecycleGuards();
'''
    lines=text.splitlines(True); insert_at=0
    for i,line in enumerate(lines):
        if line.lstrip().startswith('import '):insert_at=i+1
    prefix=''.join(lines[:insert_at]); suffix=''.join(lines[insert_at:])
    text=prefix+('\n' if prefix and not prefix.endswith('\n\n') else '')+guard+'\n'+suffix
    WATCHDOG.write_text(text,encoding='utf-8')
    return True


def patch_version():
    text=VERSION.read_text(encoding='utf-8')
    if "app_version: 'v0.4.13.7'" in text:return False
    required=[
      "app_version: 'v0.4.13.6',",
      "app_build: '20260812-v04136-pot-manual-authority-alignment',",
      "cache_name: 'pokemon-sleep-ai-v0.4.13.6-v04136-pot-manual-authority-alignment',",
    ]
    if not all(x in text for x in required):raise RuntimeError('unexpected release authority baseline')
    text=text.replace(required[0],"app_version: 'v0.4.13.7',",1)
    text=text.replace(required[1],"app_build: '20260812-v04137-startup-watchdog-false-positive-closure',",1)
    text=text.replace(required[2],"cache_name: 'pokemon-sleep-ai-v0.4.13.7-v04137-startup-watchdog-false-positive-closure',",1)
    marker='// Legacy CI parser bridge only; not executed and not a release authority:\n'
    legacy="// app_version: 'v0.4.13.6'\n// app_build: '20260812-v04136-pot-manual-authority-alignment'\n"
    if legacy not in text:
        if marker not in text:raise RuntimeError('legacy authority marker missing')
        text=text.replace(marker,marker+legacy,1)
    VERSION.write_text(text,encoding='utf-8')
    return True


def patch_successor_allowlist(path):
    p=ROOT/path
    if not p.exists():return False
    text=p.read_text(encoding='utf-8')
    if "'v0.4.13.7'" in text:return False
    if "'v0.4.13.6'" not in text:return False
    if 'includes(appVersion)' not in text:
        # Exact-equality predecessor gates are converted only if their purpose is release authority.
        patterns=[
          (r"assert\.equal\(appVersion,'v0\.4\.13\.6'[^;]*;", "assert.ok(['v0.4.13.6','v0.4.13.7'].includes(appVersion),`unexpected predecessor successor authority: ${appVersion}`);"),
          (r'assert\.equal\(appVersion,"v0\.4\.13\.6"[^;]*;', "assert.ok(['v0.4.13.6','v0.4.13.7'].includes(appVersion),`unexpected predecessor successor authority: ${appVersion}`);"),
        ]
        for pat,repl in patterns:
            updated,n=re.subn(pat,repl,text,count=1)
            if n:
                p.write_text(updated,encoding='utf-8');return True
        raise RuntimeError(f'non-allowlist predecessor needs review: {path}')
    updated,n=re.subn(r"(\[[^\]]*'v0\.4\.13\.6')\]",r"\1,'v0.4.13.7']",text,count=1)
    if not n:raise RuntimeError(f'could not extend predecessor allowlist: {path}')
    p.write_text(updated,encoding='utf-8');return True


changed=[]
if patch_watchdog():changed.append(str(WATCHDOG.relative_to(ROOT)))
if patch_version():changed.append(str(VERSION.relative_to(ROOT)))
for rel in [
  'scripts/v04135-account-capacity-apply-not-null-contract.mjs',
  'scripts/v04136-pot-manual-authority-alignment-contract.mjs',
]:
    if patch_successor_allowlist(rel):changed.append(rel)
print('changed='+','.join(changed) if changed else 'changed=NONE')
