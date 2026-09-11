import assert from 'node:assert/strict';
import {evaluateG121DEvolutionVariantRouteAuthority} from '../assets/js/g121d-evolution-variant-authority.js';

const ordinary=evaluateG121DEvolutionVariantRouteAuthority({
  current_species:'皮卡丘',
  species:'皮卡丘',
  nickname:'小黃',
});
assert.equal(ordinary.allowed,true,'normal Pikachu must keep ordinary evolution route authority');
assert.equal(ordinary.variant,null);

const exactVariant=evaluateG121DEvolutionVariantRouteAuthority({
  current_species:'皮卡丘（船長）',
  species:'皮卡丘',
  nickname:'',
});
assert.equal(exactVariant.allowed,false,'Captain Pikachu exact species label must fail closed');
assert.equal(exactVariant.variant,'PIKACHU_CAPTAIN');
assert.equal(exactVariant.reason,'VARIANT_SPECIFIC_EVOLUTION_ROUTE_AUTHORITY_REQUIRED');
assert.equal(exactVariant.identity_source,'current_species');
assert.equal(exactVariant.ordinary_species_route_forbidden,true);

const nicknameFallback=evaluateG121DEvolutionVariantRouteAuthority({
  current_species:'皮卡丘',
  species:'皮卡丘',
  nickname:'船長',
});
assert.equal(nicknameFallback.allowed,false,'exact Captain nickname marker on exact Pikachu may conservatively fail closed');
assert.equal(nicknameFallback.identity_source,'nickname_exact_marker');
assert.equal(nicknameFallback.reason,'VARIANT_SPECIFIC_EVOLUTION_ROUTE_AUTHORITY_REQUIRED');

const genericParentheses=evaluateG121DEvolutionVariantRouteAuthority({
  current_species:'皮卡丘',
  species:'皮卡丘',
  nickname:'皮卡丘（最愛）',
});
assert.equal(genericParentheses.allowed,true,'generic parenthesized nickname must not be treated as costume authority');

const unrelatedCaptain=evaluateG121DEvolutionVariantRouteAuthority({
  current_species:'伊布',
  species:'伊布',
  nickname:'船長',
});
assert.equal(unrelatedCaptain.allowed,true,'Captain nickname fallback must be scoped to exact Pikachu identity');

console.log(JSON.stringify({
  gate:'G12.1D_VARIANT_ROUTE_AUTHORITY',
  status:'PASS',
  normal_pikachu_ordinary_route:true,
  captain_exact_variant_excluded:true,
  captain_exact_nickname_fallback:true,
  generic_parentheses_heuristic:false,
  explicit_reason_trace:true,
},null,2));
