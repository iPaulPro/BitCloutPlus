/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const deSoInNanos = 1000000000

let timer, currentUrl
let identityWindow
let pendingSignTransactionId, pendingTransactionHex

let longPostEnabled = true
let observingHolders = false

const dollarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const addEditProfileButton = function () {
  let editProfileButtonId = 'plus-sidebar-edit-profile'
  if (document.getElementById(editProfileButtonId)) return

  const leftBarButtons = document.querySelectorAll('left-bar-button')
  try {
    leftBarButtons.forEach(button => {
      const profileDiv = button.firstElementChild.lastElementChild
      const profileAnchor = profileDiv.firstElementChild

      if (profileAnchor.innerText.includes('Profile')) {
        const a = document.createElement('a')
        a.id = editProfileButtonId
        a.href = 'update-profile'
        a.className = 'fc-muted fs-12px ml-2 pl-1 pr-1'
        a.innerText = 'Edit'

        profileDiv.appendChild(a)
      }
    })
  } catch (e) {}
}

const enrichWallet = function (page) {
  try {
    const holdingsDiv = page.querySelectorAll('.holdings__divider').item(1)
    const holdingsValueDiv = holdingsDiv.lastElementChild.children.item(2)
    const holdingsCloutValue = parseFloat(holdingsValueDiv.innerText.replace(/[^0-9.]+/g, ''))

    const container = page.querySelector('.container')
    const balanceValuesDiv = container.firstElementChild.lastElementChild
    const balanceCloutValue = parseFloat(balanceValuesDiv.firstElementChild.innerText.replace(/[^0-9.]+/g, ''))

    const cloutLabelSpan = document.createElement('span')
    cloutLabelSpan.className = 'plus-text-muted fs-12px font-weight-normal ml-2'
    cloutLabelSpan.innerText = '$DESO'

    const cloutSpan = document.createElement('span')
    cloutSpan.className = 'plus-text-muted fs-14px font-weight-normal'
    cloutSpan.innerText = `${(holdingsCloutValue + balanceCloutValue).toFixed(4)}`
    cloutSpan.appendChild(cloutLabelSpan)

    const totalDiv = document.createElement('div')
    totalDiv.className = 'ml-auto mr-15px'
    totalDiv.style.lineHeight = '1.2'
    totalDiv.appendChild(cloutSpan)

    const topBar = document.getElementsByClassName('global__top-bar').item(0).children.item(1).children.item(1)
    topBar.appendChild(totalDiv)
  } catch (e) {}
}

const formatPriceUsd = function (price) {
  return `${dollarFormatter.format(price)} USD`
}

const enrichBalanceBox = function (profile) {
  if (!profile) return

  try {
    const nativePrice = (profile['CoinPriceDeSoNanos'] / deSoInNanos).toFixed(2)
    const spotPrice = getSpotPrice()
    const coinPriceUsd = nativePrice * spotPrice

    const creatorCoinBalanceId = 'plus-creator-coin-balance'
    const creatorCoinPriceId = 'plus-creator-coin-price'
    const creatorCoinPriceUsdId = 'plus-creator-coin-price-usd'
    const existingElement = document.getElementById(creatorCoinBalanceId)
    if (existingElement) {
      document.getElementById(creatorCoinPriceId).innerText = ` ${nativePrice} $DESO `
      document.getElementById(creatorCoinPriceUsdId).innerText = formatPriceUsd(coinPriceUsd)
      return
    }

    const creatorCoinBalanceContainer = document.createElement('div')
    creatorCoinBalanceContainer.id = creatorCoinBalanceId
    creatorCoinBalanceContainer.className = 'd-flex justify-content-between pt-10px'

    const coinNameDiv = document.createElement('div')
    coinNameDiv.className = 'd-flex'
    coinNameDiv.style.textOverflow = 'ellipsis'
    coinNameDiv.style.maxWidth = '150px'
    coinNameDiv.style.overflow = 'hidden'
    coinNameDiv.style.whiteSpace = 'noWrap'
    coinNameDiv.innerText = `Your Coin`

    const coinPriceDiv = document.createElement('div')
    coinPriceDiv.className = 'd-flex flex-column align-items-end justify-content-end flex-wrap'

    const coinPriceValueDiv = document.createElement('div')
    coinPriceValueDiv.id = creatorCoinPriceId
    coinPriceValueDiv.innerText = ` ${nativePrice} $DESO `

    const coinPriceConversionDiv = document.createElement('div')
    coinPriceConversionDiv.className = 'd-flex plus-text-muted'

    const coinPriceApproximateDiv = document.createElement('div')
    coinPriceApproximateDiv.className = 'ml-10px mr-10px'
    coinPriceApproximateDiv.innerText = ' ≈ '

    const coinPriceUsdDiv = document.createElement('div')
    coinPriceUsdDiv.id = creatorCoinPriceUsdId
    coinPriceUsdDiv.innerText = formatPriceUsd(coinPriceUsd)

    coinPriceConversionDiv.appendChild(coinPriceApproximateDiv)
    coinPriceConversionDiv.appendChild(coinPriceUsdDiv)
    coinPriceDiv.appendChild(coinPriceValueDiv)
    coinPriceDiv.appendChild(coinPriceConversionDiv)
    creatorCoinBalanceContainer.appendChild(coinNameDiv)
    creatorCoinBalanceContainer.appendChild(coinPriceDiv)

    const balanceBox = document.getElementsByClassName('right-bar-creators__balance-box').item(0)
    balanceBox.appendChild(creatorCoinBalanceContainer)
  } catch (e) { }
}

const checkForNftTransfers = () => {
  const publicKey = getLoggedInPublicKey()
  if (!publicKey) return

  getPendingNftTransfers(publicKey).then(pendingNfts => {
    if (pendingNfts.length === 0) return

    const menuItem = document.getElementById('plus-nft-transfers-left-bar-button')
    if (!menuItem) return

    const id = 'plus-nft-transfer-count'
    let countElement
    const existingCountElement = document.getElementById(id)
    if (existingCountElement) {
      countElement = existingCountElement
    } else {
      countElement = document.createElement('div')
      countElement.id = id
      countElement.className = 'ml-5px p-5x fs-15px notification'
      const div = menuItem.firstElementChild.lastElementChild
      div.appendChild(countElement)
    }
    countElement.innerText = String(pendingNfts.length)
  })
}

const addGlobalEnrichments = function () {
  addEditProfileButton()
  addNewPostButton()
  addNftTransfersMenuItem()
}

const removeUnfollowLinksInPosts = () => {
  const followButtons = document.querySelectorAll('feed-post follow-button')
  Array.from(followButtons).forEach(node => {
    if (node.innerText === 'Unfollow') node.remove()
  })
}

// Callback function to execute when body mutations are observed
const appRootObserverCallback = function () {
  if (currentUrl !== window.location.href) {
    observingHolders = false
    currentUrl = window.location.href
  }

  addGlobalEnrichments()
  removeUnfollowLinksInPosts()

  const profilePage = document.querySelector('creator-profile-page')
  if (profilePage) {
    enrichProfile()
    return
  }

  const nftPostPage = document.querySelector('nft-post-page')
  if (nftPostPage) {
    enrichNftPostPage(nftPostPage)
  }
}

const updateUserCreatorCoinPrice = function () {
  const key = getLoggedInPublicKey()
  getProfileByPublicKey(key).then(profile => {
    enrichBalanceBox(profile)
  }).catch(() => {})
}

const addFollowsYouBadgeToFollowingItems = (nodes, followerUsernames) => {
  nodes.forEach(node => {
    const buyLink = node.querySelector('.feed-post__coin-price-holder')
    if (!buyLink) return

    const username = buyLink.parentElement.firstElementChild.innerText.trim()
    if (followerUsernames.indexOf(username) < 0) return

    const followsYouSpan = createFollowsYouBadge()
    buyLink.parentElement.insertBefore(followsYouSpan, buyLink.parentElement.lastElementChild)
  })
}

const observeFollowingList = (page) => {
  const loggedInPublicKey = getLoggedInPublicKey()
  if (!loggedInPublicKey) return

  const getFilteredSidNodes = (nodes) => Array.from(nodes).filter(node => node.dataset && node.dataset.sid)

  getFollowersByPublicKey(loggedInPublicKey).then(res => res['PublicKeyToProfileEntry']).then(followersMap => {
    const listDiv = page.querySelector('[ui-scroll]')
    if (!listDiv) return

    const followerValues = Object.values(followersMap)
    const followerUsernames = followerValues.map(follower => follower ? follower['Username'] : "")

    // Add to existing list items
    const nodes = getFilteredSidNodes(listDiv.childNodes)
    addFollowsYouBadgeToFollowingItems(nodes, followerUsernames)

    // Listen for new list items
    const observerConfig = { childList: true, subtree: false }
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        const nodes = getFilteredSidNodes(mutation.addedNodes)
        addFollowsYouBadgeToFollowingItems(nodes, followerUsernames)
      })
    })
    observer.observe(listDiv, observerConfig)
  })
}

const globalContainerObserverCallback = function () {
  updateUserCreatorCoinPrice()
  addPostUsernameAutocomplete()
  addPostTextAreaListener()
  restorePostDraft()
  replacePostBtn()

  const profilePage = document.querySelector('creator-profile-page')
  if (profilePage) {
    observeProfileInnerContent(profilePage)
    return
  }

  const wallet = document.querySelector('wallet')
  if (wallet) {
    enrichWallet(wallet)
    return
  }

  const following = document.querySelector('manage-follows')
  if (following) {
    observeFollowingList(following)
    return
  }

  if (isBurnNftUrl()) {
    createBurnNftPage()
    return
  }

  if (isNftTransfersUrl()) {
    createNftTransfersPage()
    return
  }

  if (isTransferNftUrl()) {
    createTransferNftPage()
    return
  }

  const newPost = document.querySelector('app-create-post-page')
  if (newPost) {
    enrichCreatePostPage(newPost)
  }
}

const bodyObserverCallback = function () {
  const modalContainer = document.querySelector('modal-container')
  if (modalContainer) {
    addPostUsernameAutocomplete()
    fixImageLightbox(modalContainer)
  }
}

const onTransactionSigned = (payload) => {
  if (!payload) return

  const transactionHex = payload['signedTransactionHex']
  if (!transactionHex) return

  pendingTransactionHex = null

  submitTransaction(transactionHex).then(res => {
    const response = res['PostEntryResponse']
    if (response && response['PostHashHex']) {
      window.location.href = `posts/${response['PostHashHex']}`
    } else {
      const metadata = res['Transaction']['TxnMeta']
      const nftPostHash = metadata['NFTPostHash']
      if (nftPostHash) {
        if (new URL(window.location).pathname.includes('nft-transfers')) {
          window.location.reload(false)
        } else {
          const postHashHex = Buffer.from(nftPostHash).toString('hex')
          window.location.href = `/nft/${postHashHex}`
        }
      } else {
        window.location.href = window`u/${getLoggedInUsername()}`
      }
    }
  }).catch(() => {})
}

const handleLogin = (payload) => {
  if (identityWindow) {
    identityWindow.close()
    identityWindow = null
  }

  if (payload['signedTransactionHex']) {
    onTransactionSigned(payload)
  }
}

const handleSignTransactionResponse = (payload) => {
  if (!payload) return

  if (payload['approvalRequired'] && pendingTransactionHex) {
    const identityServiceUrl = window.localStorage.getItem('lastIdentityServiceURLV2')
    identityWindow = window.open(
      `${identityServiceUrl}/approve?tx=${pendingTransactionHex}`, null,
      'toolbar=no, width=800, height=1000, top=0, left=0')
  } else if (payload['signedTransactionHex']) {
    onTransactionSigned(payload)
  }
}

const handleMessage = (message) => {
  const { data: { id: id, method: method, payload: payload } } = message
 if (method === 'login') {
    handleLogin(payload)
 } else if (id === pendingSignTransactionId && payload) {
   if (payload['encryptedMessage']) {
     const encryptedMessage = payload['encryptedMessage']
     if (encryptedMessage) onNftTransferUnlockableEncrypted(encryptedMessage)
   } else if (payload['decryptedHexes']) {
     const unlockableText = Object.values(payload['decryptedHexes'])[0]
     if (unlockableText) onNftTransferUnlockableDecrypted(unlockableText)
   } else {
     handleSignTransactionResponse(payload)
   }
 }
 pendingSignTransactionId = null
}

const init = function () {
  window.addEventListener('message', handleMessage)

  chrome.storage.local.get(['longPost'], items => {
    if (items.longPost === undefined) {
      chrome.storage.local.set({ longPost: true })
    } else {
      longPostEnabled = items.longPost
    }
  })

  // app-root is dynamically loaded, so we observe changes to the child list
  const appRoot = document.querySelector('app-root')
  if (appRoot) {
    const appRootObserverConfig = { childList: true, subtree: true }
    const appRootObserver = new MutationObserver(appRootObserverCallback)
    appRootObserver.observe(appRoot, appRootObserverConfig)
  }

  const globalContainer = document.getElementsByClassName('global__container')[0]
  if (globalContainer) {
    const globalObserverConfig = { childList: true, subtree: false }
    const globalObserver = new MutationObserver(globalContainerObserverCallback)
    globalObserver.observe(globalContainer, globalObserverConfig)
  }

  const body = document.getElementsByTagName('body')[0]
  if (body) {
    const bodyObserverConfig = { childList: true, subtree: false }
    const bodyObserver = new MutationObserver(bodyObserverCallback)
    bodyObserver.observe(body, bodyObserverConfig)
  }

  if (timer) clearInterval(timer)
  timer = setInterval(updateUserCreatorCoinPrice, 5 * 60 * 1000)
}

init()
