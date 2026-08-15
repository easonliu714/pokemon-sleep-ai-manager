import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  auditPublicPokemonKnowledgeBundle,
  buildObservedProjectionCoverage,
  resolvePublicMainSkillName,
} from '../assets/js/public-pokemon-knowledge-coverage.js';
import {
  PUBLIC_EVOLUTION_MASTER,
  PUBLIC_EVOLUTION_STATUS_MASTER,
} from '../assets/js/public-pokemon-knowledge-master.js';

export const CI_P5_PUBLIC_KNOWLEDGE_SUCCESSOR_VERSION='ci-p5-public-knowledge-successor-2026-08-15-a';
export const PREDECESSOR_PUBLIC_KNOWLEDGE_FIXTURE=Object.freeze({
  workflow:'v0399-human-readable-diff-review.yml',
  historical_runtime:'v0.4.1',
  historical_build:'20260808-v041-evolution-master-coverage-completion',
});

const read=path=>fs.readFileSync(path,'utf8');
const parts=value=>String(value||'').replace(/^v/,'').split('.').map(part=>Number(part)||0);
const atLeast=(current,minimum)=>{
  const left=parts(current),right=parts(minimum),size=Math.max(left.length,right.length);
  for(let index=0;index<size;index+=1){
    const a=left[index]||0,b=right[index]||0;
    if(a!==b)return a>b;
  }
  return true;
};
const version=read('assets/js/version-authority.js');
const currentApp=version.match(/app_version:\s*'([^']+)'/)?.[1]||'';
assert.equal(atLeast(currentApp,PREDECESSOR_PUBLIC_KNOWLEDGE_FIXTURE.historical_runtime),true,`P5 public-knowledge successor requires ${PREDECESSOR_PUBLIC_KNOWLEDGE_FIXTURE.historical_runtime} behavior or later: ${currentApp}`);

const bundle=auditPublicPokemonKnowledgeBundle();
assert.equal(bundle.ok,true,bundle.errors.join('; '));
assert.equal(bundle.manifest.nature_rows,25);
assert.equal(bundle.manifest.nature_expected,25);
assert.equal(bundle.manifest.player_rows_may_be_mutated,false);
assert.equal(bundle.manifest.projection_only,true);
assert.equal(bundle.manifest.evolution_triage_status,'VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN');
assert.ok(bundle.manifest.evolution_route_rows>=74,`minimum evolution route coverage regressed: ${bundle.manifest.evolution_route_rows}`);
assert.ok(bundle.manifest.evolution_from_species_rows>=66,`minimum outgoing species coverage regressed: ${bundle.manifest.evolution_from_species_rows}`);
assert.ok(bundle.manifest.evolution_verified_terminal_rows>=55,`minimum terminal species coverage regressed: ${bundle.manifest.evolution_verified_terminal_rows}`);

const route=(from,to)=>PUBLIC_EVOLUTION_MASTER.find(row=>row.from_species===from&&row.to_species===to);
const terminal=new Set(PUBLIC_EVOLUTION_STATUS_MASTER.map(row=>row.species_name));
const slowking=route('呆呆獸','呆呆王');
assert.ok(slowking);
assert.equal(slowking.required_candy,80);
assert.equal(slowking.required_item,'王者之證＋連結繩');
const pawmot=route('布土撥','巴布土撥');
assert.ok(pawmot);
assert.equal(pawmot.required_sleep_hours,150);
assert.equal(pawmot.required_candy,80);
const salamence=route('甲殼龍','暴飛龍');
assert.ok(salamence);
assert.equal(salamence.required_level,38);
assert.equal(salamence.required_candy,100);
const gourgeist=route('南瓜精','南瓜怪人');
assert.ok(gourgeist);
assert.equal(gourgeist.required_item,'連結繩');
assert.equal(gourgeist.required_candy,80);
const tyrantrum=route('寶寶暴龍','怪顎龍');
assert.ok(tyrantrum);
assert.equal(tyrantrum.required_level,29);
assert.equal(tyrantrum.required_candy,80);
assert.match(String(tyrantrum.other_requirement),/6:00/);
for(const species of ['拉達','呆呆王','快龍','巴布土撥','浩大鯨'])assert.ok(terminal.has(species),`verified terminal fixture missing: ${species}`);

const aliases=new Map([
  ['樹果遞增','樹果遽增'],
  ['樹果速增','樹果遽增'],
  ['流星群（樹果遞增）','流星群（樹果遽增）'],
  ['流星群（樹果速增）','流星群（樹果遽增）'],
]);
for(const [legacy,canonical] of aliases)assert.equal(resolvePublicMainSkillName(legacy),canonical,`legacy skill alias failed: ${legacy}`);
assert.equal(resolvePublicMainSkillName('樹果遽增\u200B'),'樹果遽增');
const sample=buildObservedProjectionCoverage([
  {nature:'固執',main_skill:'食材精選S',type:'惡',current_species:'小果然'},
  {nature:'認真',main_skill:'蓄力(能量填充S)',type:'電',current_species:'小拳石'},
  {nature:'自大',main_skill:'樹果遞增',type:'飛行',current_species:'小磁怪'},
  {nature:'勤奮',main_skill:'樹果遽增\u200B',type:'蟲',current_species:'巴大蝶'},
  {nature:'浮躁',main_skill:'禮物(食材獲取S)',type:'地面',current_species:'土王'},
  {nature:'溫和',main_skill:'活力療癒S',type:'水',current_species:'呆呆獸'},
  {nature:'害羞',main_skill:'能量填充S',type:'龍',current_species:'快龍'},
  {nature:'測試未收錄性格',main_skill:'測試未收錄技能',type:'測試未收錄屬性',current_species:'測試未收錄物種'},
]);
assert.equal(sample.nature.resolved,7);
assert.equal(sample.nature.unresolved,1);
assert.equal(sample.main_skill.resolved,7);
assert.equal(sample.main_skill.unresolved,1);
assert.equal(sample.main_skill.unresolved_values.includes('樹果遞增'),false);
assert.equal(sample.main_skill.unresolved_values.includes('樹果遽增\u200B'),false);
for(const species of ['小果然','小拳石','小磁怪','呆呆獸'])assert.ok(sample.evolution.verified_outgoing_values.includes(species),`verified outgoing fixture failed: ${species}`);
for(const species of ['巴大蝶','土王','快龍'])assert.ok(sample.evolution.verified_terminal_values.includes(species),`verified terminal fixture failed: ${species}`);
assert.ok(sample.evolution.unknown_evolution_status_values.includes('測試未收錄物種'));
assert.equal(sample.evolution.terminal_semantics,'VERIFIED_TERMINAL_CURRENT_SLEEP');
assert.equal(sample.evolution.unknown_semantics,'UNKNOWN_NOT_YET_VERIFIED');

const MASTER=read('assets/js/public-pokemon-knowledge-master.js');
const SHARED_MASTER=read('assets/js/shared-master-data.js');
const COVERAGE=read('assets/js/public-pokemon-knowledge-coverage.js');
const COVERAGE_UI=read('assets/js/v03993-public-knowledge-coverage-ui.js');
const PROJECTION=read('assets/js/v03993-projection-integrity.js');
const MIGRATIONS=read('assets/js/migrations.js');
for(const token of ['CREATE TABLE IF NOT EXISTS nature_master','CREATE TABLE IF NOT EXISTS main_skill_master','CREATE TABLE IF NOT EXISTS pokemon_evolution_master','CREATE TABLE IF NOT EXISTS pokemon_evolution_status_master','PUBLIC_EVOLUTION_STATUS_MASTER','VERIFIED_TERMINAL_CURRENT_SLEEP'])assert.ok(MASTER.includes(token),`public master successor missing token: ${token}`);
for(const skill of ['食材精選S','蓄力（能量填充S）','樹果遽增','樹果速增','禮物（食材獲取S）'])assert.ok(MASTER.includes(skill),`public main-skill fixture missing: ${skill}`);
for(const token of ['VERIFIED_OUTGOING_OR_VERIFIED_TERMINAL_OR_UNKNOWN','UNKNOWN_NOT_YET_VERIFIED','SKILL_INVISIBLE_FORMAT_RE','normalizeSkillPunctuation','PARTIAL_VERIFIED_ONLY_NON_TERMINAL','UNKNOWN_OR_TERMINAL_NOT_CLASSIFIED'])assert.ok(COVERAGE.includes(token),`coverage successor missing token: ${token}`);
for(const token of ['已核對終階物種','仍待核對 evolution status 的物種','Bundle Integrity PASS'])assert.ok(COVERAGE_UI.includes(token),`coverage UI successor missing token: ${token}`);
assert.ok(PROJECTION.includes("id!=='pokemonNatureSelect'&&id!=='pokemonTypeSelect'"),'projection guard missing');
assert.ok(PROJECTION.includes('event.stopImmediatePropagation()'),'projection event guard missing');
assert.ok(MIGRATIONS.includes('pokemon_knowledge:settingValue'),'migration public-knowledge version check missing');
assert.ok(MIGRATIONS.includes('pokemon_knowledge:PUBLIC_POKEMON_KNOWLEDGE_VERSION'),'migration public-knowledge expected version check missing');
assert.ok(SHARED_MASTER.includes('Public type→berry knowledge is projection-only'),'shared master projection-only declaration missing');

const assetFiles=fs.readdirSync('assets/js').filter(name=>name.endsWith('.js'));
for(const name of assetFiles){
  const source=read(`assets/js/${name}`);
  assert.doesNotMatch(source,/UPDATE\s+pokemon\s+SET\s+favorite_berry/i,`public type/berry master must never write favorite_berry into player rows: ${name}`);
}
assert.doesNotMatch(MASTER,/UPDATE pokemon SET .*nature_bonus|UPDATE pokemon SET .*main_skill_description|UPDATE pokemon SET .*evolution_.*SELECT .*master/i,'public Pokémon knowledge must not be written into player pokemon rows');

console.log(JSON.stringify({
  status:'PASS',
  gate:'CI_P5_PUBLIC_KNOWLEDGE_SUCCESSOR',
  version:CI_P5_PUBLIC_KNOWLEDGE_SUCCESSOR_VERSION,
  current_app_version:currentApp,
  predecessor_fixture:PREDECESSOR_PUBLIC_KNOWLEDGE_FIXTURE,
  evolution_routes:bundle.manifest.evolution_route_rows,
  outgoing_species:bundle.manifest.evolution_from_species_rows,
  terminal_species:bundle.manifest.evolution_verified_terminal_rows,
  projection_only:true,
  player_rows_may_be_mutated:false,
},null,2));
