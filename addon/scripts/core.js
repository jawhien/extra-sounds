import { SOUND_KEYS } from './sound-keys.js';

const DEFAULT_PREFERENCES = {
	startNavigation: true,
	completeNavigation: true,
	downloadCompleted: true,
	downloadError: true,
	downloadNew: true
};

const DEFAULT_SOUND_PATHS = {
	startNavigation: 'sounds/nav.ogg',
	completeNavigation: 'sounds/nav_complete.ogg',
	downloadCompleted: 'sounds/complete.ogg',
	downloadError: 'sounds/error.ogg',
	downloadNew: 'sounds/newDownload.ogg'
};

export const createCore = function(api, sound, log = console) {
	let preferences = { ...DEFAULT_PREFERENCES };
	let started = false;

	const readStorage = function() {
		return api.storage.local.get();
	};

	const writeMissingPreferences = function(storedPreferences) {
		let missing = {};
		for(let key of SOUND_KEYS) {
			if(storedPreferences[key] === undefined) {
				missing[key] = DEFAULT_PREFERENCES[key];
			}
		}
		if(Object.keys(missing).length === 0) {
			return Promise.resolve();
		}
		return api.storage.local.set({
			preferences: {
				...storedPreferences,
				...missing
			}
		});
	};

	const loadSettings = function(data) {
		let storedPreferences = sanitizePreferences(data.preferences || {});
		preferences = {
			...DEFAULT_PREFERENCES,
			...storedPreferences
		};
		return writeMissingPreferences(storedPreferences).then(function() {
			return sound.load(data.customSounds || {}, DEFAULT_SOUND_PATHS);
		});
	};

	const sanitizePreferences = function(value) {
		let result = {};
		if(!value || typeof value !== 'object') {
			return result;
		}
		for(let key of SOUND_KEYS) {
			if(typeof value[key] === 'boolean') {
				result[key] = value[key];
			}
		}
		return result;
	};

	const onStorageChanged = function(changes, area) {
		if(area !== 'local') {
			return;
		}
		if(changes.preferences) {
			preferences = {
				...preferences,
				...sanitizePreferences(changes.preferences.newValue || {})
			};
		}
		if(changes.customSounds) {
			sound.load(changes.customSounds.newValue || {}, DEFAULT_SOUND_PATHS).catch(function(error) {
				log.error('Failed to reload sounds:', error);
			});
		}
	};

	const play = function(key) {
		sound.play(key).catch(function(error) {
			log.error(`Failed to play sound ${key}:`, error);
		});
	};

	const onNavigationStarted = function(details) {
		if(details.frameId !== 0 || !preferences.startNavigation) {
			return;
		}
		play('startNavigation');
	};

	const onNavigationCompleted = function(details) {
		if(details.frameId !== 0 || !preferences.completeNavigation) {
			return;
		}
		play('completeNavigation');
	};

	const onDownloadCreated = function() {
		if(preferences.downloadNew) {
			play('downloadNew');
		}
	};

	const onDownloadChanged = function(downloadDelta) {
		if(downloadDelta.error && downloadDelta.error.current && preferences.downloadError) {
			play('downloadError');
		}
		if(downloadDelta.state && downloadDelta.state.current === 'complete' && preferences.downloadCompleted) {
			play('downloadCompleted');
		}
	};

	const addListeners = function() {
		api.webNavigation.onBeforeNavigate.addListener(onNavigationStarted);
		api.webNavigation.onCompleted.addListener(onNavigationCompleted);
		api.downloads.onCreated.addListener(onDownloadCreated);
		api.downloads.onChanged.addListener(onDownloadChanged);
		api.storage.onChanged.addListener(onStorageChanged);
	};

	const start = function() {
		if(started) {
			return Promise.resolve();
		}
		started = true;
		addListeners();
		return readStorage()
			.then(loadSettings)
			.catch(function(error) {
				log.error('Failed to start extension background:', error);
				throw error;
			});
	};

	return { start };
};
