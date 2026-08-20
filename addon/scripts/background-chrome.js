import { createCore } from './core.js';
import { createOffscreenAudioClient } from './audio-offscreen-client.js';

const api = globalThis.browser || globalThis.chrome;
const sound = createOffscreenAudioClient(api);

createCore(api, sound).start();
