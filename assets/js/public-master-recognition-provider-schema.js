// Issue #420: Gemini provider-side Structured Output must remain compact.
// Canonical identity authority stays in public-master-recognition.js post-response validation.

export const PUBLIC_MASTER_PROVIDER_SCHEMA_VERSION='public-master-provider-schema-2026-09-01-a';

const clone=value=>JSON.parse(JSON.stringify(value));

export function buildCompactPublicMasterProviderSchema({
  recognitionSchema,
  recognitionVersion,
  scenario,
  authority,
  dataVersion,
  catalogSnapshotId,
  aiStatuses,
  canonicalKeyFields,
  dataSchema,
}={}){
  const keyProperties=Object.fromEntries((canonicalKeyFields||[]).map(field=>[field,{type:'string'}]));
  return {
    type:'object',
    properties:{
      schema:{type:'string',enum:[recognitionSchema]},
      recognition_version:{type:'string',enum:[recognitionVersion]},
      scenario:{type:'string',enum:[scenario]},
      authority:{type:'string',enum:[authority]},
      data_version:{type:'string',enum:[dataVersion]},
      catalog_snapshot_id:{type:'string',enum:[catalogSnapshotId]},
      generated_at:{type:'string'},
      visible_target_count:{type:'integer',minimum:0},
      observations:{
        type:'array',
        items:{
          type:'object',
          properties:{
            observation_id:{type:'string'},
            status:{type:'string',enum:[...(aiStatuses||[])]},
            observed_text:{type:'string'},
            observed_data:{type:'object',properties:clone(dataSchema||{}),additionalProperties:false},
            canonical_key:{type:'object',properties:keyProperties,additionalProperties:false},
            canonical_name:{type:'string'},
            candidate_names:{type:'array',items:{type:'string'}},
            source_image_ref:{type:'string'},
            confidence:{type:'number',minimum:0,maximum:1},
            reason:{type:'string'},
          },
          required:['observation_id','status','observed_text','observed_data','source_image_ref','confidence'],
          additionalProperties:false,
        },
      },
    },
    required:['schema','recognition_version','scenario','authority','data_version','catalog_snapshot_id','generated_at','visible_target_count','observations'],
    additionalProperties:false,
  };
}
