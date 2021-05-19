
// constants and variables section

let buffers = new Object();
let preferences = {
	startNavigation:true,
	completeNavigation:true,
	downloadCompleted:true,
	downloadError:true,
	downloadNew:true
};
const ctx = new AudioContext();
let gettingStorage = browser.storage.local.get();

// functions section

const base64ToBuffer = function(base64) {
	let binary = window.atob(base64);
	let buffer = new ArrayBuffer(binary.length);
	let bytes = new Uint8Array(buffer);
	for(let i = 0; i < buffer.byteLength; i++) {
		bytes[i] = binary.charCodeAt(i) & 0xFF;
	}
	return buffer;
};

const loadToBuffer = function(arrayBuffer, key) {
	let buffer;
	if (typeof arrayBuffer === "string" || arrayBuffer instanceof String) {
		buffer = base64ToBuffer(arrayBuffer);
	} else {
		buffer = arrayBuffer;
	}

	ctx.decodeAudioData(buffer).then(function(decodedData) {
		buffers[key] = decodedData;
	});
};

const loadFromUrl = function(url, key) {
	let xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';
	xhr.addEventListener('load', function(e) {
		loadToBuffer(this.response, key);
	});
	xhr.send();
};

const playSound = function(key) {
	let source = ctx.createBufferSource();
	source.buffer = buffers[key];
	source.connect(ctx.destination);
	source.start(0);
};

const loadSounds = function(sounds) {
	if(sounds && sounds.startNavigation) {
		loadToBuffer(sounds.startNavigation, 'startNavigation');
	} else {
		loadFromUrl(browser.runtime.getURL('sounds/nav.ogg'), 'startNavigation');
	}
	if(sounds && sounds.completeNavigation) {
		loadToBuffer(sounds.completeNavigation, 'completeNavigation');
	} else {
		loadFromUrl(browser.runtime.getURL('sounds/nav_complete.ogg'), 'completeNavigation');
	}
	if(sounds && sounds.downloadCompleted) {
		loadToBuffer(sounds.downloadCompleted, 'downloadCompleted');
	} else {
		loadFromUrl(browser.runtime.getURL('sounds/complete.ogg'), 'downloadCompleted');
	}
	if(sounds && sounds.downloadError) {
		loadToBuffer(sounds.downloadError, 'downloadError');
	} else {
		loadFromUrl(browser.runtime.getURL('sounds/error.ogg'), 'downloadError');
	}
	if(sounds && sounds.downloadNew) {
		loadToBuffer(sounds.downloadNew, 'downloadNew');
	} else {
		loadFromUrl(browser.runtime.getURL('sounds/newDownload.ogg'), 'downloadNew');
	}
};

const loadPage = function(details) {
	if(details.frameId > 0) return;
	if(preferences.startNavigation) {
		playSound('startNavigation');
	}
};

const completeLoadPage = function(details) {
	if(details.frameId > 0) return;
	if(preferences.completeNavigation) {
		playSound('completeNavigation');
	}
};

const downloadComplit = function(downloadDelta) {
	if(downloadDelta.error && downloadDelta.error.current) {
		if(preferences.downloadError) {
			playSound('downloadError');
		}
	}
	if(downloadDelta.state && downloadDelta.state.current == "complete") {
		if(preferences.downloadCompleted) {
			playSound('downloadCompleted');
		}
	}
};

const loadStorageData = function(data) {
	let item = data.preferences;
	let write = {};
	write.preferences = {};
	for(key in preferences) {
		if(!item || item[key] == undefined) {
			write.preferences[key] = preferences[key];
		}
		else {
			preferences[key] = item[key];
		}
	}
	if(Object.keys(write.preferences).length > 0) {
		browser.storage.local.set(write);
	}

	let customSounds = new Object();
	if(data.customSounds) {
		customSounds = data.customSounds;
	}
	loadSounds(customSounds);
};

const loadStorageError = function(error) {
	console.log(`Error: ${error}`);
};

const changePreferences = function(changes, area) {
	if("preferences" in changes) {
		let prefs = changes.preferences.newValue;
		let changedItems = Object.keys(prefs);
		for (let item of changedItems) {
			if(preferences[item] != prefs[item]) {
				preferences[item] = prefs[item];
			}
		}
	}

	if("customSounds" in changes) {
		let cs = changes.customSounds.newValue;
		loadSounds(cs);
	}
};

const createDownload = function(item) {
	if(preferences.downloadNew) {
		playSound('downloadNew');
	}

};

// main code section

gettingStorage.then(loadStorageData, loadStorageError);

// add events listeners section

browser.webNavigation.onBeforeNavigate.addListener(loadPage);
browser.webNavigation.onCompleted.addListener(completeLoadPage);
browser.downloads.onChanged.addListener(downloadComplit);
browser.storage.onChanged.addListener(changePreferences);
browser.downloads.onCreated.addListener(createDownload);
