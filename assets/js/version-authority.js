(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.4.0',
    app_build: '20260808-v0400-public-pokemon-master-coverage-triage',
    cache_name: 'pokemon-sleep-ai-v0.4.0-v0400-public-pokemon-master-coverage-triage',
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
// app_version: 'v0.3.99.4'
// app_version: 'v0.3.99.3'
// app_version: 'v0.3.99.2'
// app_version: 'v0.3.99.1'
// app_version: 'v0.3.99'
// app_version: 'v0.3.98.2'
// app_version: 'v0.3.98.1'
// app_version: 'v0.3.98'
// app_version: 'v0.3.97'
// app_version: 'v0.3.96'
// app_version: 'v0.3.95.2'
// app_version: 'v0.3.95.1'
// app_version: 'v0.3.95'
