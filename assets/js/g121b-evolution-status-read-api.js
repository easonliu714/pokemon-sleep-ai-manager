import {G121_EVOLUTION_STATUS} from './g121-authority.js';
import {evaluateG121BFromAuthoritativeSnapshot} from './g121b-schema-safe-read-adapter.js';

export const G121B_EVOLUTION_STATUS_READ_SCHEMA='evolution-status/1.0';
const ALLOWED_STATUS=new Set(Object.values(G121_EVOLUTION_STATUS));
const text=value=>String(value??'').trim();

const failClosed=(request,reason)=>({
  schema:G121B_EVOLUTION_STATUS_READ_SCHEMA,
  status:G121_EVOLUTION_STATUS.DATA_INCOMPLETE,
  reason,
  pokemon_instance_id:text(request?.pokemon_instance_id)||null,
  route_id:text(request?.route_id)||null,
  evolution_branch_id:text(request?.evolution_branch_id)||null,
  deterministic:true,
  read_only:true,
  ai_status_computation:false,
});

/**
 * Stable read-side envelope for G12.1B deterministic evolution status.
 * The authoritative snapshot is consumed read-only by the schema-safe adapter;
 * AI is intentionally excluded from status computation and authority recovery.
 */
export function readG121BDeterministicEvolutionStatus(snapshot={},request={}){
  const result=evaluateG121BFromAuthoritativeSnapshot(snapshot,request);
  if(!result||typeof result!=='object')return failClosed(request,'invalid_deterministic_result');
  if(!ALLOWED_STATUS.has(result.status))return failClosed(request,'invalid_deterministic_status');

  const requestedPokemonId=text(request.pokemon_instance_id);
  const resultPokemonId=text(result.pokemon_instance_id);
  if(requestedPokemonId&&resultPokemonId&&requestedPokemonId!==resultPokemonId){
    return failClosed(request,'pokemon_instance_identity_mismatch');
  }

  return {
    schema:G121B_EVOLUTION_STATUS_READ_SCHEMA,
    ...result,
    pokemon_instance_id:resultPokemonId||requestedPokemonId||null,
    route_id:text(result.route_id)||text(request.route_id)||null,
    evolution_branch_id:text(result.evolution_branch_id)||text(request.evolution_branch_id)||null,
    deterministic:true,
    read_only:true,
    ai_status_computation:false,
  };
}
