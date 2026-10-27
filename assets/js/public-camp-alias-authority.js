// G9R 2026-10-26 Owner-proven game camp label compatibility.
// Projection/read-side ONLY. Never rewrite imported/player raw camp text.
const ALIASES=Object.freeze({
  '萌綠之島(萬聖節)':'萌綠之島',
  '萌綠之島EX(萬聖節)':'萌綠之島EX',
});
export function canonicalPublicCampForProjection(value){
  const observed=String(value??'').normalize('NFKC').trim();
  return Object.prototype.hasOwnProperty.call(ALIASES,observed)?ALIASES[observed]:observed;
}
