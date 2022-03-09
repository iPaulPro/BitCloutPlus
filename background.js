/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const PUBLIC_KEY_PREFIX = 'BC1YL'
const PUBLIC_KEY_LENGTH = 55

const DELAY_MS_MEMPOOL_CALL = 5 * 60 * 1000 // 5 min
const KEY_LATEST_MEMPOOL_CALL = 'latest-mempool-call'
const KEY_LATEST_MEMPOOL_USERS = 'latest-mempool-users'

const MSG_GET_MEMPOOL_TRANSACTORS = 'get-mempool-transactors'

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

const getMempoolTransactions = () => {
  const request = {
    'headers': {
      'content-type': 'application/json',
    },
    'method': 'POST',
    'body': JSON.stringify({
      IsMempool: true
    })
  }

  return fetch(`https://node.deso.org/api/v1/transaction-info`, request)
    .then(res => res.json())
    .then(res => res['Transactions'])
}

const extractTransactors = (transactions) => {
  const transactors = new Set()
  transactions.forEach(transaction => {
    const transactor = transaction['TransactionMetadata']['TransactorPublicKeyBase58Check']
    transactors.add(transactor)
  })
  return [...transactors]
}

const getMempoolTransactors = async () => {
  const savedItems = await chrome.storage.local.get([KEY_LATEST_MEMPOOL_CALL, KEY_LATEST_MEMPOOL_USERS])

  // check if saved active list is fresh
  const latestCall = savedItems[KEY_LATEST_MEMPOOL_CALL] ?? 0
  if (Date.now() - latestCall < DELAY_MS_MEMPOOL_CALL) {
    const savedUsers = savedItems[KEY_LATEST_MEMPOOL_USERS]
    return JSON.parse(savedUsers)
  }

  const transactions = await getMempoolTransactions()
  const transactors = extractTransactors(transactions)

  const items = {}
  items[KEY_LATEST_MEMPOOL_CALL] = Date.now()
  items[KEY_LATEST_MEMPOOL_USERS] = JSON.stringify(transactors)
  await chrome.storage.local.set(items)

  return transactors
}

chrome.runtime.onMessage.addListener( (message, sender, sendResponse) => {
  switch (message.type) {
    case MSG_GET_MEMPOOL_TRANSACTORS:
      getMempoolTransactors()
        .then(mempoolTransactors => sendResponse({mempoolTransactors}))
        .catch(() => sendResponse({mempoolTransactors: []}))
  }

  return true
})
