export const V0415_UI_POLISH_VERSION='v0415-mobile-ui-polish-2026-08-12-a';

const STYLE_ID='pokemonSleepV0415UiPolish';
const CSS=`
#diagnostics,.recipe-workbench-summary,.g72-team-supply{min-width:0;max-width:100%}
#diagnostics .cards{grid-template-columns:repeat(auto-fit,minmax(min(155px,100%),1fr))}
#diagnostics .cards article{min-width:0;max-width:100%;overflow:hidden}
#diagnostics .cards strong{min-width:0;max-width:100%;font-size:clamp(.88rem,4vw,1.55rem);line-height:1.2;overflow-wrap:anywhere;word-break:break-word;white-space:normal}
#diagnostics #debugSession,#diagnostics #debugLastEvent{display:block;overflow-wrap:anywhere;word-break:break-word;white-space:normal}
#diagnostics .panel,#diagnostics .section-head,#diagnostics .buttons{min-width:0;max-width:100%}
#diagnostics .table-wrap{max-width:100%;overflow:auto}
.recipe-workbench-summary{margin:12px 0 20px}
.recipe-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}
.recipe-stat-card{min-width:0;background:#fff;border:1px solid #dbe4df;border-radius:12px;padding:12px;box-shadow:0 2px 8px rgba(24,79,60,.04)}
.recipe-stat-card span,.recipe-stat-card small{display:block;color:#687d74;line-height:1.35;overflow-wrap:anywhere}
.recipe-stat-card span{font-size:.8rem;font-weight:750;margin-bottom:5px}
.recipe-stat-card strong{display:block;color:#1f7a5a;font-size:1.25rem;line-height:1.2;margin-bottom:5px;overflow-wrap:anywhere}
.recipe-stat-card small{font-size:.75rem}
.recipe-stat-card.pot{background:#f6fbf8}.recipe-stat-card.total{background:#eef7f2}.recipe-stat-card.category{background:#fff}
.recipe-summary-meta{margin-top:9px;color:#687d74;font-size:.82rem;line-height:1.5;overflow-wrap:anywhere;word-break:break-word}
.recipe-summary-meta code{white-space:normal;overflow-wrap:anywhere}
.g72-team-supply{margin:18px 0;padding:14px;border:1px solid #cfe0d7;border-radius:12px;background:#f8fcfa}
.g72-team-supply h4{margin:0 0 5px}.g72-team-supply details>summary{cursor:pointer;font-weight:750;color:#24483b;margin:10px 0}
.g72-supply-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:9px}
.g72-supply-recipe{min-width:0;border:1px solid #dbe4df;border-radius:10px;background:#fff;padding:10px}
.g72-supply-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-width:0}.g72-supply-head>b{min-width:0;overflow-wrap:anywhere}
.g72-supply-recipe ul{margin:8px 0 0;padding-left:18px}.g72-supply-recipe li{margin:4px 0;overflow-wrap:anywhere;word-break:break-word}
.g72-team-supply code{white-space:normal;overflow-wrap:anywhere;word-break:break-word}
.war-team-status.blocked{background:#fbe5e3;color:#8c1d18}.war-team-status.review{background:#fff0c2;color:#725800}
@media(max-width:700px){
  #diagnostics .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
  #diagnostics .cards article{padding:12px}
  #diagnostics .cards strong{font-size:clamp(.82rem,4vw,1.15rem)}
  .recipe-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .recipe-stat-card{padding:10px}.recipe-stat-card strong{font-size:1.08rem}.recipe-stat-card small{font-size:.7rem}
  .recipe-summary-meta{font-size:.76rem}
  .g72-team-supply{padding:11px;margin:14px 0}.g72-supply-list{grid-template-columns:1fr}.g72-supply-head{flex-direction:column}
}
@media(max-width:360px){#diagnostics .cards,.recipe-summary-grid{grid-template-columns:1fr 1fr}.recipe-stat-card{padding:9px}.recipe-stat-card strong{font-size:1rem}}
`;

export function installV0415UiPolish(){
  if(typeof document==='undefined'||document.getElementById(STYLE_ID))return false;
  const style=document.createElement('style');style.id=STYLE_ID;style.dataset.uiPolishVersion=V0415_UI_POLISH_VERSION;style.textContent=CSS;document.head.appendChild(style);return true;
}

installV0415UiPolish();
