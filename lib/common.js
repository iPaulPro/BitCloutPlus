/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const getLoggedInPublicKey = function () {
  const key = window.localStorage.getItem('lastLoggedInUserV2')
  if (!key) return undefined

  return JSON.parse(key)
}

const getLoggedInUsername = function () {
  const elementList = document.getElementsByClassName('change-account-selector__acount-name')

  try {
    const changeAccountSelector = elementList.item(0)
    return changeAccountSelector.innerText.trim()
  } catch (e) {}

  return ''
}

const getPublicKeyFromPage = () => {
  const topCard = document.querySelector('creator-profile-top-card')
  if (!topCard) return

  return topCard.querySelector('.creator-profile__ellipsis-restriction').innerText.trim()
}

const getPostHashHexFromUrl = function () {
  const segments = new URL(window.location).pathname.split('/')
  if (segments[1] === 'post' || segments[1] === 'nft') return segments[2]
  return undefined
}

const getSpotPrice = function () {
  const balanceBox = document.getElementsByClassName('right-bar-creators__balance-box').item(0)

  try {
    const priceContainerDiv = balanceBox.firstElementChild
    const priceDiv = priceContainerDiv.children.item(1).firstElementChild
    return parseFloat(priceDiv.innerText.replace(/[^0-9.]+/g, ''))
  } catch (e) {}

  return 0
}

const postIdentityMessage = (id, method, payload) => {
  const identityFrame = document.getElementById('identity')
  if (!identityFrame) throw 'No identity frame found'

  identityFrame.contentWindow.postMessage({
    id: id,
    service: 'identity',
    method: method,
    payload: payload
  }, '*')
}

const sendSignTransactionMsg = (identity, transactionHex, id) => {
  const payload = {
    transactionHex: transactionHex
  }

  if (identity) {
    payload.accessLevel = identity.accessLevel
    payload.accessLevelHmac = identity.accessLevelHmac
    payload.encryptedSeedHex = identity.encryptedSeedHex
  }

  pendingSignTransactionId = id
  pendingTransactionHex = transactionHex

  postIdentityMessage(id, 'sign', payload)
}

const getIdentityUsers = () => {
  const users = window.localStorage.getItem('identityUsersV2')
  return users && JSON.parse(users)
}

const getCurrentIdentity = () => {
  const key = getLoggedInPublicKey()
  const identityUsers = getIdentityUsers()
  return key && identityUsers && identityUsers[key]
}
