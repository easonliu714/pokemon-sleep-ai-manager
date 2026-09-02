import assert from 'node:assert/strict';
import {buildCompactPublicMasterProviderSchema} from '../assets/js/public-master-recognition-provider-schema.js';

const base={
  recognitionSchema:'pokemon-sleep-public-master-recognition/1.0',
  recognitionVersion:'test',scenario:'candy_inventory_update',authority:'candy_master',dataVersion:'test',catalogSnapshotId:'candy_master@test',
  aiStatuses:['MATCHED','AMBIGUOUS','UNMATCHED'],canonicalKeyFields:['candy_id','candy_name'],dataSchema:{quantity:{type:'integer',minimum:0}},
};
const schema=buildCompactPublicMasterProviderSchema(base);
const serialized=JSON.stringify(schema);
assert.equal(serialized.includes('candy_001'),false,'provider schema must not contain catalog identity enums');
assert.equal(schema.properties.observations.items.properties.canonical_key.properties.candy_id.type,'string');
assert.equal(schema.properties.observations.items.properties.canonical_name.type,'string');
assert.equal(schema.properties.observations.items.properties.candidate_names.items.type,'string');

// Catalog growth is intentionally absent from the builder input: provider schema size is O(contract), not O(catalog rows).
const baselineBytes=Buffer.byteLength(serialized);
const repeated=buildCompactPublicMasterProviderSchema({...base,catalogSnapshotId:'candy_master@test'});
assert.equal(Buffer.byteLength(JSON.stringify(repeated)),baselineBytes);
assert.ok(baselineBytes<5000,`compact provider schema unexpectedly large: ${baselineBytes}`);

console.log(`V042755_UCIMG_COMPACT_PROVIDER_SCHEMA_CONTRACT=PASS bytes=${baselineBytes}`);
