const status = document.getElementById('dbStatus');
const warning = document.getElementById('storageWarning');
const VERSION = '20260731-shared-master1';

function showFailure(label, error) {
  console.error(`Module probe failed: ${label}`, error);
  if (status) {
    status.textContent = '載入失敗';
    status.className = 'badge error';
  }
  if (warning) {
    const location = [error?.fileName, error?.lineNumber && `line ${error.lineNumber}`, error?.columnNumber && `column ${error.columnNumber}`]
      .filter(Boolean)
      .join(' · ');
    warning.textContent = `前端模組載入失敗：${label}：${error?.message || error}${location ? `（${location}）` : ''}`;
    warning.classList.remove('hidden');
  }
}

const probes = [
  'storage.js',
  'schema.js',
  'seed-data.js',
  'shared-master-schema.js',
  'shared-master-data.js',
  'database.js',
  'time-utils.js',
  'manual-editor.js',
  'pokemon-detail.js',
  'importer.js',
  'ai-workflow.js',
  'prompt-catalog.js',
  'g3-planning.js',
  'identity-review.js',
  'shared-knowledge-ui.js',
];

(async () => {
  for (const file of probes) {
    try {
      await import(`./${file}?v=${VERSION}`);
    } catch (error) {
      showFailure(file, error);
      return;
    }
  }

  try {
    await import(`./app.js?v=${VERSION}`);
    await import(`./shared-knowledge-ui.js?v=${VERSION}`);
  } catch (error) {
    showFailure('app.js/shared-knowledge-ui.js', error);
  }
})();
