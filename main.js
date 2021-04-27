// Copyright Paul Burke 2021. All Rights Reserved.
// Github: @ipaulpro/bitcloutplus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

const nanosInBitClout = 1000000000

let username, timer, loggedInProfile, currentUrl

let observingHolders = false

const followingCountId = 'plus-profile-following-count'

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
  return fetch('https://api.bitclout.com/get-single-profile', {
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
  return fetch('https://api.bitclout.com/get-follows-stateless', {
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
  return fetch('https://api.bitclout.com/get-hodlers-for-public-key', {
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

const searchUsernames = function (query, cb) {
  return fetch('https://api.bitclout.com/get-profiles', {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      UsernamePrefix: query,
      NumToFetch: 6
    }),
    'method': 'POST'
  }).then(res => res.json())
    .then(res => { cb(res.ProfilesFound) })
}

const addNativeCoinPrice = function (userDataDiv, profile) {
  const nativePriceId = 'plus-profile-native-price'
  if (document.getElementById(nativePriceId)) return

  try {
    const userDataFooter = userDataDiv.lastElementChild

    const nativePrice = (profile.CoinPriceBitCloutNanos / nanosInBitClout).toFixed(2)

    const tooltipAttr = document.createAttribute('data-bs-toggle')
    tooltipAttr.value = 'tooltip'

    let span = document.createElement('span')
    span.id = nativePriceId
    span.className = 'fc-muted mr-2 fs-13px'
    span.style.fontWeight = '500'
    span.style.cursor = 'pointer'
    span.innerText = `(${nativePrice})`
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
  if (!holderDiv || !holderDiv.innerHTML.startsWith('Holders')) return

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
      span.className = `${holderPositionClassName} fc-muted fs-14px align-items-start col-2 pl-0`

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
    const avatarAndName = node.firstChild.firstChild.firstChild
    const holderUsername = avatarAndName.textContent.trim().replaceAll('.', '')
    if (loggedInUsername === holderUsername) {
      node.className = 'light-grey-divider'
    }
  } catch (e) { }
}

function replaceAnonAvatarImage (node) {
  const avatar = node.querySelector('.creator-profile-details__hodler-avatar')
  if (avatar && avatar.style.backgroundImage.includes('default_profile_pic.png')) {
    avatar.style.backgroundImage = `url('${chrome.runtime.getURL('img/default_profile_pic.png')}')`
  }
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

      replaceAnonAvatarImage(node)
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
        replaceAnonAvatarImage(node)
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
  if (!userDataDiv || !loggedInProfile | !followingList) return

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
    isHodlerSpan.innerHTML = '<i class="fas fa-coins" aria-hidden="true"></i>'

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

      if (profileAnchor.innerHTML === 'Profile') {
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
  let sendBitCloutId = 'plus-profile-menu-send-bitclout'
  if (document.getElementById(sendBitCloutId)) return

  try {
    const a = document.createElement('a')
    a.id = sendBitCloutId
    a.className = 'dropdown-menu-item d-block p-10px feed-post__dropdown-menu-item fc-default'
    a.innerHTML = '<i class="fas fa-wallet" aria-hidden="true"></i> Send $BitClout '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `send-bitclout?username=${username}`

    menu.insertBefore(a, menu.firstElementChild)
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
    a.innerHTML = '<i class="fas fa-envelope" aria-hidden="true"></i> Message '

    const username = getUsernameFromUrl()
    a.onclick = () => window.location.href = `inbox/${username}`

    menu.insertBefore(a, menu.lastElementChild)
  } catch (e) {}
}

const getProfileMenu = function () {
  const dropdownMenuElements = document.getElementsByClassName('dropdown-menu')
  let menu

  try {
    for (const dropdown of dropdownMenuElements) {
      const dropDownParent = dropdown.parentElement
      if (dropDownParent.parentElement.className.includes('js-creator-profile-top-card-container')) {
        menu = dropdown
        break
      }
    }
  } catch (e) {}

  return menu
}

const enrichProfile = function () {
  let profileDetails = document.querySelector('creator-profile-details')
  if (!profileDetails) return

  addSellButton()

  const profileMenu = getProfileMenu()
  addSendBitCloutMenuItem(profileMenu)
  addSendMessageMenuItem(profileMenu)

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
    cloutPrice.innerHTML = `${cloutValue.toFixed(4)}`
    valueDiv.appendChild(cloutPrice)

    const scrollableSection = document.getElementsByClassName('global__mobile-scrollable-section').item(0)
    const balanceValuesDiv = scrollableSection.children.item(1).firstElementChild.lastElementChild
    const balanceCloutValue = parseFloat(balanceValuesDiv.firstElementChild.innerHTML.trim())
    const balanceUsdValue = parseFloat(balanceValuesDiv.lastElementChild.innerHTML.replace(/[^0-9.]+/g, ''))

    const cloutSpan = document.createElement('span')
    cloutSpan.className = 'text-muted fs-14px font-weight-normal'
    cloutSpan.innerHTML = `${(cloutValue + balanceCloutValue).toFixed(4)} <span class="text-muted fs-12px font-weight-normal">BTCLT</span>`

    const usdSpan = document.createElement('span')
    usdSpan.className = 'fs-16px'
    const usdValueText = (usdValue + balanceUsdValue).toLocaleString()
    usdSpan.innerHTML = `\$${usdValueText} <span class="text-muted fs-14px font-weight-normal">USD</span>`

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

      return fetch('https://api.bitclout.com/buy-or-sell-creator-coin-preview-WVAzTWpGOFFnMlBvWXZhTFA4NjNSZGNW', {
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
  return `\$${price.toFixed(2).toLocaleString()} USD`
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
      document.getElementById(creatorCoinPriceId).innerHTML = ` ${nativePrice} BTCLT `
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
    coinPriceValueDiv.innerHTML = ` ${nativePrice} BTCLT `

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
}

function buildTributeUsernameMenuTemplate (item) {
  return `<img height='32px' width='32px' src='${item.original.ProfilePic}' class='search-bar__avatar'> ` + item.string
}

const addPostUsernameAutocomplete = function () {
  const createPostInputs = document.getElementsByClassName('cdk-textarea-autosize')
  for (let input of createPostInputs) {
    if (input.dataset && input.dataset.tribute) return
  }

  const tribute = new Tribute({
    values: (text, cb) => searchUsernames(text, users => cb(users)),
    menuItemTemplate: (item) => buildTributeUsernameMenuTemplate(item),
    fillAttr: 'Username',
    lookup: 'Username'
  })
  tribute.attach(createPostInputs)
}

const addTransferRecipientUsernameAutocomplete = function (placholder) {
  const transferInput = document.querySelectorAll(`input[placeholder="${placholder}"]`).item(0)
  if (!transferInput || transferInput.dataset && transferInput.dataset.tribute) return

  const tribute = new Tribute({
    autocompleteMode: true,
    replaceTextSuffix: '',
    values: (text, cb) => searchUsernames(text, users => cb(users)),
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
          if (!userDataDiv) return

          addFollowsYouBadgeProfile(userDataDiv, loggedInProfile, followingRes.PublicKeyToProfileEntry)
          addFollowingCountProfile(userDataDiv, followingRes.NumFollowers)

          if (getUsernameFromUrl() !== pageUsername) return

          return getProfile(pageUsername)
            .then(pageProfile => {
              const userDataDiv = getProfileUserDataDiv()
              if (!userDataDiv) return

              if (getUsernameFromUrl() !== pageUsername) return

              addNativeCoinPrice(userDataDiv, pageProfile)
              addFounderReward(userDataDiv, pageProfile)
              addHoldersCount(pageProfile)

              return Promise.resolve(pageProfile)
            })
            .then(pageProfile => {
              return getHodlers(loggedInProfile.PublicKeyBase58Check, getLoggedInUsername())
                .then(hodlersList => {
                  const userDataDiv = getProfileUserDataDiv()
                  if (!userDataDiv) return

                  addHodlerBadgeProfile(userDataDiv, hodlersList, pageProfile.PublicKeyBase58Check)
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

const init = function () {
  chrome.storage.sync.get(['darkMode'], value => {
    if (value.darkMode === true) loadCSS('dark')
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