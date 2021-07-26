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

const getFollowing = function (username) {
  if (!username) return Promise.reject('Missing required parameter username')

  const request = buildRequest('include')
  request.body = JSON.stringify({
    Username: username,
    getEntriesFollowingPublicKey: false,
    NumToFetch: 10000
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
