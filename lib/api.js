/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const MIN_FEE_RATE_NANOS_PER_KB = 1000

let apiBaseUrl

const getBaseUrl = () => {
  if (!apiBaseUrl) {
    const node = window.localStorage.getItem('lastLocalNodeV2')
    if (!node) apiBaseUrl = `https://${window.location.hostname}/api/v0`
    apiBaseUrl = `https://${node.replace(/['"]+/g, '')}/api/v0`
  }
  return apiBaseUrl
}

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

  return fetch(`${getBaseUrl()}/get-single-profile`, request)
    .then(res => res.json())
    .then(res => res['Profile'])
}

const getProfileByPublicKey = function (publicKey) {
  if (!publicKey) return Promise.reject('Missing required parameter publicKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey
  })

  return fetch(`${getBaseUrl()}/get-single-profile`, request)
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

  return fetch(`${getBaseUrl()}/get-follows-stateless`, request)
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

  return fetch(`${getBaseUrl()}/get-follows-stateless`, request)
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

  return fetch(`${getBaseUrl()}/get-hodlers-for-public-key`, request)
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

  return fetch(`${getBaseUrl()}/get-hodlers-for-public-key`, request)
    .then(res => res.json())
    .then(res => res['Hodlers'])
}

const submitTransaction = (transactionHex) => {
  if (!transactionHex) return Promise.reject('Missing required parameter transactionHex')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    TransactionHex: transactionHex
  })

  return fetch(`${getBaseUrl()}/submit-transaction`, request)
    .then(res => res.json())
}

const submitPost = (pubKey, input, image, video, embedUrl) => {
  const bodyObj = {
    Body: input
  }

  if (image) bodyObj.ImageURLs = [image]

  if (video) bodyObj.VideoURLs = [video]

  const body = {
    UpdaterPublicKeyBase58Check: pubKey,
    BodyObj: bodyObj,
    CreatorBasisPoints: 0,
    StakeMultipleBasisPoints: 12500,
    IsHidden: false,
    MinFeeRateNanosPerKB: MIN_FEE_RATE_NANOS_PER_KB
  }

  if (embedUrl) {
    const formattedEmbedUrl = getEmbedURL(embedUrl)
    if (formattedEmbedUrl) {
      body.PostExtraData = {EmbedVideoURL: formattedEmbedUrl}
    } else {
      bodyObj.ImageURLs = [embedUrl]
    }
  }

  const request = buildRequest('omit')
  request.body = JSON.stringify(body)

  return fetch(`${getBaseUrl()}/submit-post`, request)
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

  return fetch(`${getBaseUrl()}/get-profiles`, request)
    .then(res => res.json())
    .then(res => { cb(res['ProfilesFound']) })
    .catch(() => {})
}

const getProfilePhotoUrlForPublicKey = (pubKey) => {
  return `${getBaseUrl()}/get-single-profile-picture/${pubKey}?fallback=https://${window.location.hostname}/assets/img/default_profile_pic.png`
}

const isHoldingPublicKey = (publicKey, isHoldingPublicKey) => {
  if (!publicKey || !isHoldingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsHodlingPublicKeyBase58Check: isHoldingPublicKey
  })

  return fetch(`${getBaseUrl()}/is-hodling-public-key`, request)
    .then(res => res.json())
}

const isFollowingPublicKey = (publicKey, isFollowingPublicKey) => {
  if (!publicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsFollowingPublicKeyBase58Check: isFollowingPublicKey
  })

  return fetch(`${getBaseUrl()}/is-following-public-key`, request)
    .then(res => res.json())
}

const getBidsForNftPost = (publicKey, postHashHex) => {
  if (!publicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: publicKey,
    PostHashHex: postHashHex
  })

  return fetch(`${getBaseUrl()}/get-nft-bids-for-nft-post`, request)
    .then(res => res.json())
}

const getNftEntriesForPostHashHex = (readerPublicKey, postHashHex) => {
  if (!readerPublicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: readerPublicKey,
    PostHashHex: postHashHex
  })

  return fetch(`${getBaseUrl()}/get-nft-entries-for-nft-post`, request)
    .then(res => res.json())
    .then(res => res['NFTEntryResponses'])
}

const getNftsForUser = (publicKey, isForSale) => {
  if (!publicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  const body = {
    ReaderPublicKeyBase58Check: getLoggedInPublicKey(),
    UserPublicKeyBase58Check: publicKey,
    IsForSale: isForSale
  }
  if (isForSale) body.IsForSale = isForSale
  request.body = JSON.stringify(body)

  return fetch(`${getBaseUrl()}/get-nfts-for-user`, request)
    .then(res => res.json())
    .then(res => res['NFTsMap'])
}

const burnNft = (publicKey, nftPostHashHex, serialNumber) => {
  if (!publicKey || !nftPostHashHex || !serialNumber) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    UpdaterPublicKeyBase58Check: publicKey,
    NFTPostHashHex: nftPostHashHex,
    SerialNumber: serialNumber,
    MinFeeRateNanosPerKB: MIN_FEE_RATE_NANOS_PER_KB
  })

  return fetch(`${getBaseUrl()}/burn-nft`, request)
    .then(res => res.json())
}

const transferNft = (senderPublicKey, receiverPublicKey, nftPostHashHex, serialNumber, encryptedUnlockableText) => {
  if (!senderPublicKey || !nftPostHashHex || !serialNumber) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    SenderPublicKeyBase58Check: senderPublicKey,
    ReceiverPublicKeyBase58Check: receiverPublicKey,
    NFTPostHashHex: nftPostHashHex,
    SerialNumber: serialNumber,
    EncryptedUnlockableText: encryptedUnlockableText,
    MinFeeRateNanosPerKB: MIN_FEE_RATE_NANOS_PER_KB
  })

  return fetch(`${getBaseUrl()}/transfer-nft`, request)
    .then(res => res.json())
}

const acceptTransferNft = (publicKey, nftPostHashHex, serialNumber) => {
  if (!publicKey || !nftPostHashHex || !serialNumber) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    UpdaterPublicKeyBase58Check: publicKey,
    NFTPostHashHex: nftPostHashHex,
    SerialNumber: serialNumber,
    MinFeeRateNanosPerKB: MIN_FEE_RATE_NANOS_PER_KB
  })

  return fetch(`${getBaseUrl()}/accept-nft-transfer`, request)
    .then(res => res.json())
}
