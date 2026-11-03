// G9R official article identity must come from the visible article H1,
// never from a stale mention elsewhere in the page. Read-only source guard.
const compact=value=>String(value).normalize('NFKC').replace(/\s+/g,'');
export function assertOfficialArticleHeading(html,expectedHeading){
  if(typeof html!=='string'||typeof expectedHeading!=='string'||!expectedHeading)
    throw new Error('G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED:INVALID_INPUT');
  const visible=html.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  const headings=[...visible.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map(match=>compact(match[1].replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
      .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')));
  const articleHeadings=headings.filter(value=>
    /^〖(?:活動|企畫|預告)〗/.test(value));
  if(articleHeadings.length!==1||articleHeadings[0]!==compact(expectedHeading))
    throw new Error('G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED:ARTICLE_HEADING_CHANGED_OR_DUPLICATED');
  return true;
}
