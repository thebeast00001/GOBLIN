console.log('GOBLIN Background script running');

chrome.runtime.onInstalled.addListener(() => {
  console.log('GOBLIN Extension Installed');
});
