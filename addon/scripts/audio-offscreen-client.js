import { isSoundKey } from './sound-keys.js';

export const createOffscreenAudioClient = function(api, log = console) {
	const OFFSCREEN_URL = 'offscreen/audio.html';
	let creating = null;

	const hasOffscreenDocument = function() {
		if(!api.offscreen) {
			return Promise.resolve(false);
		}
		if(api.runtime.getContexts) {
			return api.runtime.getContexts({
				contextTypes: ['OFFSCREEN_DOCUMENT'],
				documentUrls: [api.runtime.getURL(OFFSCREEN_URL)]
			}).then(function(contexts) {
				return contexts.length > 0;
			});
		}
		if(globalThis.clients) {
			return clients.matchAll().then(function(clientList) {
				let offscreenUrl = api.runtime.getURL(OFFSCREEN_URL);
				return clientList.some(function(client) {
					return client.url === offscreenUrl;
				});
			});
		}
		return Promise.resolve(false);
	};

	const ensureOffscreenDocument = function() {
		if(!api.offscreen) {
			return Promise.reject(new Error('Offscreen documents are not available'));
		}
		return hasOffscreenDocument().then(function(exists) {
			if(exists) {
				return;
			}
			if(!creating) {
				creating = api.offscreen.createDocument({
					url: OFFSCREEN_URL,
					reasons: ['AUDIO_PLAYBACK'],
					justification: 'Play extension notification sounds.'
				}).finally(function() {
					creating = null;
				});
			}
			return creating;
		});
	};

	const send = function(message) {
		return ensureOffscreenDocument().then(function() {
			return api.runtime.sendMessage(message);
		});
	};

	const load = function(customSounds, defaultSoundPaths) {
		return send({
			type: 'extra-sounds:load-sounds',
			customSounds,
			defaultSoundPaths
		}).catch(function(error) {
			log.error('Failed to load offscreen sounds:', error);
		});
	};

	const play = function(key) {
		if(!isSoundKey(key)) {
			return Promise.reject(new Error(`Unknown sound key: ${key}`));
		}
		return send({
			type: 'extra-sounds:play-sound',
			key
		});
	};

	return { load, play };
};
