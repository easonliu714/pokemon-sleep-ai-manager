(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.4.27.55.3.3.10',
    app_build: '20260917-v0427553310-real-device-followup',
    cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.10-v0427553310-real-device-followup',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);

// Legacy CI parser bridge only; not executed and not a release authority.
// Keep exact historical literals required by successor-aware release/behavior contracts.
// app_version: 'v0.4.27.55.3.3.9'
// app_build: '20260914-v042755339-duration-berry-visual-authority'
// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.9-v042755339-duration-berry-visual-authority'
// app_version: 'v0.4.27.55.3.3.4'
// app_build: '20260908-v042755334-page-status-visibility-watchdog'
// cache_name: 'pokemon-sleep-ai-v0.4.27.55.3.3.4-v042755334-page-status-visibility-watchdog'
// app_version: 'v0.4.27.55.3.3.3'
// app_version: 'v0.4.13.6'
// app_build: '20260812-v04136-pot-manual-authority-alignment'
// app_version: 'v0.4.13.5'
// app_version: 'v0.4.13.2'
// app_build: '20260812-v04132-pot-authority-recipe78'
// cache_name: 'pokemon-sleep-ai-v0.4.13.2-v04132-pot-authority-recipe78'
// app_version: 'v0.3.97'
// app_version: 'v0.3.96'
