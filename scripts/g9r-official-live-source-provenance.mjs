// G9R scheduled official-source audit: bounded, public-only response provenance.
// This is diagnostic evidence, NOT an authority promotion or a network retry.
// Never log raw HTML, cookies, headers other than Content-Type, or player data.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const OFFICIAL=/^https:\/\/www\.pokemonsleep\.net\/zh\/news\/[0-9]+\/$/;
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
