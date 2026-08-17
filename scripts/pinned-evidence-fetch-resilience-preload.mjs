import {installPinnedEvidenceFetchResilience,PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION} from './pinned-evidence-fetch-resilience.mjs';

installPinnedEvidenceFetchResilience({
  onRetry:event=>console.warn(`[pinned-evidence] retry ${JSON.stringify(event)}`),
  onFallback:event=>console.warn(`[pinned-evidence] fallback ${JSON.stringify(event)}`),
});

console.warn(`[pinned-evidence] transport=${PINNED_EVIDENCE_FETCH_RESILIENCE_VERSION}`);
