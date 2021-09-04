/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const nanosInBitClout = 1000000000
const maxPostLength = 2000
const postButtonClass = 'plus-btn-submit-post'

let timer, currentUrl
let identityWindow, identityUsers
let pendingSignTransactionId, pendingTransactionHex
let searchAbortController

let longPostEnabled = true
let observingHolders = false

const dollarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
})

const getSpotPrice = function () {
  const balanceBox = document.getElementsByClassName('right-bar-creators__balance-box').item(0)

  try {
    const priceContainerDiv = balanceBox.firstElementChild
    const priceDiv = priceContainerDiv.children.item(1).firstElementChild
    return parseFloat(priceDiv.innerHTML.replace(/[^0-9.]+/g, ''))
  } catch (e) {}

  return 0
}

const getLoggedInUsername = function () {
  const elementList = document.getElementsByClassName('change-account-selector__acount-name')

  try {
    const changeAccountSelector = elementList.item(0)
    return changeAccountSelector.innerHTML.trim()
  } catch (e) {}

  return ''
}

const getUsernameFromUrl = function () {
  const segments = new URL(document.location).pathname.split('/')
  if (segments[1] === 'u') return segments[2]
  return undefined
}

const getLoggedInPublicKey = function () {
  const key = window.localStorage.getItem('lastLoggedInUser')
  if (!key) return undefined

  return JSON.parse(key)
}

const getCurrentIdentity = () => {
  const key = getLoggedInPublicKey()
  const storedIdentityUsers = window.localStorage.getItem('identityUsers')
  if (!key || !storedIdentityUsers) return undefined
  const identityUsers = JSON.parse(storedIdentityUsers)
  return identityUsers[key]
}

const addNativeCoinPriceToProfileHeader = (userDataDiv, profile) => {
  const nativePriceId = 'plus-profile-native-price'

  if (!userDataDiv || !profile || document.getElementById(nativePriceId)) return

  const priceContainerDiv = userDataDiv.children.item(1)
  if (!priceContainerDiv) return

  const priceDiv = priceContainerDiv.firstElementChild

  const coinPriceNanos = profile['CoinPriceBitCloutNanos']
  const nativePrice = (coinPriceNanos / nanosInBitClout).toFixed(2)

  const tooltipAttr = document.createAttribute('data-bs-toggle')
  tooltipAttr.value = 'tooltip'

  let span = document.createElement('span')
  span.id = nativePriceId
  span.className = 'plus-text-muted mr-2 fs-14px'
  span.style.fontWeight = '500'
  span.innerHTML = `(${nativePrice} $CLOUT)`
  span.setAttributeNode(tooltipAttr)

  priceDiv.insertBefore(span, priceDiv.lastChild)
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

const addHoldersCount = function (holderCount) {
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
  span.innerText = `(${holderCount})`
}

function addHolderPositionRank (node, index, userHoldsOwnCoin) {
  if (userHoldsOwnCoin && index === 0) return

  node.querySelector('.text-truncate').style.maxWidth = '160px !important'

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
    const heldColumnItem = node.firstChild.firstChild.childNodes.item(1)
    const coinsHeld = parseFloat(heldColumnItem.innerHTML)

    const holderPercentageClassName = 'plus-profile-holder-share'
    let span
    const existingSpan = node.querySelector(`.${holderPercentageClassName}`)
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

const highlightUserInHolderList = (node, loggedInUsername) => {
  try {
    const nameSpan = node.querySelector('.text-truncate')
    const holderUsername = nameSpan.innerText
    if (loggedInUsername === holderUsername) {
      node.className = 'light-grey-divider'
    }
  } catch (e) { }
};

const addHolderEnrichments = function (coinsInCirculation) {
  const topCard = document.querySelector('creator-profile-top-card')
  const creatorProfileHodlers = document.querySelector('creator-profile-hodlers')
  if (!creatorProfileHodlers || observingHolders || !topCard) return
  const holdersList = creatorProfileHodlers.firstElementChild

  // Before the list loads, it has an "empty" view
  if (holdersList.childElementCount === 1) return

  const pageUsername = getUsernameFromUrl()
  const loggedInUsername = getLoggedInUsername()

  const firstHodlerNode = holdersList.childNodes.item(1)
  const firstHolderName = firstHodlerNode.querySelector('.text-truncate')
  const holdsOwnCoin = pageUsername.toLowerCase().startsWith(firstHolderName.innerText.toLowerCase())

  try {
    // Only the first few holders items are initially loaded...
    const childNodes = holdersList.childNodes
    for (let i = 1; i < childNodes.length; i++) {
      const node = childNodes.item(i)
      if (!node.dataset) continue

      const index = Number(node.dataset.sid)
      highlightUserInHolderList(node, loggedInUsername)
      addHolderPositionRank(node, index, holdsOwnCoin)
      addHolderPercentage(node, index, coinsInCirculation)
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
        addHolderPercentage(node, index, coinsInCirculation)
      })
    })
  }).observe(holdersList, config)
  observingHolders = true
}

const createFollowsYouBadge = (id) => {
  const followsYouSpan = document.createElement('span')
  if (id) followsYouSpan.id = id
  followsYouSpan.className = 'badge badge-pill plus-badge plus-badge-icon ml-2 global__tooltip-icon plus-tooltip'
  followsYouSpan.innerHTML = `<i class="fas fa-user-friends"><span class="plus-tooltip-text">Follows you</span></i>`
  return followsYouSpan
}

const addFollowsYouBadgeToProfileHeader = function (userDataDiv, followingList) {
  const followsYouBadgeId = 'plus-profile-follows-you-badge'
  const loggedInKey = getLoggedInPublicKey()
  const alreadyAdded = document.getElementById(followsYouBadgeId)
  if (alreadyAdded || !loggedInKey || !userDataDiv || !followingList || followingList.length === 0) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  let followsYou = followingList[loggedInKey]
  if (followsYou) {
    const followsYouSpan = createFollowsYouBadge(followsYouBadgeId)
    usernameDiv.appendChild(followsYouSpan)
  }
}

const addHodlerBadgeToProfileHeader = function (userDataDiv, hodlersList, pubKey) {
  const holderBadgeId = 'plus-profile-holder-badge'
  const alreadyAdded = document.getElementById(holderBadgeId);
  if (alreadyAdded || !userDataDiv || !hodlersList || !pubKey) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  let hodler = hodlersList.find(user => user['HODLerPublicKeyBase58Check'] === pubKey)
  if (hodler) {
    const holding = hodler['BalanceNanos'] / nanosInBitClout
    const holdsOrPurchased = hodler['HasPurchased'] ? 'Purchased' : 'Gifted'
    const isHodlerSpan = document.createElement('span')
    const formattedHoldings = parseFloat(holding.toFixed(6))
    if (formattedHoldings === 0) return

    isHodlerSpan.id = holderBadgeId
    isHodlerSpan.className = 'badge badge-pill plus-badge plus-badge-icon ml-2 global__tooltip-icon plus-tooltip'
    isHodlerSpan.innerHTML = `<i class="fas fa-coins"><span class="plus-tooltip-text">${holdsOrPurchased} ${formattedHoldings} of your coin</span></i>`

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

    const button = document.createElement('button');
    button.id = addPostButtonId
    button.type = 'button'
    button.className = 'btn btn-secondary font-weight-bold fs-14px ml-3'
    button.innerText = 'Create Post'
    button.onclick = () => window.location.href = 'posts/new'

    const div = document.createElement('div')
    div.className = 'w-100 d-flex pt-3 pl-4 pr-2 pb-4'
    div.appendChild(button)

    globalNav.appendChild(div)
  } catch (e) {}
}

const openInNewTab = url => {
  window.open(url, '_blank').focus()
}

const addSendBitCloutMenuItem = function (menu) {
  if (!menu) return

  let sendBitCloutId = 'plus-profile-menu-send-bitclout'
  if (document.getElementById(sendBitCloutId)) return

  const topCard = document.querySelector('creator-profile-top-card')
  if (!topCard) return

  try {
    const a = document.createElement('a')
    a.id = sendBitCloutId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-hand-holding-usd"></i> Send $CLOUT '

    const publicKey = topCard.querySelector('.creator-profile__ellipsis-restriction').innerText.trim()
    a.onclick = () => window.location.href = `send-bitclout?public_key=${publicKey}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const addInsightsMenuItem = function (menu) {
  if (!menu) return

  let sendMessageId = 'plus-profile-menu-insights'
  if (document.getElementById(sendMessageId)) return

  try {
    const a = document.createElement('a')
    a.id = sendMessageId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-chart-bar"></i> Insights '

    const username = getUsernameFromUrl()
    a.onclick = () => openInNewTab(`https://prosperclout.com/u/${username}`)

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
    a.onclick = () => openInNewTab(`https://bitcloutsignal.com/history/${username}`)

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
    a.onclick = () => openInNewTab(`https://signalclout.com/u/${username}/wallet`)

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
  addInsightsMenuItem(profileMenu)
  addSendBitCloutMenuItem(profileMenu)
}

const enrichWallet = function (page) {
  try {
    const holdingsDiv = page.querySelectorAll('.holdings__divider').item(1)
    const holdingsValueDiv = holdingsDiv.lastElementChild
    const holdingsCloutValue = parseFloat(holdingsValueDiv.children.item(2).innerHTML.replace(/[^0-9.]+/g, ''))

    const scrollableSection = page.querySelector('.global__mobile-scrollable-section')
    const balanceValuesDiv = scrollableSection.children.item(1).firstElementChild.lastElementChild
    const balanceCloutValue = parseFloat(balanceValuesDiv.firstElementChild.innerHTML.trim())

    const cloutSpan = document.createElement('span')
    cloutSpan.className = 'plus-text-muted fs-14px font-weight-normal'
    cloutSpan.innerHTML = `${(holdingsCloutValue + balanceCloutValue).toFixed(4)} <span class="plus-text-muted fs-12px font-weight-normal">$CLOUT</span>`

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
    const jumio = document.querySelector('jumio-status')
    if (jumio) {
      jumio.parentElement.remove()
    }

    const nativePrice = (profile['CoinPriceBitCloutNanos'] / nanosInBitClout).toFixed(2)
    const spotPrice = getSpotPrice()
    const coinPriceUsd = nativePrice * spotPrice

    const creatorCoinBalanceId = 'plus-creator-coin-balance'
    const creatorCoinPriceId = 'plus-creator-coin-price'
    const creatorCoinPriceUsdId = 'plus-creator-coin-price-usd'
    const existingElement = document.getElementById(creatorCoinBalanceId)
    if (existingElement) {
      document.getElementById(creatorCoinPriceId).innerHTML = ` ${nativePrice} $CLOUT `
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
    coinPriceDiv.className = 'd-flex flex-column align-items-end justify-content-end flex-wrap'

    const coinPriceValueDiv = document.createElement('div')
    coinPriceValueDiv.id = creatorCoinPriceId
    coinPriceValueDiv.innerHTML = ` ${nativePrice} $CLOUT `

    const coinPriceConversionDiv = document.createElement('div')
    coinPriceConversionDiv.className = 'd-flex plus-text-muted'

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
}

function buildTributeUsernameMenuTemplate (item) {
  const spotPrice = getSpotPrice()
  const bitcloutPrice = item.original['CoinPriceBitCloutNanos'] / nanosInBitClout

  const priceDiv = document.createElement('div')
  priceDiv.className = 'plus-text-muted fs-12px'
  priceDiv.innerText = `${dollarFormatter.format(spotPrice * bitcloutPrice)}`

  const verifiedIcon = document.createElement('i')
  verifiedIcon.className = 'fas fa-check-circle fa-md ml-1 plus-text-primary'

  const reservedIcon = document.createElement('i')
  reservedIcon.className = 'far fa-clock fa-md ml-1 plus-text-muted'

  let icon
  if (item.original['IsVerified']) {
    icon = verifiedIcon
  } else if (item.original['IsReserved']) {
    icon = reservedIcon
  }

  let username = item.string
  if (icon) username += icon.outerHTML

  const nameDiv = document.createElement('div')
  nameDiv.className = 'ml-1 pl-1'
  nameDiv.innerHTML = username

  nameDiv.appendChild(priceDiv)

  const pubKey = item.original['PublicKeyBase58Check']
  const img = document.createElement('img')
  img.className = 'tribute-avatar'
  img.src = getProfilePhotoUrlForPublicKey(pubKey)

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

  const identityFrame = document.getElementById('identity')
  if (!identityFrame) throw 'No identity frame found'

  identityFrame.contentWindow.postMessage({
    id: id,
    service: 'identity',
    method: 'sign',
    payload: payload
  }, '*')
}

const restorePostDraft = () => {
  chrome.storage.local.get(['postDraft'], items => {
    const postDraft = items.postDraft
    if (postDraft) {
      const createPostTextArea = document.querySelector('.feed-create-post__textarea')
      if (createPostTextArea) {
        createPostTextArea.value = postDraft
        chrome.storage.local.remove(['postDraft'])
      }
    }
  })
}

const getPostButton = (container) => {
  const plusButton = container.querySelector(`.${postButtonClass}`)
  if (plusButton) return plusButton

  const primaryButtons = container.querySelectorAll('.btn-primary')
  let postButton
  for (let primaryButton of primaryButtons) {
    if (primaryButton.innerHTML.includes('Post')) {
      postButton = primaryButton
      break
    }
  }
  return postButton
}

const disableLongPost = () => {
  const container =  document.querySelector('feed-create-post')
  if (!container) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

  chrome.storage.local.set({
    longPost: false,
    postDraft: postTextArea.value
  })
  window.location.reload(true)
}

function addPostErrorDiv(e, container) {
  const btn = document.createElement('button')
  btn.className = 'btn btn-danger btn-sm mt-2'
  btn.innerText = 'Disable long posting'
  btn.onclick = () => disableLongPost()

  const p = document.createElement('p')
  p.className = 'plus-text-muted fs-14px'
  p.innerHTML = `
      Trouble posting? Disabling long posting may help.
      <br>
      <br>
      Please report this to <a href="/u/paulburke">@paulburke</a>:
      <br>
      <textarea class="w-100" rows="6">${(e.stack || e)}</textarea>
    `

  const div = document.createElement('div')
  div.className = 'p-2'

  div.appendChild(p)
  div.appendChild(btn)
  container.appendChild(div)
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
  const hasImage = postImage && postImage.src && postImage.src.includes(`images.${window.location.hostname}`)
  const image = hasImage ? postImage.src : undefined

  const postVideo = container.querySelector('input[type="url"]')
  const videoUrl = postVideo ? postVideo.value : undefined

  const pubKey = getLoggedInPublicKey()
  submitPost(pubKey, postBody, image, videoUrl).then(transactionHex => {
    if (!transactionHex) {
      return Promise.reject('Error creating submit-post transaction')
    }

    const identity = getCurrentIdentity()
    if (!identity) {
      return Promise.reject('No Identity found')
    }

    const id = _.UUID.v4()
    sendSignTransactionMsg(identity, transactionHex, id)
  }).catch(e => {
    addPostErrorDiv(e, container)

    postButton.classList.remove('disabled')
    postButton.innerHTML = 'Post'
  })
}

const replacePostBtn = () => {
  if (!longPostEnabled || document.querySelector(`.${postButtonClass}`)) return

  const form = document.querySelector('create-post-form') || document.querySelector('feed')
  const container = form && form.querySelector('feed-create-post')
  if (!container) return

  const postButton = getPostButton(container)
  if (!postButton) return

  const newButton = postButton.cloneNode(true)
  newButton.classList.add(postButtonClass)

  postButton.style.display = 'none'

  const parent = postButton.parentElement
  parent.appendChild(newButton)

  newButton.onclick = () => onPostButtonClick(newButton)
}

const addPostTextAreaListener = () => {
  if (!longPostEnabled) return

  const container = document.querySelector('feed-create-post')
  if (!container) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

  const characterCounter = container.querySelector('.feed-create-post__character-counter')

  postTextArea.addEventListener('input', () => {
    const characterCount = postTextArea.value.length

    const postButton = getPostButton(container)
    if (characterCount > 0) {
      postButton.classList.remove('disabled')
    } else {
      postButton.classList.add('disabled')
    }

    if (!characterCounter) return
    characterCounter.innerText = `${characterCount} / ${maxPostLength}`
    if (characterCount > maxPostLength) {
      characterCounter.classList.add('plus-text-red')
      characterCounter.classList.remove('text-grey8A')
      characterCounter.classList.remove('text-warning')
    } else if (characterCount > 280) {
      characterCounter.classList.remove('plus-text-red')
      characterCounter.classList.remove('text-grey8A')
      characterCounter.classList.add('text-warning')
    } else {
      characterCounter.classList.remove('plus-text-red')
      characterCounter.classList.add('text-grey8A')
      characterCounter.classList.remove('text-warning')
    }
  })
}

function fixImageLightbox(modalContainer) {
  const feedPostImage = modalContainer.querySelector('feed-post-image-modal')
  if (feedPostImage) {
    const content = modalContainer.querySelector('.modal-content')
    content.style.width = 'auto'
    content.style.margin = '0 auto'

    const dialog = modalContainer.querySelector('.modal-dialog')
    dialog.style.maxWidth = '1140px'
  }
}

// Callback function to execute when body mutations are observed
const appRootObserverCallback = function () {
  if (currentUrl !== window.location.href) {
    observingHolders = false
    currentUrl = window.location.href
  }

  addGlobalEnrichments()

  const profilePage = document.querySelector('creator-profile-page')
  if (profilePage) {
    enrichProfile()
  }
}

const updateUserCreatorCoinPrice = function () {
  const key = getLoggedInPublicKey()
  getProfileByPublicKey(key).then(profile => {
    enrichBalanceBox(profile)
  }).catch(() => {})
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

const profileTabsObserver = new MutationObserver(mutations => {
  if (document.querySelector('creator-profile-hodlers')) {
    enrichProfileFromApi(mutations[0].target)
  }
})

const observeProfileDetails = (profileDetailsDiv) => {
  const observerConfig = { childList: true, subtree: false }
  profileTabsObserver.disconnect()
  profileTabsObserver.observe(profileDetailsDiv, observerConfig)
}

const enrichProfileFromApi = (profileDetailsDiv) => {
  const pageUsername = getUsernameFromUrl()
  if (!pageUsername) return

  const loggedInPubKey = getLoggedInPublicKey()
  if (!loggedInPubKey) return

  observeProfileDetails(profileDetailsDiv)

  getFollowingByUsername(pageUsername).then(followingRes => {
    const userDataDiv = getProfileUserDataDiv()
    if (!userDataDiv) return Promise.reject()

    addFollowsYouBadgeToProfileHeader(userDataDiv, followingRes['PublicKeyToProfileEntry'])

    if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

  }).then(() => getProfileByUsername(pageUsername)).then(pageProfile => {
    const userDataDiv = getProfileUserDataDiv()
    if (!userDataDiv) return Promise.reject()

    if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

    addNativeCoinPriceToProfileHeader(userDataDiv, pageProfile)

    const circulation = pageProfile['CoinEntry']['CoinsInCirculationNanos'] / nanosInBitClout
    addHolderEnrichments(circulation)

    const pubKey = pageProfile['PublicKeyBase58Check']
    return Promise.resolve(pubKey)

  }).then(pagePubKey => {
    if (!pagePubKey) return Promise.reject()

    return getHodlersByPublicKey(loggedInPubKey).then(hodlersList => {
      if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

      const userDataDiv = getProfileUserDataDiv()
      if (!userDataDiv) return Promise.reject()

      addHodlerBadgeToProfileHeader(userDataDiv, hodlersList, pagePubKey)
    })
  }).then(() => getHodlersByUsername(pageUsername)).then(hodlersList => {
    addHoldersCount(hodlersList.length)

    const loggedInUserIsHodler = hodlersList.find(hodler => {
      return hodler['HODLerPublicKeyBase58Check'] === loggedInPubKey
    })
    if (loggedInUserIsHodler) addSellButton()
  }).catch(() => {})
}

const observeProfileInnerContent = (page) => {
  const profileDetailsDiv = page.querySelector('creator-profile-details')
  if (profileDetailsDiv) {
    const observerConfig = { childList: true, subtree: false }
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        Array.from(mutation.addedNodes, node => {
          if (node.nodeName !== 'SIMPLE-CENTER-LOADER') enrichProfileFromApi(node)
        })
      })
    })
    observer.observe(profileDetailsDiv, observerConfig)
  }
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
  }
}

const bodyObserverCallback = function () {
  const modalContainer = document.querySelector('modal-container')
  if (modalContainer) {
    addPostUsernameAutocomplete()
    fixImageLightbox(modalContainer)
  }

  replacePostBtn()
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
      window.location.href = `u/${getLoggedInUsername()}`
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
    const hostname = (window.location.hostname === 'love4src.com') ? 'identity.love4src.come' : 'identity.bitclout.com'
    identityWindow = window.open(
      `https://${hostname}/approve?tx=${pendingTransactionHex}`, null,
      'toolbar=no, width=800, height=1000, top=0, left=0')
  } else if (payload['signedTransactionHex']) {
    onTransactionSigned(payload)
  }
}

const handleMessage = (message) => {
  const { data: { id: id, method: method, payload: payload } } = message

 if (method === 'login') {
    handleLogin(payload)
  } else if (id === pendingSignTransactionId) {
    handleSignTransactionResponse(payload)
  }
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
  timer = setInterval(updateUserCreatorCoinPrice, 60 * 1000)
}

init()
