(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.3.95',
    app_build: '20260806-v0395-canonical-rescue-and-bootstrap-pipeline',
    cache_name: 'pokemon-sleep-ai-v0.3.95-v0395-canonical-rescue-and-bootstrap-pipeline',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
