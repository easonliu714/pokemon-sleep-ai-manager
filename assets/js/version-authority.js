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
