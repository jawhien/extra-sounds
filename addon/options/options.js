
// controls elements section

const startNavBox = document.querySelector('#start-navigation');
const completeNavBox = document.querySelector('#complete-navigation');
const downloadCompletedBox = document.querySelector('#download-completed');
const deCheckBox = document.querySelector('#download-error');
const dnCheckBox = document.querySelector('#download-new');
const resultBox = document.querySelector('#result');
const saveBtn = document.querySelector('#save');
const startNavigationSelect = document.querySelector('#start-navigation-select');
const startNavigationPlay = document.querySelector('#start-navigation-play');
const completeNavigationSelect = document.querySelector('#complete-navigation-select');
const completeNavigationPlay = document.querySelector('#complete-navigation-play');
const downloadCompletedSelect = document.querySelector('#download-completed-select');
const downloadCompletedPlay = document.querySelector('#download-completed-play');
const downloadErrorSelect = document.querySelector('#download-error-select');
const downloadErrorPlay = document.querySelector('#download-error-play');
const downloadNewSelect = document.querySelector('#download-new-select');
const downloadNewPlay = document.querySelector('#download-new-play');
const restoreSounds = document.querySelector('#restore-sounds');
const saveSounds = document.querySelector('#save-sounds');

// constants and variables section

let buffers = new Object();
let arrayBuffers = new Object;
const ctx = new AudioContext();
let gettingItem = browser.storage.local.get();
let unSaveChanges = false;

// functions section

const unSaveExit = function(event) {
	if(unSaveChanges) {
		event.preventDefault();
		event.returnValue = '';
	}
};

const bufferToBase64 = function(buffer) {
	let bytes = new Uint8Array(buffer);
	let len = buffer.byteLength;
	let binary = '';
	for(let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
};

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
		buffer = base64ToBuffer(bufferToBase64(arrayBuffer));
	}

	ctx.decodeAudioData(buffer).then(function(decodedData) {
		buffers[key] = decodedData;
	});
};

const playSound = function(key) {
	let source = ctx.createBufferSource();
	source.buffer = buffers[key];
	source.connect(ctx.destination);
	source.start(0);
};

const loadFile = function(curFile, key) {
	let reader = new FileReader();
	reader.addEventListener('load', function(e) {
		arrayBuffers[key] = bufferToBase64(e.target.result);
		loadToBuffer(arrayBuffers[key], key);
	});

	if(curFile.size > 512000) {
		i18nMessage('optionsNotificationFileBig');
	} else if(curFile.type == 'audio/mpeg' || curFile.type == 'audio/ogg' || curFile.type == 'video/ogg' || curFile.type == 'audio/wav') {
		reader.readAsArrayBuffer(curFile);
		unSaveChanges = true;
	} else {
		i18nMessage('optionsNotificationFileNotSupported');
	}
};

const showMessage = function(message, timeout=10000) {
	resultBox.textContent = message;
	setTimeout(function() {
		resultBox.textContent = '';
	}, timeout);
};

const i18nMessage = function(messageId, timeout=10000) {
	resultBox.textContent = browser.i18n.getMessage(messageId);
	setTimeout(function() {
		resultBox.textContent = '';
	}, timeout);
};

const getStorage = function(data) {
	let item = data.preferences;
	startNavBox.checked = item.startNavigation;
	completeNavBox.checked = item.completeNavigation;
	downloadCompletedBox.checked = item.downloadCompleted;
	deCheckBox.checked = item.downloadError;
	dnCheckBox.checked = item.downloadNew;
	if(Object.keys(data.customSounds).length > 0) {
		arrayBuffers = data.customSounds;
		for(let key in arrayBuffers) {
			loadToBuffer(arrayBuffers[key], key);
		}
	}
};

const storageError = function(error) {
	console.log(`Error: ${error}`);
};

const saveOk = function() {
	i18nMessage('optionsNotificationSaveSuccess');
	unSaveChanges = false;
};

const saveError = function() {
	i18nMessage('optionsNotificationSaveError');
};

// add events listener section

saveBtn.addEventListener('click', function() {
	let write = new Object();
	write.preferences = {};
	write.preferences.startNavigation = startNavBox.checked;
	write.preferences.completeNavigation = completeNavBox.checked;
	write.preferences.downloadCompleted = downloadCompletedBox.checked;
	write.preferences.downloadError = deCheckBox.checked;
	write.preferences.downloadNew = dnCheckBox.checked;
	write.customSounds = {};
	write.customSounds = arrayBuffers;
	browser.storage.local.set(write).then(saveOk, saveError);
});

startNavigationSelect.addEventListener('change', function() {
	let curFile = this.files[0];
	loadFile(curFile, 'startNavigation');
});

startNavigationPlay.addEventListener('click', function() {
	if(arrayBuffers.startNavigation) {
		playSound('startNavigation');
	} else {
		i18nMessage('optionsNotificationSelectSound');
	}
});

completeNavigationSelect.addEventListener('change', function() {
	let curFile = this.files[0];
	loadFile(curFile, 'completeNavigation');
});

completeNavigationPlay.addEventListener('click', function() {
	if(arrayBuffers.completeNavigation) {
		playSound('completeNavigation');
	} else {
		i18nMessage('optionsNotificationSelectSound');
	}
});

downloadCompletedSelect.addEventListener('change', function() {
	let curFile = this.files[0];
	loadFile(curFile, 'downloadCompleted');
});

downloadCompletedPlay.addEventListener('click', function() {
	if(arrayBuffers.downloadCompleted) {
		playSound('downloadCompleted');
	} else {
		i18nMessage('optionsNotificationSelectSound');
	}
});

downloadErrorSelect.addEventListener('change', function() {
	let curFile = this.files[0];
	loadFile(curFile, 'downloadError');
});

downloadErrorPlay.addEventListener('click', function() {
	if(arrayBuffers.downloadError) {
		playSound('downloadError');
	} else {
		i18nMessage('optionsNotificationSelectSound');
	}
});

downloadNewSelect.addEventListener('change', function() {
	let curFile = this.files[0];
	loadFile(curFile, 'downloadNew');
});

downloadNewPlay.addEventListener('click', function() {
	if(arrayBuffers.downloadNew) {
		playSound('downloadNew');
	} else {
		i18nMessage('optionsNotificationSelectSound');
	}
});

restoreSounds.addEventListener('click', function() {
	arrayBuffers = {};
	i18nMessage('optionsNotificationResetSounds');
	unSaveChanges = true;
});

startNavBox.addEventListener('click', function() {
	unSaveChanges = true;
});

completeNavBox.addEventListener('click', function() {
	unSaveChanges = true;
});

downloadCompletedBox.addEventListener('click', function() {
	unSaveChanges = true;
});

deCheckBox.addEventListener('click', function() {
	unSaveChanges = true;
});

dnCheckBox.addEventListener('click', function() {
	unSaveChanges = true;
});

window.addEventListener('beforeunload', unSaveExit);

// main code section

gettingItem.then(getStorage, storageError);

