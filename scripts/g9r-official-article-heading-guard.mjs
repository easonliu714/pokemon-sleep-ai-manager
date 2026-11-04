// G9R official article identity must come from the visible article H1,
// never from a stale mention elsewhere in the page. Read-only source guard.
const compact=value=>String(value).normalize('NFKC').replace(/\s+/g,'');
// A browser renders valid decimal/hex HTML character references as characters.
// Decode only visible text AFTER stripping markup; never treat decoded tags as HTML.
// This preserves exact article H1 identity, duplicate rejection and fail-closed drift.
export function decodeOfficialVisibleEntities(value){
  return String(value).replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));/gi,
    (original,hex,decimal)=>{
      const code=Number.parseInt(hex??decimal,hex===undefined?10:16);
      return Number.isInteger(code)&&code>0&&code<=0x10ffff&&
        !(code>=0xd800&&code<=0xdfff)
        ?String.fromCodePoint(code):original;
    })
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
export function assertOfficialArticleHeading(html,expectedHeading){
  if(typeof html!=='string'||typeof expectedHeading!=='string'||!expectedHeading)
    throw new Error('G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED:INVALID_INPUT');
  // Ignore non-rendered fallback/input containers before selecting the authoritative article H1.
  // Otherwise a stale hidden H1 can impersonate a changed visible official article.
  const visible=html.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,' ')
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  // A non-rendered H1 cannot certify current article identity. Attribute-level
  // hidden/inert/aria-hidden/inline-style evidence is fail-closed; this is not
  // a general CSS visibility engine and never relaxes the exact visible title.
  const hiddenH1=attributes=>{
    if(/(?:^|\s)(?:hidden|inert)(?=\s|=|$)/i.test(attributes))return true;
    if(/(?:^|\s)aria-hidden\s*=\s*(?:"true"|'true'|true)(?=\s|$)/i.test(attributes))return true;
    const style=attributes.match(/(?:^|\s)style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    return Boolean(style&&/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!important)?\s*(?:;|$)/i
      .test(style[1]??style[2]??''));
  };
  const headings=[...visible.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi)]
    .filter(match=>!hiddenH1(match[1]))
    .map(match=>compact(decodeOfficialVisibleEntities(
      match[2].replace(/<[^>]+>/g,' '))));
  const articleHeadings=headings.filter(value=>
    /^〖(?:活動|企畫|預告)〗/.test(value));
  if(articleHeadings.length!==1||articleHeadings[0]!==compact(expectedHeading))
    throw new Error('G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED:ARTICLE_HEADING_CHANGED_OR_DUPLICATED');
  return true;
}
