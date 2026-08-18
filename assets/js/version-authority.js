(function installVersionAuthority(scope) {
  const authority = Object.freeze({
    app_version: 'v0.4.27.6',
    app_build: '20260818-v04276-g13-internal-observation-parity-progress-ux',
    cache_name: 'pokemon-sleep-ai-v0.4.27.6-v04276-g13-internal-observation-parity-progress-ux',
    schema: 'pokemon-sleep-version-authority/1.0',
  });
  Object.defineProperty(scope, 'PokemonSleepVersionAuthority', {
    value: authority,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);

// Historical parser bridge only; executable runtime authority is the object above.
// app_version: 'v0.4.27.5'
// app_build: '20260817-v04275-pe7-legacy-event-ui-hotfix'
// cache_name: 'pokemon-sleep-ai-v0.4.27.5-v04275-pe7-legacy-event-ui-hotfix'
