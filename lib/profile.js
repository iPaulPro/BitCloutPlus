/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const getUsernameFromUrl = function () {
  const segments = new URL(window.location).pathname.split('/')
  if (segments[1] === 'u') return segments[2]
  return undefined
}

const openInNewTab = url => {
  window.open(url, '_blank').focus()
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

const createMenuItem = (id, iconClassName, title) => {
  const icon = document.createElement('i')
  icon.className = `fas ${iconClassName}`

  const text = document.createElement('span')
  text.innerText = ` ${title}`

  const a = document.createElement('a')
  a.id = id
  a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'

  a.appendChild(icon)
  a.appendChild(text)

  return a
}

const addSendDeSoMenuItem = function (menu) {
  if (!menu) return

  let sendDeSoId = 'plus-profile-menu-send-deso'
  if (document.getElementById(sendDeSoId)) return


  try {
    const a = createMenuItem(sendDeSoId, 'fa-hand-holding-usd', 'Send $DESO')
    const publicKey = getPublicKeyFromPage()
    a.onclick = () => window.location.href = `send-deso?public_key=${publicKey}`
    menu.insertBefore(a, menu.firstElementChild)
  } catch (e) {}
}

const addInsightsMenuItem = function (menu) {
  if (!menu) return

  let sendMessageId = 'plus-profile-menu-insights'
  if (document.getElementById(sendMessageId)) return

  try {
    const a = createMenuItem(sendMessageId, 'fa-chart-bar', 'Insights')
    const username = getUsernameFromUrl()
    a.onclick = () => openInNewTab(`https://openprosper.com/u/${username}`)
    menu.insertBefore(a, menu.firstElementChild)
  } catch (e) {}
}

const addGeoMenuItem = function (menu) {
  if (!menu) return

  let walletId = 'plus-profile-menu-geo'
  if (document.getElementById(walletId)) return

  try {
    const a = createMenuItem(walletId, 'fa-map-marker-alt', 'View Location')
    const username = getUsernameFromUrl()
    a.onclick = () => openInNewTab(`https://desogeo.com/map?account=${username}`)
    menu.insertBefore(a, menu.firstElementChild)
  } catch (e) {}
}

const addNftMenuItem = function (menu) {
  if (!menu) return

  let walletId = 'plus-profile-menu-nft'
  if (document.getElementById(walletId)) return

  try {
    const a = createMenuItem(walletId, 'fa-store', 'Explore NFTs')
    const username = getUsernameFromUrl()
    a.onclick = () => openInNewTab(`https://${username}.nftz.zone`)
    menu.insertBefore(a, menu.firstElementChild)
  } catch (e) {}
}

const getProfileMenu = function () {
  const dropdownContainer = document.querySelector('bs-dropdown-container')
  if (!dropdownContainer) return undefined

  const menu = dropdownContainer.getElementsByClassName('dropdown-menu')[0]
  if (menu.firstElementChild.innerText.includes("Message User")) {
    return menu
  }
  return undefined
}

const enrichProfile = function () {
  let profileDetails = document.querySelector('creator-profile-details')
  if (!profileDetails) return

  const profileMenu = getProfileMenu()
  addGeoMenuItem(profileMenu)
  addNftMenuItem(profileMenu)
  addSendDeSoMenuItem(profileMenu)
  addInsightsMenuItem(profileMenu)
}

const addNativeCoinPriceToProfileHeader = (userDataDiv, profile) => {
  const nativePriceId = 'plus-profile-native-price'

  if (!userDataDiv || !profile || document.getElementById(nativePriceId)) return

  const priceContainerDiv = userDataDiv.children.item(1)
  if (!priceContainerDiv) return

  const priceDiv = priceContainerDiv.firstElementChild

  const coinPriceNanos = profile['CoinPriceDeSoNanos']
  const nativePrice = (coinPriceNanos / deSoInNanos).toFixed(2)

  const tooltipAttr = document.createAttribute('data-bs-toggle')
  tooltipAttr.value = 'tooltip'

  let span = document.createElement('span')
  span.id = nativePriceId
  span.className = 'plus-text-muted mr-2 fs-14px'
  span.style.fontWeight = '500'
  span.innerText = `(${nativePrice} $DESO)`
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
  if (!holderDiv || !holderDiv.innerText.includes('Holders of')) return

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
    const coinsHeld = parseFloat(heldColumnItem.innerText)

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
    span.innerText = '(' + ((coinsHeld / circulation) * 100).toFixed(1) + '%)'
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
  const text = document.createElement('span')
  text.className = 'plus-tooltip-text'
  text.innerText = 'Follows you'

  const icon = document.createElement('i')
  icon.className = 'fas fa-user-friends'
  icon.appendChild(text)

  const followsYouSpan = document.createElement('span')
  if (id) followsYouSpan.id = id
  followsYouSpan.className = 'badge badge-pill plus-badge plus-badge-icon ml-2 global__tooltip-icon plus-tooltip'
  followsYouSpan.appendChild(icon)

  return followsYouSpan
}

const addFollowsYouBadgeToProfileHeader = function (userDataDiv, following) {
  const followsYouBadgeId = 'plus-profile-follows-you-badge'
  const alreadyAdded = document.getElementById(followsYouBadgeId)

  if (alreadyAdded || !userDataDiv || !following) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  const followsYouSpan = createFollowsYouBadge(followsYouBadgeId)
  usernameDiv.appendChild(followsYouSpan)
}

const addHodlerBadgeToProfileHeader = function (userDataDiv, isHolding, balanceEntry) {
  const holderBadgeId = 'plus-profile-holder-badge'
  const alreadyAdded = document.getElementById(holderBadgeId);
  if (alreadyAdded || !userDataDiv || !isHolding) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  const holding = balanceEntry['BalanceNanos'] / deSoInNanos
  const holdsOrPurchased = balanceEntry['HasPurchased'] ? 'Purchased' : 'Gifted'
  const formattedHoldings = parseFloat(holding.toFixed(6))
  if (formattedHoldings === 0) return

  const text = document.createElement('span')
  text.className = 'plus-tooltip-text'
  text.innerText = `${holdsOrPurchased} ${formattedHoldings} of your coin`

  const icon = document.createElement('i')
  icon.className = 'fas fa-coins'
  icon.appendChild(text)

  const isHodlerSpan = document.createElement('span')
  isHodlerSpan.id = holderBadgeId
  isHodlerSpan.className = 'badge badge-pill plus-badge plus-badge-icon ml-2 global__tooltip-icon plus-tooltip'
  isHodlerSpan.appendChild(icon)

  usernameDiv.appendChild(isHodlerSpan)
}

const addJumioBadgeToProfileHeader = (userDataDiv) => {
  const holderBadgeId = 'plus-profile-jumio-badge'
  const alreadyAdded = document.getElementById(holderBadgeId);
  if (alreadyAdded || !userDataDiv) return

  const usernameDiv = userDataDiv.firstElementChild
  if (!usernameDiv) return

  const text = document.createElement('span')
  text.className = 'plus-tooltip-text'
  text.innerText = `Verified ID with Jumio`

  const icon = document.createElement('i')
  icon.className = 'fas fa-id-card'
  icon.appendChild(text)

  const isVerifiedSpan = document.createElement('span')
  isVerifiedSpan.id = holderBadgeId
  isVerifiedSpan.className = 'badge badge-pill plus-badge plus-badge-icon ml-2 global__tooltip-icon plus-tooltip'
  isVerifiedSpan.appendChild(icon)

  usernameDiv.appendChild(isVerifiedSpan)
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

const activeIndicatorId = 'plus_active-indicator'

const createActiveIndicatorElement = (tooltip) => {
  const activeIndicator = document.createElement('div')
  activeIndicator.id = activeIndicatorId
  activeIndicator.className = 'plus-active-indicator rounded-circle bg-success m-1'

  const container = document.createElement('div')
  container.className = 'plus-active-indicator-container cursor-pointer plus-tooltip'
  container.appendChild(activeIndicator)
  container.appendChild(tooltip)

  return container
}

const createActiveIndicatorTooltip = (innerText) => {
  const tooltip = document.createElement('span')
  tooltip.className = 'plus-tooltip-text fs-12px'
  tooltip.style.width = '180px'
  tooltip.style.left = '26px'
  tooltip.style.top = '10px'
  tooltip.innerText = innerText
  return tooltip
}

const addActiveIndicator = (tooltipText, profileDetailsDiv) => {
  const tooltip = createActiveIndicatorTooltip(tooltipText)
  const activeIndicator = createActiveIndicatorElement(tooltip)
  const avatar = profileDetailsDiv.querySelector('.creator-profile__avatar')
  avatar.appendChild(activeIndicator)
}

const showIndicatorIfActive = (publicKey, profileDetailsDiv) => getTransactionInfo(publicKey, -1, 100)
  .then((transactions) => {
    const latestTransaction = transactions.reverse()
      .find(transaction => transaction['TransactionMetadata']['TransactorPublicKeyBase58Check'] === publicKey)

    if (!latestTransaction) return

    if (document.getElementById(activeIndicatorId)) return

    const blockHashHex = latestTransaction['BlockHashHex']
    if (!blockHashHex || (blockHashHex && blockHashHex.length === 0)) {
      // This means the transaction is still in the mempool, which means active within the past 5 min
      const tooltipText = `Last active < 5 minutes ago`
      addActiveIndicator(tooltipText, profileDetailsDiv)
      return
    }

    getBlockByHash(blockHashHex).then((res) => {
      const header = res['Header']
      const error = res['Error']
      let tooltipText

      // This also means the transaction is still in the mempool
      if (error && error.includes('Key not found')) {
        tooltipText = `Last active < 5 minutes ago`
      } else {
        const now = Date.now()
        const timestamp = header['TstampSecs'] * 1000
        const recentlyActive = now - timestamp < (1000 * 60 * 15)
        if (recentlyActive) {
          // Block times are ~5 min, so we add that to account for time passed before the transaction was mined
          const timeAgo = Math.round((now - timestamp) / 1000 / 60) + 5
          tooltipText = `Last active ~${timeAgo} minutes ago`
        }
      }

      if (tooltipText) {
        addActiveIndicator(tooltipText, profileDetailsDiv)
      }
    })
  })

const enrichProfileFromApi = (profileDetailsDiv) => {
  const pageUsername = getUsernameFromUrl()
  if (!pageUsername) return

  const loggedInPubKey = getLoggedInPublicKey()
  if (!loggedInPubKey) return

  const pagePubKey = getPublicKeyFromPage()
  if (!pagePubKey) return

  observeProfileDetails(profileDetailsDiv)

  isFollowingPublicKey(pagePubKey, loggedInPubKey).then(followingRes => {
    const userDataDiv = getProfileUserDataDiv()
    if (!userDataDiv) return Promise.reject()

    addFollowsYouBadgeToProfileHeader(userDataDiv, followingRes['IsFollowing'])

    if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

  }).then(() => getProfileByUsername(pageUsername)).then(pageProfile => {
    const userDataDiv = getProfileUserDataDiv()
    if (!userDataDiv) return Promise.reject()

    if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

    addNativeCoinPriceToProfileHeader(userDataDiv, pageProfile)

    const circulation = pageProfile['CoinEntry']['CoinsInCirculationNanos'] / deSoInNanos
    addHolderEnrichments(circulation)

    const pubKey = pageProfile['PublicKeyBase58Check']
    return Promise.resolve(pubKey)

  }).then(pagePubKey => {
    if (!pagePubKey) return Promise.reject()

    return isHoldingPublicKey(pagePubKey, loggedInPubKey).then(res => {
      if (getUsernameFromUrl() !== pageUsername) return Promise.reject()

      const userDataDiv = getProfileUserDataDiv()
      if (!userDataDiv) return Promise.reject()

      addHodlerBadgeToProfileHeader(userDataDiv, res['IsHodling'], res['BalanceEntry'])
    })
  }).then(() => getHodlersByUsername(pageUsername)).then(hodlersList => {
    addHoldersCount(hodlersList.length)

    const loggedInUserIsHodler = hodlersList.find(hodler => {
      return hodler['HODLerPublicKeyBase58Check'] === loggedInPubKey
    })
    if (loggedInUserIsHodler) addSellButton()

    return getUserMetadata(pagePubKey).catch(() => {})

  }).then(metadata => {
    const userDataDiv = getProfileUserDataDiv()
    if (!userDataDiv) return Promise.reject()

    if (metadata['JumioVerified']) {
      addJumioBadgeToProfileHeader(userDataDiv)
    }
  })
    .then(() => showIndicatorIfActive(pagePubKey, profileDetailsDiv))
    .catch(() => {})
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
