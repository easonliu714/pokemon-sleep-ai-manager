import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveCandyFamilyStorageForSpecies} from '../assets/js/candy-family-storage-authority.js';
import {resolvePublicCandyFamilyForSpecies} from '../assets/js/public-candy-family-authority.js';
import {resolveG121DCanonicalCandyRead} from '../assets/js/g121d-candy-read-authority.js';

const species='皮卡丘';
const storage=resolveCandyFamilyStorageForSpecies(species);
assert.equal(storage.status,'MATCH','fixture species must have governed family storage authority');
assert.ok(storage.family_id,'governed family_id required');
assert.ok(storage.canonical_species_name,'canonical species authority required');

const canonicalCandyId='fixture:canonical-family-candy';
const alternateSpecies=(storage.member_species_names||[]).find(name=>name!==storage.canonical_species_name)||'legacy-family-member';
const candyMasterRows=[
  {candy_id:canonicalCandyId,candy_name:'canonical fixture',candy_type:'species',target_species_name:storage.canonical_species_name},
  {candy_id:'fixture:legacy-per-species',candy_name:'legacy fixture',candy_type:'species',target_species_name:alternateSpecies},
];

const known=resolveG121DCanonicalCandyRead(species,{
  candy_master_rows:candyMasterRows,
  candy_inventory_rows:[
    {candy_id:canonicalCandyId,quantity:40},
    {candy_id:'fixture:legacy-per-species',quantity:999},
  ],
});
assert.equal(known.status,'KNOWN');
assert.equal(known.reason,'governed_family_canonical_player_inventory_row');
assert.equal(known.player_record_exists,true);
assert.equal(known.quantity,40,'legacy per-species quantity must not be double-counted');
assert.equal(known.canonical_family_candy_rows.length,1);
assert.equal(known.canonical_family_candy_rows[0].quantity,40);
assert.equal(known.canonical_family_candy_rows[0].knowledge_state,'KNOWN');
assert.equal(known.resolution_mode,'STORAGE_CANONICAL_SPECIES');
assert.notEqual(known.reason,'missing_canonical_family_candy_authority','normal governed family must not depend on migration-audit row');

const absent=resolveG121DCanonicalCandyRead(species,{
  candy_master_rows:candyMasterRows,
  candy_inventory_rows:[{candy_id:'fixture:legacy-per-species',quantity:999}],
});
assert.equal(absent.status,'UNKNOWN');
assert.equal(absent.reason,'canonical_family_player_inventory_unknown');
assert.equal(absent.player_record_exists,false);
assert.equal(absent.quantity,null,'absent player row must remain UNKNOWN, never coerced to zero');
assert.deepEqual(absent.canonical_family_candy_rows,[]);

const zero=resolveG121DCanonicalCandyRead(species,{
  candy_master_rows:candyMasterRows,
  candy_inventory_rows:[{candy_id:canonicalCandyId,quantity:0}],
});
assert.equal(zero.status,'KNOWN','an actual player inventory row with integer zero is known zero');
assert.equal(zero.player_record_exists,true);
assert.equal(zero.quantity,0);

// .55.3.3.8 real-device regression: 波克比 has a governed evolution-family
// identity even when a separate zh-TW Candy display-name anchor is not present.
// Runtime read authority may use that governed family only when candy_master has
// exactly one species row inside the family. This closes the Togepi read gap
// without synthesizing a Candy name or guessing a species.
const togepiSpecies='波克比';
const togepiFamily=resolvePublicCandyFamilyForSpecies(togepiSpecies);
assert.equal(togepiFamily.status,'MATCH','Togepi must have governed public Candy-family membership');
assert.ok(togepiFamily.family_id);
assert.ok((togepiFamily.member_species_names||[]).includes(togepiSpecies));
const togepiMasterSpecies=togepiSpecies;
const togepiCandyId='fixture:togepi-family-candy';
const togepiKnown=resolveG121DCanonicalCandyRead(togepiSpecies,{
  candy_master_rows:[{candy_id:togepiCandyId,candy_name:'fixture exact observed master',candy_type:'species',target_species_name:togepiMasterSpecies}],
  candy_inventory_rows:[{candy_id:togepiCandyId,quantity:20}],
});
assert.equal(togepiKnown.status,'KNOWN','exactly one master row inside governed Togepi family must be readable');
assert.equal(togepiKnown.family_id,togepiFamily.family_id);
assert.equal(togepiKnown.canonical_candy_id,togepiCandyId);
assert.equal(togepiKnown.quantity,20);
assert.equal(togepiKnown.resolution_mode,'GOVERNED_FAMILY_EXACT_MASTER');

const togepiUnknownInventory=resolveG121DCanonicalCandyRead(togepiSpecies,{
  candy_master_rows:[{candy_id:togepiCandyId,candy_name:'fixture exact observed master',candy_type:'species',target_species_name:togepiMasterSpecies}],
  candy_inventory_rows:[],
});
assert.equal(togepiUnknownInventory.status,'UNKNOWN');
assert.equal(togepiUnknownInventory.reason,'canonical_family_player_inventory_unknown');
assert.equal(togepiUnknownInventory.quantity,null,'missing Togepi player inventory remains UNKNOWN, never zero');

const secondMember=(togepiFamily.member_species_names||[]).find(name=>name!==togepiMasterSpecies);
if(secondMember){
  const ambiguous=resolveG121DCanonicalCandyRead(togepiSpecies,{
    candy_master_rows:[
      {candy_id:togepiCandyId,candy_name:'fixture 1',candy_type:'species',target_species_name:togepiMasterSpecies},
      {candy_id:'fixture:togepi-family-candy-2',candy_name:'fixture 2',candy_type:'species',target_species_name:secondMember},
    ],
    candy_inventory_rows:[{candy_id:togepiCandyId,quantity:20}],
  });
  assert.equal(ambiguous.status,'UNKNOWN','multiple family member master rows must fail closed');
  assert.equal(ambiguous.reason,'ambiguous_canonical_candy_master_rows');
}

const providerSource=fs.readFileSync(new URL('../assets/js/g121d-warroom-recommendation-provider.js',import.meta.url),'utf8');
assert.doesNotMatch(providerSource,/candy_family_storage_migration_audit/,'migration audit must not be runtime lookup authority');
assert.match(providerSource,/FROM candy_master WHERE candy_type='species'/,'runtime provider must read canonical candy master rows');
assert.match(providerSource,/FROM candy_inventory ORDER BY candy_id/,'runtime provider must read actual player candy inventory rows');
assert.match(providerSource,/resolveG121DCanonicalCandyRead/,'runtime provider must use governed candy read authority');

console.log('G12.1D canonical candy runtime read authority contract: PASS');
