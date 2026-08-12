export const V0417_G74_AI_INTAKE_UI_VERSION='v0417-g74-ai-intake-ui-2026-08-12-a';
const STYLE_ID='pokemonSleepV0417G74AiIntakeUi';
const CSS=`
.g74-ai-intake{min-width:0;max-width:100%;margin-top:14px;border-top:1px solid #dbe4df;padding-top:14px}
.g74-ai-intake textarea{width:100%;min-height:180px;max-height:420px;resize:vertical;box-sizing:border-box;font:0.82rem/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere;word-break:break-word}
.g74-ai-intake .buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.g74-ai-intake .proposal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:10px;min-width:0}
.g74-ai-intake .proposal-card{min-width:0;max-width:100%;border:1px solid #dbe4df;border-radius:10px;padding:10px;background:#fbfdfc}
.g74-ai-intake .proposal-card.rejected{background:#fff8f3;border-color:#ecd6c7}
.g74-ai-intake code,.g74-ai-intake pre,.g74-ai-intake .proposal-card{overflow-wrap:anywhere;word-break:break-word}
.g74-ai-intake .status-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.g74-ai-intake .status-pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;background:#eef5f1;font-size:.8rem}
.g74-ai-intake .status-pill.hold{background:#fff3cd}.g74-ai-intake .status-pill.fail{background:#fde2e2}.g74-ai-intake .status-pill.pass{background:#dff3e8}
@media(max-width:700px){.g74-ai-intake .buttons button{flex:1 1 145px}.g74-ai-intake textarea{min-height:220px;font-size:.76rem}.g74-ai-intake .proposal-grid{grid-template-columns:1fr}}
`;
export function installV0417G74AiIntakeUi(){if(typeof document==='undefined'||document.getElementById(STYLE_ID))return false;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;document.head.appendChild(style);return true;}
installV0417G74AiIntakeUi();
