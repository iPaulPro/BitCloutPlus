/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const apiBaseUrl = `https://${window.location.hostname}/api/v0`

const buildRequest = (credentials) => {
  return {
    'headers': {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
    },
    'referrerPolicy': 'no-referrer',
    'method': 'POST',
    'mode': 'cors',
    'credentials': credentials
  }
}

const getProfileByUsername = function (username) {
  if (!username) return Promise.reject('Missing required parameter username')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    Username: username
  })

  return fetch(`${apiBaseUrl}/get-single-profile`, request)
    .then(res => res.json())
    .then(res => res['Profile'])
}

const getProfileByPublicKey = function (publicKey) {
  if (!publicKey) return Promise.reject('Missing required parameter publicKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey
  })

  return fetch(`${apiBaseUrl}/get-single-profile`, request)
    .then(res => res.json())
    .then(res => res['Profile'])
}

const getFollowingByUsername = function (username) {
  if (!username) return Promise.reject('Missing required parameter username')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    Username: username,
    GetEntriesFollowingUsername: false,
    NumToFetch: 10000
  })

  return fetch(`${apiBaseUrl}/get-follows-stateless`, request)
    .then(res => res.json())
}

const getFollowersByPublicKey = function (pubKey) {
  if (!pubKey) return Promise.reject('Missing required parameter pubKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: pubKey,
    GetEntriesFollowingUsername: true,
    NumToFetch: 20000
  })

  return fetch(`${apiBaseUrl}/get-follows-stateless`, request)
    .then(res => res.json())
}

const getHodlersByUsername = function (username) {
  if (!username) return Promise.reject('Missing required parameter username')

  const readerPubKey = getLoggedInPublicKey()
  if (!readerPubKey) return Promise.reject('No logged in user found')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: readerPubKey,
    username: username,
    NumToFetch: 10000
  })

  return fetch(`${apiBaseUrl}/get-hodlers-for-public-key`, request)
    .then(res => res.json())
    .then(res => res['Hodlers'])
}

const getHodlersByPublicKey = function (pubKey) {
  if (!pubKey) return Promise.reject('Missing required parameter pubKey')

  const readerPubKey = getLoggedInPublicKey()
  if (!readerPubKey) return Promise.reject('No logged in user found')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: readerPubKey,
    PublicKeyBase58Check: pubKey,
    NumToFetch: 10000
  })

  return fetch(`${apiBaseUrl}/get-hodlers-for-public-key`, request)
    .then(res => res.json())
    .then(res => res['Hodlers'])
}

const submitTransaction = (transactionHex) => {
  if (!transactionHex) return Promise.reject('Missing required parameter transactionHex')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    TransactionHex: transactionHex
  })

  return fetch(`${apiBaseUrl}/submit-transaction`, request)
    .then(res => res.json())
}

const submitPost = (pubKey, input, image, embedUrl) => {
  const bodyObj = {
    Body: input
  }
  if (image) bodyObj.ImageURLs = [image]

  const body = {
    UpdaterPublicKeyBase58Check: pubKey,
    BodyObj: bodyObj,
    CreatorBasisPoints: 0,
    StakeMultipleBasisPoints: 12500,
    IsHidden: false,
    MinFeeRateNanosPerKB: 1000
  }

  if (embedUrl) {
    const formattedEmbedUrl = getEmbedURL(embedUrl)
    if (formattedEmbedUrl) {
      body.PostExtraData = {EmbedVideoURL: formattedEmbedUrl}
    }
  }

  const request = buildRequest('omit')
  request.body = JSON.stringify(body)

  return fetch(`${apiBaseUrl}/submit-post`, request)
    .then(res => res.json())
    .then(res => res['TransactionHex'])
}

const searchUsernames = function (query, cb) {
  if (searchAbortController) {
    searchAbortController.abort()
  }

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    UsernamePrefix: query,
    NumToFetch: 4
  })

  searchAbortController = new AbortController()
  const { signal } = searchAbortController
  request.signal = signal

  return fetch(`${apiBaseUrl}/get-profiles`, request)
    .then(res => res.json())
    .then(res => { cb(res['ProfilesFound']) })
    .catch(() => {})
}

const getProfilePhotoUrlForPublicKey = (pubKey) => {
  return `${apiBaseUrl}/get-single-profile-picture/${pubKey}?fallback=https://${window.location.hostname}/assets/img/default_profile_pic.png`
}

const isHoldingPublicKey = (publicKey, isHoldingPublicKey) => {
  if (!publicKey || !isHoldingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsHodlingPublicKeyBase58Check: isHoldingPublicKey
  })

  return fetch(`${apiBaseUrl}/is-hodling-public-key`, request)
    .then(res => res.json())
}

const isFollowingPublicKey = (publicKey, isFollowingPublicKey) => {
  if (!publicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsFollowingPublicKeyBase58Check: isFollowingPublicKey
  })

  return fetch(`${apiBaseUrl}/is-following-public-key`, request)
    .then(res => res.json())
}
