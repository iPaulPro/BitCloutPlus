chrome.omnibox.onInputEntered.addListener(function(text) {
  // Encode user input for special characters , / ? : @ & = + $ #
  const newURL = 'https://bitclout.com/u/' + encodeURIComponent(text);
  chrome.tabs.create({ url: newURL });
});