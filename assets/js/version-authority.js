(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.95.2',
    app_build: '20260807-v03952-public-master-version-sync-render-queue',
    cache_name: 'pokemon-sleep-ai-v0.3.95.2-v03952-public-master-version-sync-render-queue',
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
// app_version: 'v0.3.95.1'
// app_version: 'v0.3.95'
