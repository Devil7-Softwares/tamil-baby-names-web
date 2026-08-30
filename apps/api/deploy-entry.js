import { register } from 'node:module';

// The host installs from the deployed package.json, and its node_modules does
// not survive a `file:` dependency, so @tbn/shared is resolved by a hook
// pointing at the copy shipped beside this file.
register('./resolve-shared.js', import.meta.url);

// Not awaited: a top-level await would make this module asynchronous, which the
// host's require() of the startup file cannot load.
void import('./main.js');
