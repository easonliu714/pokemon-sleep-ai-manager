(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.95.1',
    app_build: '20260807-v03951-standard-catalog-schema-first-entry',
    cache_name: 'pokemon-sleep-ai-v0.3.95.1-v03951-standard-catalog-schema-first-entry',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
