(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.98',
    app_build: '20260807-v0398-update-center-multiscenario-dryrun-state',
    cache_name: 'pokemon-sleep-ai-v0.3.98-v0398-update-center-multiscenario-dryrun-state',
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
// app_version: 'v0.3.97'
// app_version: 'v0.3.96'
// app_version: 'v0.3.95.2'
// app_version: 'v0.3.95.1'
// app_version: 'v0.3.95'
