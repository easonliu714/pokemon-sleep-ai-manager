import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/js/canonical-registry.js',import.meta.url),'utf8');

test('R1 canonical resolver keeps the four-state contract',()=>{
  for(const marker of ['CANONICAL_EXACT','CANONICAL_ALIAS_SAFE','CANONICAL_ALIAS_REVIEW','CANONICAL_UNKNOWN']){
    assert.match(source,new RegExp(marker));
  }
  assert.match(source,/commit_allowed:false/);
  assert.match(source,/requires_review:true/);
});

test('R1 recognition evidence is auditable and review candidates are isolated',()=>{
  assert.match(source,/CREATE TABLE IF NOT EXISTS canonical_resolution_log/);
  assert.match(source,/CREATE TABLE IF NOT EXISTS canonical_alias_candidate/);
  assert.match(source,/evidence_revision TEXT/);
  assert.match(source,/source_ref TEXT/);
  assert.match(source,/hit_count=canonical_alias_candidate\.hit_count\+1/);
});

test('R1 safe aliases are explicit and review aliases cannot auto commit',()=>{
  assert.match(source,/SAFE_INGREDIENT_ALIASES/);
  assert.match(source,/commit_allowed:safe/);
  assert.match(source,/requires_review:!safe/);
  assert.match(source,/WHERE resolution_id=\? AND requires_review=0/);
});

test('R1 registry contains no player-state or private Pokemon seed writes',()=>{
  for(const forbidden of ['ingredient_inventory','item_inventory','recipes SET unlocked','INSERT INTO pokemon','pokemon_id']){
    assert.doesNotMatch(source,new RegExp(forbidden,'i'));
  }
});
