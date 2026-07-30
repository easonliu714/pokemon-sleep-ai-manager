const status = document.getElementById('dbStatus');
const warning = document.getElementById('storageWarning');

function fail(error) {
  console.error('Application bootstrap failed', error);
  if (status) {
    status.textContent = '載入失敗';
    status.className = 'badge error';
  }
  if (warning) {
    warning.textContent = `前端模組載入失敗：${error?.message || error}`;
    warning.classList.remove('hidden');
  }
}

import('./app.js?v=20260731-g3fix3').catch(fail);
