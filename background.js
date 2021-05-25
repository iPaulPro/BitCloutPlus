/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

chrome.omnibox.onInputEntered.addListener(function(text) {
  // Encode user input for special characters , / ? : @ & = + $ #
  const newURL = 'https://bitclout.com/u/' + encodeURIComponent(text);
  chrome.tabs.create({ url: newURL });
});
