// G9R scheduled official-source audit: bounded, public-only response provenance.
// This is diagnostic evidence, NOT an authority promotion or a network retry.
// Never log raw HTML, cookies, headers other than Content-Type, or player data.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertOfficialArticleHeading,decodeOfficialVisibleEntities} from './g9r-official-article-heading-guard.mjs';

const OFFICIAL=/^https:\/\/www\.pokemonsleep\.net\/zh\/news\/[0-9]+\/$/;

// Structural diagnostics only: a live site can change H1 markup independently
// of the event facts. Emit bounded counts/hashes, never raw headings or HTML.
// This must NEVER be used to bypass the strict article-heading authority guard.
function headingStructureProbe(body,markers){
  const visible=body.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(?:noscript|textarea|template)\b[^>]*>[\s\S]*?<\/(?:noscript|textarea|template)>/gi,' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
  const compact=value=>decodeOfficialVisibleEntities(
    String(value).replace(/<[^>]+>/g,' '))
    .normalize('NFKC').replace(/\s+/g,'');
  const headings=tag=>[...visible.matchAll(new RegExp('<'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/'+tag+'>','gi'))]
    .map(match=>compact(match[1]));
  const h1=headings('h1'),h2=headings('h2');
  const article=value=>/^〖(?:活動|企畫|預告)〗/.test(value);
  const articleH1=h1.filter(article);
  const title=typeof markers.title==='string'?compact(markers.title):'';
  // Scheduled raw-HTML H1=0 is not an invitation to trust metadata as H1.
  // Probe ONLY the unique <head>, emit bounded counts (no raw titles/HTML),
  // and keep every metadata observation diagnostic-only.
  const heads=[...visible.matchAll(/<head\b[^>]*>([\s\S]*?)<\/head>/gi)];
  const head=heads.length===1?heads[0][1]:'';
  const documentTitles=[...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .map(match=>compact(match[1]));
  const ogTitles=[...head.matchAll(/<meta\b[^>]*>/gi)].flatMap(match=>{
    const property=match[0].match(/(?:^|\s)property\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if((property?.[1]??property?.[2]??property?.[3])!=='og:title')return [];
    const content=match[0].match(/(?:^|\s)content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    return content?[compact(content[1]??content[2]??content[3])]:[];
  });
  const matchesTitle=value=>Boolean(title)&&value.includes(title);
  const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
  return Object.freeze({
    visible_h1_count:Math.min(h1.length,99),
    // Distinguish HTML entity encoding from an actual missing/relocated H1.
    numeric_entity_h1_count:Math.min([...visible.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
      .filter(m=>/&#(?:x[0-9a-f]+|\d+);/i.test(m[1])).length,99),
    visible_h2_count:Math.min(h2.length,99),
    article_h1_count:Math.min(articleH1.length,99),
    article_h2_count:Math.min(h2.filter(article).length,99),
    title_fragment_h1_count:Math.min(h1.filter(matchesTitle).length,99),
    title_fragment_h2_count:Math.min(h2.filter(matchesTitle).length,99),
    article_h1_normalized_sha256:Object.freeze(articleH1.slice(0,3).map(sha)),
    head_metadata:Object.freeze({
      head_container_count:Math.min(heads.length,99),
      document_title_count:Math.min(documentTitles.length,99),
      og_title_count:Math.min(ogTitles.length,99),
      title_fragment_document_title_count:Math.min(documentTitles.filter(matchesTitle).length,99),
      title_fragment_og_title_count:Math.min(ogTitles.filter(matchesTitle).length,99),
      diagnostic_only:true,
    }),
    diagnostic_only:true,
  });
}

export function summarizeOfficialLiveResponse({key,expectedUrl,response,html,markers={}}={}){
  if(!/^[a-z_]{1,32}$/.test(key||'')||!OFFICIAL.test(expectedUrl||''))
    throw new Error('G9R_PROVENANCE_UNTRUSTED_SOURCE_KEY_OR_URL');
  const body=String(html??'');
  const finalUrl=String(response?.url??'');
  const contentType=String(response?.headers?.get?.('content-type')??'')
    .slice(0,96).replace(/[^a-zA-Z0-9;=\/_ .+-]/g,'');
  const markerPresence={};
  for(const [label,needle] of Object.entries(markers)){
    if(!/^[a-z_]{1,32}$/.test(label)||typeof needle!=='string'||!needle)
      throw new Error('G9R_PROVENANCE_INVALID_MARKER');
    markerPresence[label]=body.includes(needle);
  }
  return Object.freeze({
    source_key:key,expected_url:expectedUrl,
    final_url:OFFICIAL.test(finalUrl)?finalUrl:'UNTRUSTED_OR_MISSING',
    exact_url_match:finalUrl===expectedUrl,
    http_status:Number.isInteger(response?.status)?response.status:null,
    content_type:contentType,
    utf8_bytes:Buffer.byteLength(body,'utf8'),
    html_sha256:createHash('sha256').update(body,'utf8').digest('hex'),
    html_document_tag_present:/<html\b/i.test(body),
    literal_marker_presence:Object.freeze(markerPresence),
    marker_check_is_diagnostic_only:true,
    heading_structure:headingStructureProbe(body,markers),
    raw_html_logged:false,player_data_logged:false,
  });
}

export function offlineProvenanceRegression(){
  const expectedUrl='https://www.pokemonsleep.net/zh/news/123456/';
  const secret='SYNTHETIC_PRIVATE_DO_NOT_LOG';
  const html='<html><body><h1>OFFICIAL_TITLE</h1>'+secret+'</body></html>';
  const response={url:expectedUrl,status:200,headers:{get:key=>
    key==='content-type'?'text/html; charset=utf-8':secret}};
  const result=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,response,html,
    markers:{title:'OFFICIAL_TITLE',bonus:'〖所有日子〗'}});
  assert.equal(result.final_url,expectedUrl);
  assert.equal(result.exact_url_match,true);
  assert.equal(result.utf8_bytes,Buffer.byteLength(html,'utf8'));
  assert.equal(result.html_sha256,createHash('sha256').update(html).digest('hex'));
  assert.deepEqual(result.literal_marker_presence,{title:true,bonus:false});
  assert.equal(result.heading_structure.visible_h1_count,1);
  assert.equal(result.heading_structure.article_h1_count,0);
  assert.equal(result.heading_structure.title_fragment_h1_count,1);
  assert.deepEqual(result.heading_structure.article_h1_normalized_sha256,[]);
  // Real scheduled 2026-11-04 live source-watch returned three H1 identity HOLDs.
  // Distinguish missing, relocated and duplicated visible article headings
  // without exposing official raw HTML, arbitrary headers or player content.
  const title='〖活動〗第19次「新月日」';
  // G9R negative-first: the raw response can contain a stale official H1
  // inside a hidden ancestor. A diagnostic named "visible" must not count it
  // as published article identity; a separate visible sibling must still count.
  for(const attrs of ['hidden','inert','aria-hidden="true"',
    'style="display:none"','style="visibility:hidden"']){
    const hiddenAncestor='<div '+attrs+'><h1>'+title+'</h1></div>';
    const invisible=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
      response,html:'<html><body>'+hiddenAncestor+'<h1>Pokémon Sleep</h1></body></html>',
      markers:{title}});
    assert.equal(invisible.heading_structure.article_h1_count,0,
      'hidden ancestor cannot count as a visible official article H1: '+attrs);
    assert.equal(invisible.heading_structure.title_fragment_h1_count,0);
    const visibleSibling=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
      response,html:'<html><body>'+hiddenAncestor+'<h1>'+title+'</h1></body></html>',
      markers:{title}});
    assert.equal(visibleSibling.heading_structure.article_h1_count,1,
      'hidden duplicate must not mask a real visible official H1: '+attrs);
  }
  console.log('PASS G9R_RAW_H1_HIDDEN_ANCESTOR_DIAGNOSTIC_NEGATIVE_FIRST');
  const structural='<html><body><noscript><h1>'+title+'</h1></noscript>'
    +'<textarea><h1>'+title+'</h1></textarea>'
    +'<h1>〖活動〗另一活動</h1><h2>'+title+'</h2></body></html>';
  const probe=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:structural+secret,markers:{title}});
  assert.equal(probe.heading_structure.visible_h1_count,1);
  assert.equal(probe.heading_structure.article_h1_count,1);
  assert.equal(probe.heading_structure.article_h2_count,1);
  assert.equal(probe.heading_structure.title_fragment_h1_count,0);
  assert.equal(probe.heading_structure.title_fragment_h2_count,1);
  assert.equal(probe.heading_structure.article_h1_normalized_sha256.length,1);
  assert.match(probe.heading_structure.article_h1_normalized_sha256[0],/^[a-f0-9]{64}$/);
  assert.equal(probe.heading_structure.diagnostic_only,true);
  assert.ok(!JSON.stringify(probe).includes(secret));
  assert.ok(!JSON.stringify(probe).includes('另一活動'));
  const encoded=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:'<html><h1>&#x3016;活動&#12311;第19次「新月日」</h1></html>',
    markers:{title:'第19次「新月日」'}});
  assert.equal(encoded.heading_structure.numeric_entity_h1_count,1);
  assert.equal(encoded.heading_structure.article_h1_count,1);
  assert.equal(encoded.heading_structure.title_fragment_h1_count,1);
  const duplicated=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:'<html><h1>'+title+'</h1><h1>'+title+'</h1></html>',
    markers:{title}});
  assert.equal(duplicated.heading_structure.article_h1_count,2);
  assert.equal(duplicated.heading_structure.title_fragment_h1_count,2);
  assert.equal(duplicated.heading_structure.article_h1_normalized_sha256.length,2);

  // G9R negative-first: a real scheduled raw HTML response has zero article H1
  // even though the rendered official page exposes a title. Metadata can
  // diagnose an SSR/markup relocation but must NEVER certify article identity.
  const metadataHtml='<html><head><title>'+title+' - Pokémon Sleep</title>'
    +'<meta content="'+title+'" property="og:title"></head>'
    +'<body><div>'+secret+'</div></body></html>';
  const metadataOnly=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:metadataHtml,markers:{title}});
  assert.equal(metadataOnly.heading_structure.article_h1_count,0);
  assert.deepEqual(metadataOnly.heading_structure.head_metadata,{
    head_container_count:1,document_title_count:1,og_title_count:1,
    title_fragment_document_title_count:1,title_fragment_og_title_count:1,
    diagnostic_only:true,
  });
  assert.throws(()=>assertOfficialArticleHeading(metadataHtml,title),
    /G9R_OFFICIAL_ARTICLE_H1_REVIEW_REQUIRED/,
    'metadata-only title is never official article authority');
  assert.ok(!JSON.stringify(metadataOnly).includes(secret));
  const duplicateMeta=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:metadataHtml.replace('</head>',
      '<meta property="og:title" content="'+title+'"></head>'),markers:{title}});
  assert.equal(duplicateMeta.heading_structure.head_metadata.og_title_count,2);
  assert.equal(duplicateMeta.heading_structure.article_h1_count,0);
  const bodyMeta=summarizeOfficialLiveResponse({key:'new_moon',expectedUrl,
    response,html:'<html><body><meta property="og:title" content="'+title+'"></body></html>',
    markers:{title}});
  assert.equal(bodyMeta.heading_structure.head_metadata.og_title_count,0);
  console.log('PASS G9R_HEAD_METADATA_DIAGNOSTIC_ONLY_ZERO_H1_NOT_AUTHORITY');

  assert.equal(result.raw_html_logged,false);
  assert.equal(result.player_data_logged,false);
  assert.ok(!JSON.stringify(result).includes(secret),'no response body or arbitrary headers logged');
  const redirected=summarizeOfficialLiveResponse({key:'banquet',expectedUrl,
    response:{...response,url:'https://example.com/?token='+secret},html});
  assert.equal(redirected.final_url,'UNTRUSTED_OR_MISSING');
  assert.equal(redirected.exact_url_match,false);
  assert.ok(!JSON.stringify(redirected).includes(secret));
  assert.throws(()=>summarizeOfficialLiveResponse({key:'x',expectedUrl:'https://example.com',html}),
    /UNTRUSTED_SOURCE_KEY_OR_URL/);
  assert.throws(()=>summarizeOfficialLiveResponse({key:'x',expectedUrl,html,
    markers:{'not-safe!':secret}}),/INVALID_MARKER/);
  console.log('PASS G9R_LIVE_OFFICIAL_RESPONSE_PROVENANCE_SHA256_BOUNDED_METADATA');
  console.log('PASS G9R_LIVE_OFFICIAL_RESPONSE_NO_RAW_HTML_NO_ARBITRARY_HEADERS_OR_URL_LEAK');
  console.log('HOLD G9R_OFFICIAL_LIVE_RESPONSE_CONTENT_UNCLASSIFIED_UNTIL_SCHEDULED_EVIDENCE');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  offlineProvenanceRegression();
