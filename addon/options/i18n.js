
const setElementText = function(messageId, elementId) {
let message = browser.i18n.getMessage(messageId);
let element = document.querySelector('#' + elementId);
element.textContent = message;
};

setElementText('optionsPageTitle', 'page-title');
setElementText('aboutHomeLink', 'about-home-link');
setElementText('aboutRepositoryLink', 'about-repository-link');
setElementText('aboutDonateLink', 'about-donate-link');
setElementText('aboutSupportLink', 'about-support-link');
setElementText('tabsGeneralSettings', 'general-settings');
setElementText('tabsCustomSounds', 'custom-sounds');
setElementText('containerGeneralSettingsHeader', 'general-settings-header');
setElementText('containerGeneralSettingsDescription', 'general-settings-description');
setElementText('containerGeneralSettingsStartNavigation', 'general-settings-start-navigation');
setElementText('containerGeneralSettingsCompleteNavigation', 'general-settings-complete-navigation');
setElementText('containerGeneralSettingsDownloadCompleted', 'general-settings-download-completed');
setElementText('containerGeneralSettingsDownloadError', 'general-settings-download-error');
setElementText('containerGeneralSettingsDownloadNew', 'general-settings-download-new');
setElementText('containerCustomSoundsHeader', 'custom-sounds-header');
setElementText('containerCustomSoundsStartNavigationText', 'custom-sounds-start-navigation-text');
setElementText('containerCustomSoundsPreviewButton', 'start-navigation-play');
setElementText('containerCustomSoundsCompleteNavigationText', 'custom-sounds-complete-navigation-text');
setElementText('containerCustomSoundsPreviewButton', 'complete-navigation-play');
setElementText('containerCustomSoundsDownloadCompletedText', 'custom-sounds-download-completed-text');
setElementText('containerCustomSoundsPreviewButton', 'download-completed-play');
setElementText('containerCustomSoundsDownloadErrorText', 'custom-sounds-download-error-text');
setElementText('containerCustomSoundsPreviewButton', 'download-error-play');
setElementText('containerCustomSoundsResetButton', 'restore-sounds');
setElementText('containerCustomSoundsDownloadNewText', 'custom-sounds-download-new-text');
setElementText('containerCustomSoundsPreviewButton', 'download-new-play');
setElementText('optionsSaveButton', 'save');
setElementText('containerGeneralSettingsNavigationHeader', 'general-settings-navigation-header');
setElementText('containerGeneralSettingsDownloadHeader', 'general-settings-download-header');
