// Copyright Paul Burke 2021. All Rights Reserved.
// Github: @ipaulpro/bitcloutplus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

const nanosInBitClout = 1000000000
const apiBaseUrl = 'https://bitclout.com/api/v0'

let longPostEnabled = true
const maxPostLength = 1000

let username, timer, loggedInProfile, currentUrl

let identityFrame, identityWindow, identityUsers
let pendingSignTransactionId, pendingTransactionHex

let observingHolders = false

const followingCountId = 'plus-profile-following-count'

const dollarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const getSpotPrice = function () {
  const elementList = document.getElementsByClassName('right-bar-creators__balance-box')

  try {
    const priceContainerDiv = elementList.item(0).firstElementChild
    const priceDiv = priceContainerDiv.children.item(1)
    return parseFloat(priceDiv.innerHTML.replace(/[^0-9.]+/g, ''))
  } catch (e) {}

  return 0
}

const getLoggedInUsername = function () {
  if (username && username !== '') return username

  const elementList = document.getElementsByClassName('change-account-selector__ellipsis-restriction')

  try {
    const changeAccountSelector = elementList.item(0)
    username = changeAccountSelector.innerHTML.trim()
    return username
  } catch (e) {}

  return ''
}

const getUsernameFromUrl = function () {
  const segments = new URL(document.location).pathname.split('/')
  return segments.pop() || segments.pop()
}

const getLoggedInProfile = function () {
  let promise
  if (loggedInProfile) {
    promise = Promise.resolve(loggedInProfile)
  } else {
    const loggedInUserName = getLoggedInUsername()
    promise = getProfile(loggedInUserName)
      .then(profile => {
        loggedInProfile = profile
        return Promise.resolve(profile)
      })
  }
  return promise
}

const getCurrentIdentity = () => getLoggedInProfile()
  .then(profile => profile.PublicKeyBase58Check)
  .then(key =>
    new Promise((resolve, reject) => {
      chrome.storage.local.get('users', result => {
        const users = result.users
        if (!users) {
          resolve(null)
          return
        }

        const loggedInUserIdentity = users[key]
        if (!loggedInUserIdentity) {
          resolve(null)
          return
        }

        resolve(loggedInUserIdentity)
      })
    })
  )

function loadCSS(filename) {
  const link = document.createElement("link")
  link.href = chrome.runtime.getURL(`css/${filename}.css`)
  link.id = filename
  link.type = "text/css"
  link.rel = "stylesheet"
  document.getElementsByTagName("head")[0].appendChild(link)
}

function unloadCSS(file) {
  const cssNode = document.getElementById(file)
  cssNode && cssNode.parentNode.removeChild(cssNode)
}

const reqHeaders = {
  'accept': 'application/json, text/plain, */*',
  'content-type': 'application/json',
}

const getProfile = function (username) {
  if (!username) return Promise.reject('Required parameter username is undefined')
  return fetch(`${apiBaseUrl}/get-single-profile`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      Username: username
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'include'
  }).then(res => res.json())
    .then(res => res.Profile)
}

const getFollowing = function (username) {
  return fetch(`${apiBaseUrl}/get-follows-stateless`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      Username: username,
      getEntriesFollowingPublicKey: false,
      NumToFetch: 10000
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'include'
  }).then(res => res.json())
}

const getHodlers = function (readerPubKey, username) {
  return fetch(`${apiBaseUrl}/get-hodlers-for-public-key`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      ReaderPublicKeyBase58Check: readerPubKey,
      username: username,
      NumToFetch: 10000
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'omit'
  }).then(res => res.json())
    .then(res => res.Hodlers)
}

const submitPost = (pubKey, input, image, video) => {
  const bodyObj = {
    Body: input
  }
  if (image) bodyObj.ImageURLs = [ image ]

  const body = {
    UpdaterPublicKeyBase58Check: pubKey,
    BodyObj: bodyObj,
    CreatorBasisPoints: 0,
    StakeMultipleBasisPoints: 12500,
    IsHidden: false,
    MinFeeRateNanosPerKB: 1000
  }

  if (video) body.PostExtraData = { EmbedVideoURL: video }

  return fetch(`${apiBaseUrl}/submit-post`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify(body),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'omit'
  }).then(res => res.json())
    .then(res => res.TransactionHex)
}

const submitTransaction = (transactionHex) =>
  fetch(`${apiBaseUrl}/submit-transaction`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      TransactionHex: transactionHex
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'omit'
  }).then(res => res.json())

let controller

const searchUsernames = function (query, cb) {
  if (controller) {
    controller.abort()
  }

  controller = new AbortController()
  const { signal } = controller

  return fetch(`${apiBaseUrl}/get-profiles`, {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      UsernamePrefix: query,
      NumToFetch: 4
    }),
    'method': 'POST',
    'signal': signal
  }).then(res => res.json())
    .then(res => { cb(res.ProfilesFound) })
    .catch(() => {})
}

const addNativeCoinPrice = function (userDataDiv, profile) {
  const nativePriceId = 'plus-profile-native-price'
  if (document.getElementById(nativePriceId)) return

  try {
    const userDataFooter = userDataDiv.lastElementChild

    const nativePrice = (profile.CoinPriceBitCloutNanos / nanosInBitClout).toFixed(2)

    const tooltipAttr = document.createAttribute('data-bs-toggle')
    tooltipAttr.value = 'tooltip'

    let img = document.createElement('img')
    img.style.width = '11px'
    img.style.opacity = '0.7'
    img.style.marginBottom = '2px'
    img.className = "mr-1"
    img.src = chrome.runtime.getURL('img/bitclout-logo.svg')

    let span = document.createElement('span')
    span.id = nativePriceId
    span.className = 'fc-muted mr-2 fs-14px'
    span.style.fontWeight = '500'
    span.innerHTML = `(${img.outerHTML}${nativePrice})`
    span.title = '$BitClout price'
    span.setAttributeNode(tooltipAttr)

    for (const child of userDataFooter.children) {
      if (child.tagName === 'DIV'
        && child.children.length > 0
        && child.firstElementChild.innerHTML.trim().startsWith('~$')
      ) {
        child.firstElementChild.appendChild(span)
      }
    }
  } catch (e) {}
}

const addFounderReward = function (userDataDiv, profile) {
  const founderRewardId = 'plus-profile-founder-reward'
  if (document.getElementById(founderRewardId)) return

  try {
    const userDataFooter = userDataDiv.lastElementChild

    const founderReward = (profile.CoinEntry.CreatorBasisPoints / 100).toFixed(0)
    const feeSpan = document.createElement('span')
    feeSpan.className = 'font-weight-bold'
    feeSpan.innerText = `${founderReward}`

    const labelSpan = document.createElement('span')
    labelSpan.className = 'fc-muted'
    labelSpan.innerHTML = 'Founder Reward&nbsp;&nbsp;'

    const div = document.createElement('div')
    div.id = founderRewardId
    div.innerHTML = `${feeSpan.outerHTML}% ${labelSpan.outerHTML}`

    userDataFooter.insertBefore(div, userDataFooter.lastElementChild)
  } catch (e) {}
}

const addSellButton = function () {
  const sellButtonId = 'plus-profile-sell-btn'
  if (document.getElementById(sellButtonId)) return

  let topCardContainerElements = document.getElementsByClassName('js-creator-profile-top-card-container')
  try {
    if (topCardContainerElements.length > 0) {
      const topCardContainer = topCardContainerElements.item(0)
      if (topCardContainer) {
        let sellButton = document.createElement('a')
        sellButton.id = sellButtonId
        sellButton.href = document.location.pathname + '/sell'
        sellButton.innerText = 'Sell'
        sellButton.className = 'btn btn-secondary font-weight-bold ml-10px fs-14px'
        sellButton.style.width = '75px'
        sellButton.style.height = '36px'
        topCardContainerElements.item(0).appendChild(sellButton)
      }
    }
  } catch (e) {}
}

const addHoldersCount = function (pageProfile) {
  let profileDetails = document.querySelector('creator-profile-details')
  if (!profileDetails) return

  const contentTop = profileDetails.firstElementChild
  if (!contentTop) return

  const tabContent = contentTop.lastElementChild
  if (!tabContent) return

  const creatorCoinTabHeader = tabContent.firstElementChild
  if (!creatorCoinTabHeader) return

  const holderDiv = creatorCoinTabHeader.firstElementChild
  if (!holderDiv || !holderDiv.innerHTML.includes('Holders of')) return

  const usersThatHodl = pageProfile.CoinEntry.NumberOfHolders
  const holderCountId = 'plus-profile-holder-count'

  let span
  const existingSpan = document.getElementById(holderCountId)
  if (existingSpan) {
    span = existingSpan
  } else {
    span = document.createElement('span')
    span.id = holderCountId
    span.className = 'fc-muted fs-16px'
    holderDiv.appendChild(span)
  }
  span.innerText = `(${usersThatHodl})`
}

function addHolderPositionRank (node, index, userHoldsOwnCoin) {
  if (userHoldsOwnCoin && index === 0) return

  const itemId = 'plus-profile-holder-position-' + index
  const holderPositionClassName = 'plus-profile-holder-position'

  let i
  if (userHoldsOwnCoin) {
    i = index
  } else {
    i = index + 1
  }

  try {
    let span
    const existingSpan = document.getElementById(itemId)
    if (existingSpan) {
      span = existingSpan
    } else {
      span = document.createElement('span')
      span.id = itemId
      span.className = `${holderPositionClassName} fc-muted fs-14px align-items-start d-flex pl-0 pr-2 mr-1`
      span.style.minWidth = '2em'

      const avatarAndName = node.firstChild.firstChild.firstChild
      avatarAndName.insertBefore(span, avatarAndName.firstElementChild)
    }

    span.innerText = `${i}`
  } catch (e) { }
}

function addHolderPercentage (node, index, circulation) {
  try {
    const itemId = 'plus-profile-holder-percentage-' + index
    const heldColumnItem = node.firstChild.firstChild.childNodes.item(1)
    const coinsHeld = parseFloat(heldColumnItem.innerHTML)

    const holderPercentageClassName = 'plus-profile-holder-share'
    let span
    const existingSpan = document.getElementById(itemId)
    if (existingSpan) {
      span = existingSpan
    } else {
      span = document.createElement('span')
      span.className = `${holderPercentageClassName} fc-muted fs-12px ml-1`
      heldColumnItem.appendChild(span)
    }
    span.innerHTML = '(' + ((coinsHeld / circulation) * 100).toFixed(1) + '%)'
  } catch (e) { }
}

function getCoinsInCirculation (topCard) {
  try {
    const valueBar = topCard.firstElementChild.lastElementChild
    const circulationContainer = valueBar.firstElementChild
    const circulationHtml = circulationContainer.firstElementChild.innerHTML.trim()
    return parseFloat(circulationHtml.slice(2, circulationHtml.length))
  } catch (e) {
    return 0
  }
}

function highlightUserInHolderList (node, loggedInUsername) {
  try {
    const nameSpan = node.querySelector('.text-truncate')
    const holderUsername = nameSpan.innerText
    if (loggedInUsername === holderUsername) {
      node.className = 'light-grey-divider'
    }
  } catch (e) { }
}

const addHolderEnrichments = function () {
  const topCard = document.querySelector('creator-profile-top-card')
  const creatorProfileHodlers = document.querySelector('creator-profile-hodlers')
  if (!creatorProfileHodlers || observingHolders || !topCard) return
  const holdersList = creatorProfileHodlers.firstElementChild

  // Before the list loads, it has an "empty" view
  if (holdersList.childElementCount === 1) return

  const pageUsername = getUsernameFromUrl()
  const loggedInUsername = getLoggedInUsername()
  const circulation = getCoinsInCirculation(topCard)

  const firstHodlerNode = holdersList.childNodes.item(1)
  const firstAvatarAndName = firstHodlerNode.firstChild.firstChild.firstChild
  const firstHolderName = firstAvatarAndName.textContent.trim().replaceAll('.', '')
  const holdsOwnCoin =  pageUsername.toLowerCase().startsWith(firstHolderName.toLowerCase())

  try {
    // Only the first few holders items are initially loaded...
    const childNodes = holdersList.childNodes
    for (let i = 1; i < childNodes.length; i++) {
      const node = childNodes.item(i)
      if (!node.dataset) continue

      const index = Number(node.dataset.sid)
      highlightUserInHolderList(node, loggedInUsername)
      addHolderPositionRank(node, index, holdsOwnCoin)
      addHolderPercentage(node, index, circulation)
    }
  } catch (e) { }

  // observe the rest
  const config = { childList: true, subtree: false }
  new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      Array.from(mutation.addedNodes, node => {
        const index = Number(node.dataset.sid)
        highlightUserInHolderList(node, loggedInUsername)
        addHolderPositionRank(node, index, holdsOwnCoin)
        addHolderPercentage(node, index, circulation)
      })
    })
  }).observe(holdersList, config)
  observingHolders = true
}

const addFollowsYouBadgeProfile = function (userDataDiv, loggedInProfile, followingList) {
  if (!userDataDiv || !loggedInProfile | !followingList || followingList.length === 0) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  const loggedInKey = loggedInProfile.PublicKeyBase58Check
  let followsYou = followingList[loggedInKey]
  if (followsYou) {
    const followsYouSpan = document.createElement('span')
    followsYouSpan.className = 'badge badge-pill badge-secondary ml-3 fs-12px text-grey5'
    followsYouSpan.innerText = 'Follows you'

    usernameDiv.appendChild(followsYouSpan)
  }
}

const addFollowingCountProfile = function (userDataDiv, followingCount) {
  if (!userDataDiv || !followingCount) return

  const userDataFooter = userDataDiv.lastElementChild
  if (!userDataFooter) return

  userDataFooter.className = userDataFooter.className + ' mb-1 mt-3'

  const countSpan = document.createElement('span')
  countSpan.className = 'font-weight-bold'
  countSpan.innerText = followingCount.toString()

  const labelSpan = document.createElement('span')
  labelSpan.className = 'fc-muted'
  labelSpan.innerHTML = 'Following&nbsp;&nbsp;'

  const a = document.createElement('a')
  a.id = followingCountId
  a.className = 'link--unstyled'
  a.href = document.location.pathname + '/following'
  a.innerHTML = `${countSpan.outerHTML} ${labelSpan.outerHTML}`

  for (const child of userDataFooter.children) {
    if (child.tagName === 'DIV' && child.children.length > 1) {
      const coinPriceLabelDiv = child.children.item(1)
      if (coinPriceLabelDiv && coinPriceLabelDiv.innerHTML.startsWith('Coin Price')) {
        userDataFooter.insertBefore(a, child)
        break
      }
    }
  }
}

const addHodlerBadgeProfile = function (userDataDiv, hodlersList, pubKey) {
  if (!userDataDiv || !hodlersList | !pubKey) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  let hodler = hodlersList.find(user => user.HODLerPublicKeyBase58Check === pubKey)
  if (hodler) {
    const isHodlerSpan = document.createElement('span')
    isHodlerSpan.className = 'badge badge-pill badge-secondary ml-2 fs-12px text-grey5'
    isHodlerSpan.title = 'Coin holder'
    isHodlerSpan.setAttribute('bs-toggle', 'tooltip')
    isHodlerSpan.innerHTML = '<i class="fas fa-coins"></i>'

    usernameDiv.appendChild(isHodlerSpan)
  }
}

const addEditProfileButton = function () {
  let editProfileButtonId = 'plus-sidebar-edit-profile'
  if (document.getElementById(editProfileButtonId)) return

  const leftBarButtons = document.querySelectorAll('left-bar-button')
  try {
    leftBarButtons.forEach(button => {
      const profileDiv = button.firstElementChild.lastElementChild
      const profileAnchor = profileDiv.firstElementChild

      if (profileAnchor.innerHTML.includes('Profile')) {
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

const addNewPostButton = function () {
  let addPostButtonId = 'plus-add-new-post'
  if (document.getElementById(addPostButtonId)) return

  const globalNavElements = document.getElementsByClassName('global__nav__inner')
  try {
    const globalNav = globalNavElements.item(0)

    let button = document.createElement('button')
    button.id = addPostButtonId
    button.type = 'button'
    button.className = 'btn btn-secondary font-weight-bold fs-14px'
    button.innerText = 'Post'
    button.onclick = () => window.location.href = 'posts/new'

    globalNav.appendChild(button)
  } catch (e) {}
}

const toggleDarkMode = function (enabled) {
  if (enabled) {
    loadCSS('dark')
    chrome.storage.sync.set({'darkMode' : true})
  } else {
    unloadCSS('dark')
    chrome.storage.sync.set({'darkMode' : false})
  }
}

const addDarkModeSwitch = function () {
  let darkModeSwitchId = 'plus-dark-mode-switch'
  if (document.getElementById(darkModeSwitchId)) return

  const globalNavElements = document.getElementsByClassName('global__nav__inner')
  try {
    const globalNav = globalNavElements.item(0)
    globalNav.classList.add('d-flex')
    globalNav.classList.add('flex-column')

    const input = document.createElement('input')
    input.id = darkModeSwitchId
    input.type = 'checkbox'
    input.className = 'custom-control-input'
    input.onclick = () => toggleDarkMode(input.checked)

    const icon = document.createElement('i')
    icon.className = 'fas fa-moon'
    icon.setAttribute('aria-hidden', 'true')
    icon.style.color = '#666'

    const label = document.createElement('label')
    label.className = 'custom-control-label'
    label.setAttribute('for', darkModeSwitchId)
    label.appendChild(icon)

    const div = document.createElement('div')
    div.className = 'custom-control custom-switch mt-auto mb-4 ml-auto mr-auto'
    div.appendChild(input)
    div.appendChild(label)

    globalNav.appendChild(div)

    chrome.storage.sync.get(['darkMode'], value => {
      if (value.darkMode === true) input.checked = true
    })
  } catch (e) {}
}

const addSendBitCloutMenuItem = function (menu) {
  if (!menu) return

  let sendBitCloutId = 'plus-profile-menu-send-bitclout'
  if (document.getElementById(sendBitCloutId)) return

  try {
    const a = document.createElement('a')
    a.id = sendBitCloutId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Send $BitClout '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `send-bitclout?username=${username}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const addSendMessageMenuItem = function (menu) {
  if (!menu) return

  let sendMessageId = 'plus-profile-menu-send-message'
  if (document.getElementById(sendMessageId)) return

  try {
    const a = document.createElement('a')
    a.id = sendMessageId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-envelope"></i> Message '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `inbox/${username}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const addHistoryMenuItem = function (menu) {
  if (!menu) return

  let historyId = 'plus-profile-menu-history'
  if (document.getElementById(historyId)) return

  try {
    const a = document.createElement('a')
    a.id = historyId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-chart-line"></i> Price History '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `https://bitcloutsignal.com/history/${username}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const addWalletMenuItem = function (menu) {
  if (!menu) return

  let walletId = 'plus-profile-menu-wallet'
  if (document.getElementById(walletId)) return

  try {
    const a = document.createElement('a')
    a.id = walletId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-wallet"></i> View Wallet '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `https://bitcloutinsights.com/u/${username}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const getProfileMenu = function () {
  const dropdownContainer = document.querySelector('bs-dropdown-container')
  if (!dropdownContainer) return undefined

  const menu = dropdownContainer.getElementsByClassName('dropdown-menu')[0]
  if (menu.firstElementChild.innerHTML.includes("Block")) {
    return menu
  }
  return undefined
}

const enrichProfile = function () {
  let profileDetails = document.querySelector('creator-profile-details')
  if (!profileDetails) return

  const profileMenu = getProfileMenu()
  addHistoryMenuItem(profileMenu)
  addWalletMenuItem(profileMenu)
  addSendMessageMenuItem(profileMenu)
  addSendBitCloutMenuItem(profileMenu)

  addHolderEnrichments()
}

const enrichWallet = function () {
  const coinCountId = 'plus-trade-founder-fee-percentage'
  if (document.getElementById(coinCountId)) return

  try {
    const coinElements = document.getElementsByClassName('holdings__creator-coin-name')

    const coinCount = document.createElement('span')
    coinCount.id = coinCountId
    coinCount.className = 'fc-muted fs-16px ml-1'
    coinCount.innerText = `(${coinElements.length})`

    const contentSection = document.getElementsByClassName('global__mobile-scrollable-section').item(0)
    const holdingsDiv = contentSection.children.item(2)
    const labelDiv = holdingsDiv.firstElementChild
    labelDiv.appendChild(coinCount)

    const cloutSpotPrice = getSpotPrice()
    const valueDiv = holdingsDiv.lastElementChild
    const usdValue = parseFloat(valueDiv.firstElementChild.innerHTML.replace(/[^0-9.]+/g, ''))
    const cloutValue = usdValue / cloutSpotPrice

    const cloutPrice = document.createElement('p')
    cloutPrice.className = 'fc-muted fs-14px ml-3'
    cloutPrice.innerHTML = `${cloutValue.toFixed(4)} BCLT`
    valueDiv.appendChild(cloutPrice)

    const scrollableSection = document.getElementsByClassName('global__mobile-scrollable-section').item(0)
    const balanceValuesDiv = scrollableSection.children.item(1).firstElementChild.lastElementChild
    const balanceCloutValue = parseFloat(balanceValuesDiv.firstElementChild.innerHTML.trim())
    const balanceUsdValue = parseFloat(balanceValuesDiv.lastElementChild.innerHTML.replace(/[^0-9.]+/g, ''))

    const cloutSpan = document.createElement('span')
    cloutSpan.className = 'text-muted fs-14px font-weight-normal'
    cloutSpan.innerHTML = `${(cloutValue + balanceCloutValue).toFixed(4)} <span class="text-muted fs-12px font-weight-normal">BCLT</span>`

    const usdSpan = document.createElement('span')
    usdSpan.className = 'fs-16px'
    const usdValueText = dollarFormatter.format(usdValue + balanceUsdValue)
    usdSpan.innerHTML = `${usdValueText} <span class="text-muted fs-14px font-weight-normal">USD</span>`

    const totalSpan = document.createElement('span')
    totalSpan.className = 'ml-auto mr-15px'
    totalSpan.style.lineHeight = '1.2'
    totalSpan.appendChild(usdSpan)
    totalSpan.appendChild(document.createElement('br'))
    totalSpan.appendChild(cloutSpan)

    const topBar = document.getElementsByClassName('global__top-bar').item(0)
    topBar.appendChild(totalSpan)
  } catch (e) {}
}

const enrichBuy = function () {
  const percentageId = 'plus-trade-founder-fee-percentage'
  if (document.getElementById(percentageId)) return

  const tradeCreatorTable = document.querySelector('trade-creator-table')
  if (!tradeCreatorTable) return

  getLoggedInProfile()
    .then(profile => profile.PublicKeyBase58Check)
    .then(key => {
      const exchangingDiv = tradeCreatorTable.children.item(0)
      const exchangingAmountSpan = exchangingDiv.children.item(1)
      const exchangeText = exchangingAmountSpan.innerText.substring(0, exchangingAmountSpan.innerText.indexOf('BitClout'))
      const exchangingAmount = parseFloat(exchangeText.trim())
      if (exchangingAmount === 0 || isNaN(exchangingAmount)) return Promise.reject()

      return fetch(`${apiBaseUrl}/buy-or-sell-creator-coin-preview-WVAzTWpGOFFnMlBvWXZhTFA4NjNSZGNW`, {
        'headers': reqHeaders,
        'referrerPolicy': 'no-referrer',
        'body': JSON.stringify({
          UpdaterPublicKeyBase58Check: key,
          CreatorPublicKeyBase58Check: key,
          OperationType: 'buy',
          BitCloutToSellNanos: exchangingAmount * nanosInBitClout,
          MinFeeRateNanosPerKB: 1000
        }),
        'method': 'POST',
        'mode': 'cors',
        'credentials': 'include'
      })
    })
    .then(res => res.json())
    .then(buyPreview => {
      if (document.getElementById(percentageId)) return

      const founderFee = buyPreview.FounderRewardGeneratedNanos / nanosInBitClout

      let feePercentage = document.createElement('span')
      feePercentage.id = percentageId
      feePercentage.innerHTML = ` (${founderFee.toFixed(5)})`

      const rewardDiv = tradeCreatorTable.lastElementChild
      const rewardSpan = rewardDiv.getElementsByTagName('span').item(0)
      rewardSpan.appendChild(feePercentage)
    })
    .catch(() => {})
}

const enrichTransfer = function () {
  const transferElement = document.querySelector('transfer-bitclout')
  const recipientDiv = transferElement.children.item(2)
  const usernameInput = recipientDiv.lastElementChild

  if (usernameInput.value && usernameInput.value.length > 0) return

  const params = new URLSearchParams(window.location.search)
  usernameInput.value = params.get('username')
}

const formatPriceUsd = function (price) {
  return `${dollarFormatter.format(price)} USD`
}

const enrichBalanceBox = function (profile) {
  if (!profile) return

  try {
    const nativePrice = (profile.CoinPriceBitCloutNanos / 1000000000).toFixed(2)
    const spotPrice = getSpotPrice()
    const coinPriceUsd = nativePrice * spotPrice

    const creatorCoinBalanceId = 'plus-creator-coin-balance'
    const creatorCoinPriceId = 'plus-creator-coin-price'
    const creatorCoinPriceUsdId = 'plus-creator-coin-price-usd'
    const existingElement = document.getElementById(creatorCoinBalanceId)
    if (existingElement) {
      document.getElementById(creatorCoinPriceId).innerHTML = ` ${nativePrice} BCLT `
      document.getElementById(creatorCoinPriceUsdId).innerHTML = formatPriceUsd(coinPriceUsd)
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
    coinPriceDiv.className = 'd-flex align-items-center justify-content-end flex-wrap'

    const coinPriceValueDiv = document.createElement('div')
    coinPriceValueDiv.id = creatorCoinPriceId
    coinPriceValueDiv.innerHTML = ` ${nativePrice} BCLT `

    const coinPriceConversionDiv = document.createElement('div')
    coinPriceConversionDiv.className = 'd-flex text-muted'

    const coinPriceApproximateDiv = document.createElement('div')
    coinPriceApproximateDiv.className = 'ml-10px mr-10px'
    coinPriceApproximateDiv.innerHTML = ' ≈ '

    const coinPriceUsdDiv = document.createElement('div')
    coinPriceUsdDiv.id = creatorCoinPriceUsdId
    coinPriceUsdDiv.innerHTML = formatPriceUsd(coinPriceUsd)

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

const addGlobalEnrichments = function () {
  addEditProfileButton()
  addNewPostButton()
  addDarkModeSwitch()
  replacePostBtnClickEvent()
}

function buildTributeUsernameMenuTemplate (item) {
  const spotPrice = getSpotPrice()
  const bitcloutPrice = item.original.CoinPriceBitCloutNanos / nanosInBitClout

  const priceDiv = document.createElement('div')
  priceDiv.className = 'text-muted fs-12px'
  priceDiv.innerText = `${dollarFormatter.format(spotPrice * bitcloutPrice)}`

  const verifiedIcon = document.createElement('i')
  verifiedIcon.className = 'fas fa-check-circle fa-md ml-1 text-primary'

  const reservedIcon = document.createElement('i')
  reservedIcon.className = 'far fa-clock fa-md ml-1 text-muted'

  let icon
  if (item.original.IsVerified) {
    icon = verifiedIcon
  } else if (item.original.IsReserved) {
    icon = reservedIcon
  }

  let username = item.string
  if (icon) username += icon.outerHTML

  const nameDiv = document.createElement('div')
  nameDiv.className = 'ml-1 pl-1'
  nameDiv.innerHTML = username

  nameDiv.appendChild(priceDiv)

  const img = document.createElement('img')
  img.className = 'tribute-avatar'
  img.src = item.original.ProfilePic

  const row = document.createElement('div')
  row.className = 'row no-gutters'
  row.appendChild(img)
  row.appendChild(nameDiv)

  return row.outerHTML
}

function buildLoadingItemTemplate () {
  return `<div class="row no-gutters fs-15px p-3">Loading...</div>`
}

const addPostUsernameAutocomplete = function () {
  const createPostInputs = document.getElementsByClassName('cdk-textarea-autosize')
  for (let input of createPostInputs) {
    if (input.dataset && !input.dataset.tribute) {
      const tribute = new Tribute({
        values: (text, cb) => searchUsernames(text, users => cb(users)),
        menuItemTemplate: (item) => buildTributeUsernameMenuTemplate(item),
        loadingItemTemplate: buildLoadingItemTemplate(),
        fillAttr: 'Username',
        lookup: 'Username'
      })
      tribute.attach(input)
    }
  }
}

const addTransferRecipientUsernameAutocomplete = function (placholder) {
  const transferInput = document.querySelectorAll(`input[placeholder="${placholder}"]`).item(0)
  if (!transferInput || transferInput.dataset && transferInput.dataset.tribute) return

  const tribute = new Tribute({
    autocompleteMode: true,
    replaceTextSuffix: '',
    values: (text, cb) => searchUsernames(text, users => cb(users)),
    loadingItemTemplate: buildLoadingItemTemplate(),
    menuItemTemplate: (item) => buildTributeUsernameMenuTemplate(item),
    selectTemplate: (item) => {
      if (typeof item === 'undefined') return null
      return item.original.Username
    },
    fillAttr: 'Username',
    lookup: 'Username'
  })
  tribute.attach(transferInput)
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

  identityFrame.contentWindow.postMessage({
    id: id,
    service: 'identity',
    method: 'sign',
    payload: payload
  }, '*')
}

const onPostButtonClick = (postButton) => {
  if (!postButton) return

  const container =  document.querySelector('feed-create-post')
  if (!container) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

  const postBody = postTextArea.value
  if (!postBody) return

  postButton.classList.add('disabled')

  const spinnerAlt = document.createElement('span')
  spinnerAlt.className = 'sr-only'
  spinnerAlt.innerText = 'Working...'

  const spinner = document.createElement('div')
  spinner.className = 'spinner-border spinner-border-sm text-light'
  spinner.dataset.role = 'status'
  spinner.appendChild(spinnerAlt)

  postButton.innerHTML = spinner.outerHTML

  const postImage = container.getElementsByClassName('feed-post__image').item(0)
  const image = (postImage && postImage.src.includes('images.bitclout.com')) ? postImage.src : undefined

  const postVideo = container.querySelector('input[type="url"]')
  const videoUrl = postVideo ? postVideo.value : undefined

  getLoggedInProfile()
    .then(profile => profile.PublicKeyBase58Check)
    .then(pubKey => submitPost(pubKey, postBody, image, videoUrl))
    .then(transactionHex => {
      if (!transactionHex) return Promise.reject('Error creating submit-post transaction')

      pendingTransactionHex = transactionHex

      return getCurrentIdentity()
        .then(identity => {
          pendingSignTransactionId = _.UUID.v4()
          sendSignTransactionMsg(identity, transactionHex, pendingSignTransactionId)
        })
    })
    .catch(reason => {
      postButton.classList.remove('disabled')
      postButton.innerHTML = 'Post'
    })
}

const getPostButton = (container) => {
  const primaryButtons = container.getElementsByClassName('btn-primary')
  let postButton
  for (let primaryButton of primaryButtons) {
    if (primaryButton.innerHTML.includes('Post')) {
      postButton = primaryButton
      break
    }
  }
  return postButton
}

const replacePostBtnClickEvent = () => {
  if (!longPostEnabled) return

  const container = document.querySelector('feed-create-post')
  if (!container) return

  const postButton = getPostButton(container)
  if (!postButton) return

  postButton.onclick = () => onPostButtonClick(postButton)
}

const addPostTextAreaListener = () => {
  if (!longPostEnabled) return

  const container = document.querySelector('feed-create-post')
  if (!container) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

  const characterCounter = container.getElementsByClassName('feed-create-post__character-counter').item(0)
  const postButton = getPostButton(container)

  postTextArea.addEventListener('input', (event) => {
    const characterCount = postTextArea.value.length
    characterCounter.innerText = `${characterCount} / ${maxPostLength}`

    if (characterCount > maxPostLength) {
      postButton.classList.add('disabled')
      characterCounter.classList.add('fc-red')
      characterCounter.classList.remove('text-grey8A')
      characterCounter.classList.remove('text-warning')
    } else if (characterCount === 0) {
      postButton.classList.add('disabled')
    } else if (characterCount > 280) {
      postButton.classList.remove('disabled')
      characterCounter.classList.remove('fc-red')
      characterCounter.classList.remove('text-grey8A')
      characterCounter.classList.add('text-warning')
    } else {
      postButton.classList.remove('disabled')
      characterCounter.classList.remove('fc-red')
      characterCounter.classList.add('text-grey8A')
      characterCounter.classList.remove('text-warning')
    }
  })
}

// Callback function to execute when body mutations are observed
const appRootObserverCallback = function () {
  if (currentUrl !== window.location.href) {
    observingHolders = false
    currentUrl = window.location.href
  }

  addGlobalEnrichments()

  const profilePage = document.querySelector('app-creator-profile-page')
  if (profilePage) {
    enrichProfile()
    return
  }

  const wallet = document.querySelector('wallet')
  if (wallet) {
    enrichWallet()
    return
  }

  const tradePage = document.querySelector('trade-creator-page')
  if (tradePage) {
    enrichBuy()
    addTransferRecipientUsernameAutocomplete("Enter a bitclout public key or recipient")
    return
  }

  const transferPage = document.querySelector('transfer-bitclout-page')
  if (transferPage) {
    enrichTransfer()
  }
}

const updateUserCreatorCoinPrice = function () {
  getProfile(getLoggedInUsername())
    .then(profile => {
      loggedInProfile = profile
      enrichBalanceBox(profile)
    })
    .catch(() => {})
}

const getProfileUserDataDiv = function () {
  const topCard = document.querySelector('creator-profile-top-card')
  if (!topCard) return undefined

  const topCardContent = topCard.firstElementChild
  if (!topCardContent) return undefined

  const children = topCardContent.children
  if (!children || children.length < 4) return undefined

  return children.item(3)
}

function enrichProfileFromApi () {
  const pageUsername = getUsernameFromUrl()
  if (!pageUsername) return

  return getLoggedInProfile()
    .then(loggedInProfile => {
      getFollowing(pageUsername)
        .then(followingRes => {
          const userDataDiv = getProfileUserDataDiv()
          if (!userDataDiv) return Promise.reject()

          addFollowsYouBadgeProfile(userDataDiv, loggedInProfile, followingRes.PublicKeyToProfileEntry)
          addFollowingCountProfile(userDataDiv, followingRes.NumFollowers)

          if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

          const loggedInPubKey = loggedInProfile.PublicKeyBase58Check
          return getProfile(pageUsername)
            .then(pageProfile => {
              const userDataDiv = getProfileUserDataDiv()
              if (!userDataDiv) return Promise.reject()

              if (getUsernameFromUrl() !== pageUsername) return

              addNativeCoinPrice(userDataDiv, pageProfile)
              addFounderReward(userDataDiv, pageProfile)
              addHoldersCount(pageProfile)

              return Promise.resolve(pageProfile)
            })
            .then(pageProfile => {
              if (!pageProfile) return Promise.reject()

              return getHodlers(loggedInPubKey, getLoggedInUsername())
                .then(hodlersList => {
                  const userDataDiv = getProfileUserDataDiv()
                  if (!userDataDiv) return Promise.reject()

                  addHodlerBadgeProfile(userDataDiv, hodlersList, pageProfile.PublicKeyBase58Check)
                })
            })
            .then(() => {
              return getHodlers(loggedInPubKey, pageUsername)
                .then(hodlersList => {
                  const loggedInUserIsHodler = hodlersList.filter(hodler => hodler.HODLerPublicKeyBase58Check === loggedInPubKey).length > 0
                  if (loggedInUserIsHodler) addSellButton()
                })
            })
        })
    })
    .catch(() => {})
}

function observeProfileInnerContent () {
  const globalCenterInner = document.getElementsByClassName('global__center__inner')
  if (globalCenterInner && globalCenterInner.length > 0) {
    const observerConfig = { childList: true, subtree: false }
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        Array.from(mutation.addedNodes, node => {
          if (node.nodeName !== 'SIMPLE-CENTER-LOADER') {
            enrichProfileFromApi()
          }
        })
      })
    })
    observer.observe(globalCenterInner[0].firstElementChild, observerConfig)
  }
}

const globalContainerObserverCallback = function () {
  updateUserCreatorCoinPrice()
  addPostUsernameAutocomplete()

  addPostTextAreaListener()

  const profilePage = document.querySelector('app-creator-profile-page')
  if (profilePage) {
    observeProfileInnerContent()
    return
  }

  const transferPage = document.querySelector('transfer-bitclout-page')
  if (transferPage) {
    addTransferRecipientUsernameAutocomplete("Enter a public key or username.")
  }
}

const bodyObserverCallback = function () {
  const modalContainer = document.querySelector('modal-container')
  if (modalContainer) {
    addPostUsernameAutocomplete()
  }
}

const onTransactionSigned = (payload) => {
  if (!payload) return

  const transactionHex = payload.signedTransactionHex
  if (!transactionHex) return

  submitTransaction(transactionHex).then(res => {
    const response = res.PostEntryResponse
    if (response && response.PostHashHex) {
      window.location.href = `posts/${response.PostHashHex}`
    } else {
      window.location.href = `u/${getLoggedInUsername()}`
    }
  }).catch(() => {})
}

const handleLogin = (payload) => {
  if (identityWindow) {
    identityWindow.close()
    identityWindow = null
  }

  chrome.storage.local.set({ users: payload.users })

  if (payload.signedTransactionHex) {
    onTransactionSigned(payload)
  }
}

function handleUnknownMessage (payload) {
  if (!payload) return

  if (payload.approvalRequired && pendingTransactionHex) {
    identityWindow = window.open(`https://identity.bitclout.com/approve?tx=${pendingTransactionHex}`, null, 'toolbar=no, width=800, height=1000, top=0, left=0')
    pendingTransactionHex = null
  } else if (payload.signedTransactionHex) {
    onTransactionSigned(payload)
  }
}

const handleMessage = (message) => {
  const { data: { id: id, method: method, payload: payload } } = message

  if (method === 'initialize') {
    identityFrame = document.getElementById("identity")
  } else if (method === 'login') {
    handleLogin(payload)
  } else if (id === pendingSignTransactionId) {
    pendingSignTransactionId = null
    handleUnknownMessage(payload)
  }
}

const init = function () {
  window.addEventListener('message', handleMessage)

  chrome.storage.sync.get(['darkMode'], value => {
    if (value.darkMode === true) loadCSS('dark')
  })

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
  timer = setInterval(updateUserCreatorCoinPrice, 60 * 1000)
}

init()