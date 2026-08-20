import { SOUND_KEYS, isSoundKey } from './sound-keys.js';

const MAX_CUSTOM_SOUND_BYTES = 512000;

const base64ToBuffer = function(base64) {
	if(typeof base64 !== 'string') {
		throw new Error('Custom sound must be a base64 string');
	}
	if(base64.length > Math.ceil(MAX_CUSTOM_SOUND_BYTES / 3) * 4) {
		throw new Error('Custom sound is too large');
	}
	let binary = atob(base64);
	let buffer = new ArrayBuffer(binary.length);
	let bytes = new Uint8Array(buffer);
	for(let index = 0; index < buffer.byteLength; index++) {
		bytes[index] = binary.charCodeAt(index) & 0xFF;
	}
	return buffer;
};

export const createFirefoxAudio = function(api, log = console) {
	const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
	const ctx = new AudioContextClass();
	let buffers = {};

	const decode = function(arrayBuffer, key) {
		return Promise.resolve().then(function() {
			let buffer = typeof arrayBuffer === 'string' ? base64ToBuffer(arrayBuffer) : arrayBuffer;
			return ctx.decodeAudioData(buffer);
		}).then(function(decodedData) {
			buffers[key] = decodedData;
		});
	};

	const loadOne = function(customSounds, defaultSoundPaths, key) {
		if(!isSoundKey(key)) {
			return Promise.resolve();
		}
		if(customSounds[key]) {
			return decode(customSounds[key], key).catch(function(error) {
				log.error(`Failed to load custom sound ${key}:`, error);
				return loadDefault(defaultSoundPaths, key);
			});
		}
		return loadDefault(defaultSoundPaths, key);
	};

	const loadDefault = function(defaultSoundPaths, key) {
		return fetch(api.runtime.getURL(defaultSoundPaths[key]))
			.then(function(response) {
				if(!response.ok) {
					throw new Error(`Failed to load ${defaultSoundPaths[key]}: ${response.status}`);
				}
				return response.arrayBuffer();
			})
			.then(function(buffer) {
				return decode(buffer, key);
			});
	};

	const load = function(customSounds, defaultSoundPaths) {
		return Promise.all(SOUND_KEYS.map(function(key) {
			return loadOne(customSounds, defaultSoundPaths, key);
		})).then(function() {});
	};

	const play = function(key) {
		if(!isSoundKey(key)) {
			return Promise.reject(new Error(`Unknown sound key: ${key}`));
		}
		if(!buffers[key]) {
			log.warn(`Sound is not loaded: ${key}`);
			return Promise.resolve();
		}
		let resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
		return resume.then(function() {
			let source = ctx.createBufferSource();
			source.buffer = buffers[key];
			source.connect(ctx.destination);
			source.start(0);
		});
	};

	return { load, play };
};
