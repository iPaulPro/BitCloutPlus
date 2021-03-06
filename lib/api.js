/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const MIN_FEE_RATE_NANOS_PER_KB = 1000

let searchAbortController

let apiBaseUrl

const getBaseUrl = () => {
  if (!apiBaseUrl) {
    const node = window.localStorage.getItem('lastLocalNodeV2')
    if (!node) apiBaseUrl = `https://${window.location.hostname}`
    apiBaseUrl = `https://${node.replace(/['"]+/g, '')}`
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

const getUserMetadata = (publicKey) => {
  if (!publicKey) return Promise.reject('Missing required parameter publicKey')

  // get-user-metadata is not exposed on bitclout.com/api
  return fetch(`https://node.deso.org/api/v0/get-user-metadata/${publicKey}`)
    .then(res => res.json())
}

const getUsers = function (publicKeys) {
  if (!publicKeys) return Promise.reject('Missing required parameter publicKeys')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeysBase58Check: publicKeys,
    SkipForLeaderboard: true
  })

  return fetch(`${getBaseUrl()}/api/v0/get-users-stateless`, request)
    .then(res => res.json())
    .then(res => res['UserList'])
}

const getProfileByUsername = function (username) {
  if (!username) return Promise.reject('Missing required parameter username')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    Username: username
  })

  return fetch(`${getBaseUrl()}/api/v0/get-single-profile`, request)
    .then(res => res.json())
    .then(res => res['Profile'])
}

const getProfileByPublicKey = function (publicKey) {
  if (!publicKey) return Promise.reject('Missing required parameter publicKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey
  })

  return fetch(`${getBaseUrl()}/api/v0/get-single-profile`, request)
    .then(res => res.json())
    .then(res => res['Profile'])
}

const getFollowersByPublicKey = function (pubKey) {
  if (!pubKey) return Promise.reject('Missing required parameter pubKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: pubKey,
    GetEntriesFollowingUsername: true,
    NumToFetch: 20000
  })

  return fetch(`${getBaseUrl()}/api/v0/get-follows-stateless`, request)
    .then(res => res.json())
}

const getFollowingByPublicKey = function (pubKey) {
  if (!pubKey) return Promise.reject('Missing required parameter pubKey')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    PublicKeyBase58Check: pubKey,
    GetEntriesFollowingUsername: false,
    NumToFetch: 20000
  })

  return fetch(`${getBaseUrl()}/api/v0/get-follows-stateless`, request)
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

  return fetch(`${getBaseUrl()}/api/v0/get-hodlers-for-public-key`, request)
    .then(res => res.json())
    .then(res => res['Hodlers'])
}

const submitTransaction = (transactionHex) => {
  if (!transactionHex) return Promise.reject('Missing required parameter transactionHex')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    TransactionHex: transactionHex
  })

  return fetch(`${getBaseUrl()}/api/v0/submit-transaction`, request)
    .then(res => res.json())
}

const submitPost = (
  pubKey,
  bodyText,
  images,
  videos,
  embedUrl,
  extraData,
  postHashHexToModify,
  repostedPostHashHex,
  parentStakeId
) => {
  const bodyObj = {
    Body: bodyText
  }

  if (images) bodyObj.ImageURLs = images

  if (videos) bodyObj.VideoURLs = videos

  const body = {
    UpdaterPublicKeyBase58Check: pubKey,
    BodyObj: bodyObj,
    CreatorBasisPoints: 0,
    StakeMultipleBasisPoints: 12500,
    IsHidden: false,
    MinFeeRateNanosPerKB: MIN_FEE_RATE_NANOS_PER_KB,
    PostExtraData: extraData
  }

  if (postHashHexToModify) {
    body['PostHashHexToModify'] = postHashHexToModify
  }

  if (repostedPostHashHex) {
    body['RepostedPostHashHex'] = repostedPostHashHex
  }

  if (parentStakeId) {
    body['ParentStakeID'] = parentStakeId
  }

  if (embedUrl) {
    const formattedEmbedUrl = getEmbedURL(embedUrl)
    if (formattedEmbedUrl) {
      if (!body.PostExtraData) body.PostExtraData = {}
      body.PostExtraData.EmbedVideoURL = formattedEmbedUrl
    } else {
      bodyObj.ImageURLs = [embedUrl]
    }
  }

  if (!extraData['Node']) {
    switch (window.location.hostname) {
      case 'node.deso.org':
        extraData['Node'] = '1'
        break;
      case 'bitclout.com':
        extraData['Node'] = '2'
        break;
      default:
        extraData['Node'] = '0'
        break;
    }
  }

  const request = buildRequest('omit')
  request.body = JSON.stringify(body)

  return fetch(`${getBaseUrl()}/api/v0/submit-post`, request)
    .then(res => res.json())
    .then(res => {
      if (res['TransactionHex']) {
        return res['TransactionHex']
      }
      throw new Error(res['error'])
    })
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

  return fetch(`${getBaseUrl()}/api/v0/get-profiles`, request)
    .then(res => res.json())
    .then(res => { cb(res['ProfilesFound']) })
    .catch(() => {})
}

const getProfilePhotoUrlForPublicKey = (pubKey) => {
  return `${getBaseUrl()}/api/v0/get-single-profile-picture/${pubKey}?fallback=https://${window.location.hostname}/assets/img/default_profile_pic.png`
}

const isHoldingPublicKey = (publicKey, isHoldingPublicKey) => {
  if (!publicKey || !isHoldingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsHodlingPublicKeyBase58Check: isHoldingPublicKey
  })

  return fetch(`${getBaseUrl()}/api/v0/is-hodling-public-key`, request)
    .then(res => res.json())
}

const isFollowingPublicKey = (publicKey, isFollowingPublicKey) => {
  if (!publicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    IsFollowingPublicKeyBase58Check: isFollowingPublicKey
  })

  return fetch(`${getBaseUrl()}/api/v0/is-following-public-key`, request)
    .then(res => res.json())
}

const getSinglePost = (postHashHex, fetchParents = false, commentLimit = 0) => {
  if (!postHashHex) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PostHashHex: postHashHex,
    ReaderPublicKeyBase58Check: getLoggedInPublicKey(),
    FetchParents: fetchParents,
    CommentLimit: commentLimit
  })

  return fetch(`${getBaseUrl()}/api/v0/get-single-post`, request)
    .then(res => res.json())
}

const getBidsForNftPost = (publicKey, postHashHex) => {
  if (!publicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: publicKey,
    PostHashHex: postHashHex
  })

  return fetch(`${getBaseUrl()}/api/v0/get-nft-bids-for-nft-post`, request)
    .then(res => res.json())
}

const getNftEntriesForPostHashHex = (readerPublicKey, postHashHex) => {
  if (!readerPublicKey || !isFollowingPublicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ReaderPublicKeyBase58Check: readerPublicKey,
    PostHashHex: postHashHex
  })

  return fetch(`${getBaseUrl()}/api/v0/get-nft-entries-for-nft-post`, request)
    .then(res => res.json())
    .then(res => res['NFTEntryResponses'])
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

  return fetch(`${getBaseUrl()}/api/v0/transfer-nft`, request)
    .then(res => res.json())
}

const getTransactionInfo = (publicKey, lastPublicKeyTransactionIndex = -1, limit = 1) => {
  if (!publicKey) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey,
    Limit: limit,
    LastPublicKeyTransactionIndex: lastPublicKeyTransactionIndex
  })

  return fetch(`${getBaseUrl()}/api/v1/transaction-info`, request)
    .then(res => res.json())
    .then(res => res['Transactions'])
}

const getAppState = () => {
  const request = buildRequest('omit')
  request.body = '{}'

  return fetch(`${getBaseUrl()}/api/v0/get-app-state`, request).then(res => res.json())
}

const getBlockByHash = (blockHashHex) => {
  if (!blockHashHex) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    HashHex: blockHashHex
  })

  return fetch(`${getBaseUrl()}/api/v1/block`, request)
    .then(res => res.json())
}

const getBlockByHeight = (blockHeight) => {
  if (!blockHeight) return Promise.reject('Missing required parameter')

  const request = buildRequest('omit')
  request.body = JSON.stringify({
    FullBlock: true,
    Height: blockHeight
  })

  return fetch(`${getBaseUrl()}/api/v1/block`, request)
    .then(res => res.json())
}

const getUnreadNotificationsCount = (publicKey) => {
  const request = buildRequest('omit')
  request.body = JSON.stringify({
    PublicKeyBase58Check: publicKey
  })

  return fetch(`${getBaseUrl()}/api/v0/get-unread-notifications-count`, request)
    .then(res => res.json())
}

const setNotificationMetadata = (metadata) => {
  const request = buildRequest('omit')
  request.body = JSON.stringify(metadata)

  return fetch(`${getBaseUrl()}/api/v0/set-notification-metadata`, request)
}

const blockPublicKey = (pendingBlockUser, jwt) => {
  const request = buildRequest('omit')
  request.body = JSON.stringify({
    ...pendingBlockUser,
    JWT: jwt
  })
  return fetch(`${getBaseUrl()}/api/v0/block-public-key`, request)
    .then(res => res.json())
}