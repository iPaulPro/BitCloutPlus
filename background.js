/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const PUBLIC_KEY_PREFIX = 'BC1YL'
const PUBLIC_KEY_LENGTH = 55

const getUsernameForPublicKey = (publicKey) => {
  if (!publicKey) return Promise.reject('Missing required parameter publicKey')

  return fetch(`https://node.deso.org/api/v0/get-user-name-for-public-key/${publicKey}`)
    .then(res => res.json())
    .then(atob)
}

const isPublicKeyBase58Check = (query) => {
  return query.startsWith(PUBLIC_KEY_PREFIX) && query.length === PUBLIC_KEY_LENGTH
}

const openUserInTab = async (username) => {
  const newURL = 'https://node.deso.org/u/' + username
  await chrome.tabs.create({url: newURL})
}

chrome.omnibox.onInputEntered.addListener(async text => {
  // Encode user input for special characters , / ? : @ & = + $ #
  const query = encodeURIComponent(text)

  if (isPublicKeyBase58Check(query)) {
    let username

    try {
      username = await getUsernameForPublicKey(query)
    } catch (e) {
      console.error(`No username found for '${query}'`, e)
    }

    if (username) {
      await openUserInTab(username)
      return
    }
  }

  await openUserInTab(query)
})
