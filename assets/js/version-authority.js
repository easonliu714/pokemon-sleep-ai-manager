(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.99',
    app_build: '20260807-v0399-human-readable-diff-review',
    cache_name: 'pokemon-sleep-ai-v0.3.99-v0399-human-readable-diff-review',
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
// app_version: 'v0.3.98.2'
// app_version: 'v0.3.98.1'
// app_version: 'v0.3.98'
// app_version: 'v0.3.97'
// app_version: 'v0.3.96'
// app_version: 'v0.3.95.2'
// app_version: 'v0.3.95.1'
// app_version: 'v0.3.95'
