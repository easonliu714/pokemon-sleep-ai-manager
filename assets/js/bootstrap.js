const status=document.getElementById('dbStatus');
const warning=document.getElementById('storageWarning');
const fail=(error)=>{
  console.error('Application bootstrap failed',error);
  if(status){status.textContent='載入失敗';status.className='badge error';}
  if(warning){warning.textContent=`前端模組載入失敗：${error?.message||error}。請重新整理；若仍失敗，請清除此網站的快取但不要刪除網站儲存資料。`;warning.classList.remove('hidden');}
};
import('./app.js?v=20260731-g3fix2').catch(fail);
