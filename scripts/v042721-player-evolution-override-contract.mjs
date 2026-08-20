import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolveEvolutionAuthority,
  hydrateEvolutionDraft,
  normalizePlayerEvolutionOverride,
  evolutionAuthorityLabel,
  PUBLIC_MASTER,
  PLAYER_OVERRIDE,
  CUSTOM_REQUIREMENTS,
  CANNOT_EVOLVE,
  PLAYER_EVOLUTION_OVERRIDE_VERSION,
} from '../assets/js/analysis-confirmation-evolution-authority.js';

const fakeRows=(sql,params=[])=>{
  const species=params[0];
  if(sql.includes('FROM pokemon_evolution_master')&&species==='皮卡丘')return [{from_species:'皮卡丘',to_species:'雷丘',required_level:null,required_sleep_hours:null,required_candy:80,required_item:'雷之石',other_requirement:null,verification_status:'VERIFIED',source_type:'fixture',source_name:'fixture',source_ref:'fixture:pikachu',verified_at:'2026-08-20',data_version:'fixture'}];
  if(sql.includes('FROM pokemon_evolution_status_master'))return [];
  return [];
};

const publicAuthority=resolveEvolutionAuthority('皮卡丘',fakeRows);
assert.equal(publicAuthority.route.to_species,'雷丘');
const ordinary=hydrateEvolutionDraft({species:'皮卡丘',evolution_authority_mode:PUBLIC_MASTER,field_evidence:{}},publicAuthority);
assert.equal(ordinary.evolution_authority_mode,PUBLIC_MASTER);
assert.equal(ordinary.evolution_candy_required,80);
assert.equal(ordinary.evolution_item_required,'雷之石');
assert.equal(ordinary.evolution_authority.public_master_reference_only,false);

const cannot=hydrateEvolutionDraft({
  species:'皮卡丘',
  evolution_authority_mode:PLAYER_OVERRIDE,
  evolution_override_status:CANNOT_EVOLVE,
  evolution_override_reason:'活動特殊造型不可進化',
  evolution_candy_required:80,
  evolution_item_required:'雷之石',
  field_evidence:{},
},publicAuthority);
assert.equal(cannot.evolution_authority.status,'PLAYER_OVERRIDE_CANNOT_EVOLVE');
assert.equal(cannot.evolution_authority.public_to_species,'雷丘');
assert.equal(cannot.evolution_authority.public_master_reference_only,true);
assert.equal(cannot.evolution_candy_required,null);
assert.equal(cannot.evolution_item_required,'');
assert.match(evolutionAuthorityLabel(cannot.evolution_authority),/僅供參考/);
assert.match(evolutionAuthorityLabel(cannot.evolution_authority),/無法進化/);

const custom=hydrateEvolutionDraft({
  species:'皮卡丘',
  evolution_authority_mode:PLAYER_OVERRIDE,
  evolution_override_status:CUSTOM_REQUIREMENTS,
  evolution_target_override:'特殊目標',
  evolution_override_reason:'玩家已確認特殊條件',
  evolution_level_required:33,
  evolution_candy_required:12,
  evolution_item_required:'特殊道具',
  field_evidence:{},
},publicAuthority);
assert.equal(custom.evolution_authority.status,'PLAYER_OVERRIDE_CUSTOM_REQUIREMENTS');
assert.equal(custom.evolution_level_required,33);
assert.equal(custom.evolution_candy_required,12);
assert.equal(custom.evolution_item_required,'特殊道具');
assert.notEqual(custom.evolution_candy_required,80);
assert.notEqual(custom.evolution_item_required,'雷之石');

const normalized=normalizePlayerEvolutionOverride({authority_mode:PLAYER_OVERRIDE,override_status:CANNOT_EVOLVE,required_candy:80,required_item:'雷之石'});
assert.equal(normalized.evolution_candy_required,null);
assert.equal(normalized.evolution_item_required,'');

const authoritySource=fs.readFileSync('assets/js/analysis-confirmation-evolution-authority.js','utf8');
const workbenchSource=fs.readFileSync('assets/js/analysis-confirmation-workbench.js','utf8');
const versionSource=fs.readFileSync('assets/js/version-authority.js','utf8');
assert.ok(authoritySource.includes('CREATE TABLE IF NOT EXISTS pokemon_evolution_override'));
assert.ok(authoritySource.includes('PLAYER_SQLITE_EVOLUTION_OVERRIDE'));
assert.ok(authoritySource.includes('公版進化條件（僅參考）'));
assert.ok(authoritySource.includes('此特殊個體無法進化'));
assert.ok(authoritySource.includes('player_evolution_override_applied'));
assert.ok(!authoritySource.includes("INSERT INTO pokemon_evolution_master"),'player override must never write Public Master');
assert.ok(workbenchSource.includes("root.querySelectorAll('[data-field]')"),'confirmation draft must capture successor data-field controls');
assert.match(versionSource,/app_version:\s*'v0\.4\.27\.21'/);
assert.match(versionSource,/app_build:\s*'20260820-v042721-player-evolution-override'/);
assert.match(versionSource,/cache_name:\s*'pokemon-sleep-ai-v0\.4\.27\.21-v042721-player-evolution-override'/);
assert.equal(PLAYER_EVOLUTION_OVERRIDE_VERSION,'pokemon-sleep-player-evolution-override/1.0-v042721');

console.log(JSON.stringify({status:'PASS',gate:'V042721_PLAYER_EVOLUTION_OVERRIDE',ordinary_public_master:{candy:ordinary.evolution_candy_required,item:ordinary.evolution_item_required,target:ordinary.evolution_authority.to_species},cannot_evolve:{status:cannot.evolution_authority.status,public_reference_only:cannot.evolution_authority.public_master_reference_only},custom_requirements:{level:custom.evolution_level_required,candy:custom.evolution_candy_required,item:custom.evolution_item_required}},null,2));