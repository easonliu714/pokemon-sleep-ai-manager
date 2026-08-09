(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.4.3.1',
    app_build: '20260809-v0431-controlled-selector-live-hotfix',
    cache_name: 'pokemon-sleep-ai-v0.4.3.1-v0431-controlled-selector-live-hotfix',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);

// Legacy CI parser bridge only; not executed and not a release authority:
// app_version: 'v0.4.3'
// app_build: '20260809-v043-recipe-zh-tw-controlled-team-optimizer'
// app_version: 'v0.4.2'
// app_build: '20260809-v042-recipe-war-room-strategy-readiness'
// app_version: 'v0.4.1'
// app_build: '20260808-v041-evolution-master-coverage-completion'
// app_version: 'v0.4.0.4'
// app_build: '20260808-v04004-post-apply-terminal-state-inventory-summary'
// app_version: 'v0.4.0.3'
// app_build: '20260808-v04003-canonical-skill-projection-scenario-review'
// app_version: 'v0.3.97'
// app_version: 'v0.3.96'