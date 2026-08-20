import { createCore } from './core.js';
import { createFirefoxAudio } from './audio-firefox.js';

const api = globalThis.browser;
const sound = createFirefoxAudio(api);

createCore(api, sound).start();
