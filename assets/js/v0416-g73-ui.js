export const V0416_G73_UI_VERSION='v0416-g73-ui-2026-08-12-a';
const STYLE_ID='pokemonSleepV0416G73Ui';
const CSS=`
.g73-optimization-pack{min-width:0;max-width:100%}
.g73-optimization-pack .buttons{display:flex;gap:8px;flex-wrap:wrap}
.g73-optimization-pack code,.g73-optimization-pack pre{overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}
.g73-optimization-pack details{min-width:0;max-width:100%}
.g73-optimization-pack pre{max-width:100%;max-height:360px;overflow:auto;background:#f5f8f6;border:1px solid #dbe4df;border-radius:10px;padding:10px}
@media(max-width:700px){.g73-optimization-pack .buttons button{flex:1 1 145px}.g73-optimization-pack pre{font-size:.76rem;max-height:300px}}
`;
export function installV0416G73Ui(){if(typeof document==='undefined'||document.getElementById(STYLE_ID))return false;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style);return true;}
installV0416G73Ui();
