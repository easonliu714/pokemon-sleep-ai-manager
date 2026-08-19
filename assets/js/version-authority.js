(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.4.27.14',
    app_build: '20260819-v042714-nickname-guard-bidirectional-review',
    cache_name: 'pokemon-sleep-ai-v0.4.27.14-v042714-nickname-guard-bidirectional-review',
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
// app_version: 'v0.4.27.13'
// app_build: '20260819-v042713-physical-validation-closure'
// cache_name: 'pokemon-sleep-ai-v0.4.27.13-v042713-physical-validation-closure'
// app_version: 'v0.4.27.12'
// app_build: '20260819-v042712-confirmation-lifecycle-ux'
// cache_name: 'pokemon-sleep-ai-v0.4.27.12-v042712-confirmation-lifecycle-ux'
// app_version: 'v0.4.27.11'
