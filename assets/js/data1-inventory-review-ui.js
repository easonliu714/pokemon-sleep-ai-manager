import {bulkPatchInventoryReview,buildReviewPackage,filterInventoryItems,summarizeReviewProgress} from './data1-inventory-review.js';
import {downloadPrivateZipInventory} from './data1-zip-inventory.js';

const STATUS_OPTIONS=['pending','processed','duplicate','unreadable','review_required','ignored'];
const CATEGORY_OPTIONS=['unclassified','pokemon','recipe','ingredient','item','capacity','account','other'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const downloadJson=(payload,fileName)=>{const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
const safeBase=name=>String(name||'pokemon_sleep').replace(/\.zip$/i,'').replace(/[^a-zA-Z0-9_-]+/g,'_');

export function createInventoryReviewWorkbench({manifest,onChange=()=>{}}={}){
  const root=document.createElement('section');
  root.className='data1-review-workbench';
  let current=manifest;
  let selected=new Set();
  let filters={status:'all',category:'all',query:''};
  let feedback='';

  const render=()=>{
    const summary=summarizeReviewProgress(current);
    const items=filterInventoryItems(current,filters);
    root.innerHTML=`
      <h4>私人清點覆核工作台</h4>
      <div class="data1-review-summary">
        <div><strong>總數</strong><br>${summary.total}</div><div><strong>已覆核</strong><br>${summary.reviewed}</div><div><strong>需注意</strong><br>${summary.attention}</div><div><strong>進度</strong><br>${summary.percent}%</div>
      </div>
      <div class="data1-review-filters">
        <select id="data1ReviewStatusFilter"><option value="all">全部狀態</option>${STATUS_OPTIONS.map(v=>`<option value="${v}"${filters.status===v?' selected':''}>${v}</option>`).join('')}</select>
        <select id="data1ReviewCategoryFilter"><option value="all">全部分類</option>${CATEGORY_OPTIONS.map(v=>`<option value="${v}"${filters.category===v?' selected':''}>${v}</option>`).join('')}</select>
        <input id="data1ReviewQuery" type="search" placeholder="搜尋檔名、路徑、備註" value="${escapeHtml(filters.query)}">
      </div>
      <div class="data1-review-batch">
        <label><input id="data1ReviewSelectAll" type="checkbox"> 全選目前結果</label>
        <select id="data1ReviewBatchStatus"><option value="">批次狀態</option>${STATUS_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join('')}</select>
        <select id="data1ReviewBatchCategory"><option value="">批次分類</option>${CATEGORY_OPTIONS.map(v=>`<option value="${v}">${v}</option>`).join('')}</select>
        <button id="data1ReviewApplyBatch" class="secondary">套用到已選項目</button>
      </div>
      <div class="data1-review-list">${items.slice(0,200).map(item=>`
        <article class="data1-review-item">
          <label><input class="data1-review-check" type="checkbox" data-ref="${escapeHtml(item.source_image_ref)}"${selected.has(item.source_image_ref)?' checked':''}> <strong>${escapeHtml(item.file_name)}</strong></label>
          <small>${escapeHtml(item.path)}</small>
          <div>狀態：${escapeHtml(item.status)}｜分類：${escapeHtml(item.category)}｜信心：${item.confidence??'—'}</div>
        </article>`).join('')||'<div class="notice">目前篩選沒有項目。</div>'}</div>
      ${items.length>200?`<div class="notice">目前僅顯示前 200 筆，共 ${items.length} 筆；可使用篩選縮小範圍。</div>`:''}
      <div class="buttons"><button id="data1ReviewExportManifest" class="secondary">匯出已覆核 Manifest</button><button id="data1ReviewExportPackage" class="secondary">匯出 Review Package</button></div>
      <div id="data1ReviewFeedback" role="status" aria-live="polite">${feedback?`<div class="notice success">${escapeHtml(feedback)}</div>`:''}</div>`;

    root.querySelector('#data1ReviewStatusFilter').addEventListener('change',event=>{filters.status=event.target.value;render();});
    root.querySelector('#data1ReviewCategoryFilter').addEventListener('change',event=>{filters.category=event.target.value;render();});
    root.querySelector('#data1ReviewQuery').addEventListener('change',event=>{filters.query=event.target.value;render();});
    root.querySelectorAll('.data1-review-check').forEach(box=>box.addEventListener('change',()=>{box.checked?selected.add(box.dataset.ref):selected.delete(box.dataset.ref);}));
    root.querySelector('#data1ReviewSelectAll').addEventListener('change',event=>{for(const item of items){event.target.checked?selected.add(item.source_image_ref):selected.delete(item.source_image_ref);}render();});
    root.querySelector('#data1ReviewApplyBatch').addEventListener('click',()=>{
      const status=root.querySelector('#data1ReviewBatchStatus').value;
      const category=root.querySelector('#data1ReviewBatchCategory').value;
      if(!selected.size){feedback='請先勾選至少一個項目。';render();return;}
      if(!status&&!category){feedback='請選擇要套用的狀態或分類。';render();return;}
      current=bulkPatchInventoryReview(current,[...selected],{...(status?{status}:{}),...(category?{category}:{})});
      feedback=`已更新 ${selected.size} 筆項目。`;
      globalThis.DebugTrace?.record?.('data1','inventory_review_batch_applied',{status:'completed',details:{selected_count:selected.size,status:status||null,category:category||null}});
      selected=new Set();
      onChange(current);
      render();
    });
    root.querySelector('#data1ReviewExportManifest').addEventListener('click',()=>{
      const fileName=`${safeBase(current?.archive?.name)}_reviewed_inventory_manifest.json`;
      downloadPrivateZipInventory(current,{fileName});
      feedback=`已下載 ${fileName}`;
      globalThis.DebugTrace?.record?.('data1','reviewed_manifest_exported',{status:'completed',details:{file_name:fileName,total:current?.summary?.total||0}});
      render();
    });
    root.querySelector('#data1ReviewExportPackage').addEventListener('click',()=>{
      const fileName=`${safeBase(current?.archive?.name)}_private_review_package.json`;
      const reviewPackage=buildReviewPackage(current);
      downloadJson(reviewPackage,fileName);
      feedback=`已下載 ${fileName}`;
      globalThis.DebugTrace?.record?.('data1','review_package_exported',{status:'completed',details:{file_name:fileName,total:reviewPackage?.summary?.total||0}});
      render();
    });
  };

  render();
  return root;
}
