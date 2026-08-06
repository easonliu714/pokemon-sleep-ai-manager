(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.94',
    app_build: '20260806-v0394-live-version-handoff-post-migration-watchdog',
    cache_name: 'pokemon-sleep-ai-v0.3.94-v0394-live-version-handoff-post-migration-watchdog',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
