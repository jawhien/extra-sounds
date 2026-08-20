import { SOUND_KEYS, isSoundKey } from '../scripts/sound-keys.js';

const api = globalThis.browser || globalThis.chrome;
const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
const ctx = new AudioContextClass();
let buffers = {};
let currentDefaultSoundPaths = {};
let currentCustomSounds = {};
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

const decode = function(arrayBuffer, key) {
	return Promise.resolve().then(function() {
		let buffer = typeof arrayBuffer === 'string' ? base64ToBuffer(arrayBuffer) : arrayBuffer;
		return ctx.decodeAudioData(buffer);
	}).then(function(decodedData) {
		buffers[key] = decodedData;
	});
};

const loadOne = function(key) {
	if(!isSoundKey(key)) {
		return Promise.resolve();
	}
	if(currentCustomSounds[key]) {
		return decode(currentCustomSounds[key], key).catch(function(error) {
			console.error(`Failed to load custom sound ${key}:`, error);
			return loadDefault(key);
		});
	}
	return loadDefault(key);
};

const loadDefault = function(key) {
	return fetch(api.runtime.getURL(currentDefaultSoundPaths[key]))
		.then(function(response) {
			if(!response.ok) {
				throw new Error(`Failed to load ${currentDefaultSoundPaths[key]}: ${response.status}`);
			}
			return response.arrayBuffer();
		})
		.then(function(buffer) {
			return decode(buffer, key);
		});
};

const loadSounds = function(customSounds, defaultSoundPaths) {
	currentCustomSounds = customSounds || {};
	currentDefaultSoundPaths = defaultSoundPaths || {};
	return Promise.all(SOUND_KEYS.map(loadOne)).then(function() {});
};

const playSound = function(key) {
	if(!isSoundKey(key)) {
		return Promise.reject(new Error(`Unknown sound key: ${key}`));
	}
	if(!buffers[key]) {
		console.warn(`Sound is not loaded: ${key}`);
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

api.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if(!sender || sender.id !== api.runtime.id) {
		return undefined;
	}
	if(!message || typeof message.type !== 'string') {
		return undefined;
	}
	if(message.type === 'extra-sounds:load-sounds') {
		loadSounds(message.customSounds, message.defaultSoundPaths).then(sendResponse).catch(function(error) {
			console.error('Failed to load sounds:', error);
			sendResponse();
		});
		return true;
	}
	if(message.type === 'extra-sounds:play-sound') {
		playSound(message.key).then(sendResponse).catch(function(error) {
			console.error(`Failed to play sound ${message.key}:`, error);
			sendResponse();
		});
		return true;
	}
	return undefined;
});
