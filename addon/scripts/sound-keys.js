export const SOUND_KEYS = [
	'startNavigation',
	'completeNavigation',
	'downloadCompleted',
	'downloadError',
	'downloadNew'
];

export const isSoundKey = function(key) {
	return SOUND_KEYS.includes(key);
};
