// Copyright Paul Burke 2021. All Rights Reserved.
// Github: @ipaulpro/bitcloutplus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

const nanosInBitClout = 1000000000

let username, timer, loggedInProfile

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

const getLoggedInUserName = function () {
  if (username && username !== '') return username

  const elementList = document.getElementsByClassName('change-account-selector__ellipsis-restriction')

  try {
    const changeAccountSelector = elementList.item(0)
    username = changeAccountSelector.innerHTML.trim()
    return username
  } catch (e) {}

  return ''
}

function loadCSS(file) {
  const link = document.createElement("link");
  link.href = chrome.runtime.getURL(file + '.css');
  link.id = file;
  link.type = "text/css";
  link.rel = "stylesheet";
  document.getElementsByTagName("head")[0].appendChild(link);
}

function unloadCSS(file) {
  const cssNode = document.getElementById(file);
  cssNode && cssNode.parentNode.removeChild(cssNode);
}

const reqHeaders = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'sec-gpc': '1'
}

const getProfile = function (username) {
  return fetch('https://api.bitclout.com/get-profiles', {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      PublicKeyBase58Check: '',
      Username: username,
      UsernamePrefix: '',
      Description: '',
      OrderBy: 'newest_last_post',
      NumToFetch: 1,
      ModerationType: '',
      FetchUsersThatHODL: true,
      AddGlobalFeedBool: false
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'include'
  }).then(res => res.json())
    .then(res => res.ProfilesFound[0])
    .catch(e => {})
}

const getFollowing = function (username) {
  return fetch('https://api.bitclout.com/get-follows-stateless', {
    'headers': reqHeaders,
    'referrerPolicy': 'no-referrer',
    'body': JSON.stringify({
      PublicKeyBase58Check: '',
      username: username,
      getEntriesFollowingPublicKey: false,
      NumToFetch: 5000
    }),
    'method': 'POST',
    'mode': 'cors',
    'credentials': 'include'
  }).then(res => res.json())
    .catch(e => {})
}

const addNativeCoinPrice = function (topCard, profile) {
  const nativePriceId = 'plus-profile-native-price'
  if (document.getElementById(nativePriceId)) return

  try {
    const userDataDiv = topCard.firstElementChild.children.item(3)
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

const addFounderReward = function (topCard, profile) {
  const founderRewardId = 'plus-profile-founder-reward'
  if (document.getElementById(founderRewardId)) return

  try {
    const userDataDiv = topCard.firstElementChild.children.item(3)
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

const addHoldersCount = function (profileDetails) {
  if (!profileDetails) return

  let holderCountId = 'plus-profile-holder-count'
  if (document.getElementById(holderCountId)) return

  try {
    let tabContent = profileDetails.firstElementChild.lastElementChild

    let holderDiv = tabContent.firstElementChild.firstElementChild
    if (!holderDiv.innerHTML.startsWith('Holders')) return

    let holders = document.getElementsByClassName('creator-profile-details__hodler-avatar')

    let span = document.createElement('span')
    span.id = holderCountId
    span.className = 'fc-muted fs-16px'
    span.innerText = `(${holders.length})`
    holderDiv.appendChild(span)
  } catch (e) {}
}

const addHolderPercentages = function (profileDetails, topCard) {
  if (!profileDetails) return

  const holderPercentageClassName = 'plus-profile-holder-share'
  if (document.getElementsByClassName(holderPercentageClassName).length !== 0) return

  try {
    const holderDiv = profileDetails.firstElementChild.lastElementChild
    const holderContainer = holderDiv.children.item(1)
    const holderList = holderContainer.firstElementChild

    const size = holderList.children.length - 1 // skip total row (last item)
    for (let i = 0; i < size; i++) {
      let listItem = holderList.children.item(i)
      let heldColumnItem = listItem.children.item(1)
      const coinsHeld = parseFloat(heldColumnItem.innerHTML)

      if (!isNaN(coinsHeld)) {
        const valueBar = topCard.firstElementChild.lastElementChild
        const circulationContainer = valueBar.firstElementChild
        const circulationHtml = circulationContainer.firstElementChild.innerHTML.trim()
        const circulation = parseFloat(circulationHtml.slice(2, circulationHtml.length))

        let span = document.createElement('span')
        span.className = `${holderPercentageClassName} fc-muted fs-12px ml-1`
        span.innerHTML = '(' + ((coinsHeld / circulation) * 100).toFixed(1) + '%)'
        heldColumnItem.appendChild(span)
      }
    }
  } catch (e) {}
}

const addHolderRankings = function (profileDetails) {
  if (!profileDetails) return

  const holderPositionClassName = 'plus-profile-holder-position'
  if (document.getElementsByClassName(holderPositionClassName).length !== 0) return

  try {
    const holderDiv = profileDetails.firstElementChild.lastElementChild
    const holderContainer = holderDiv.children.item(1)
    const holderList = holderContainer.firstElementChild

    const username = getUserNameFromUrl()
    let startingIndex = 2

    const firstHolderItem = holderList.children.item(1)
    if (firstHolderItem) {
      const nameElement = firstHolderItem.firstElementChild.lastElementChild
      const holderName = nameElement.innerHTML.replace(/\s*<.*?>\s*/g, '').trim()

      if (username !== holderName) {
        startingIndex = 1
      }
    }

    // Skip the first two and last item
    for (let i = startingIndex; i < (holderList.childElementCount - 1); i++) {
      let listItem = holderList.children.item(i)

      let span = document.createElement('span')
      span.className = `${holderPositionClassName} fc-muted fs-14px mr-3`
      span.innerHTML = `${i - startingIndex + 1}`

      const avatarAndName = listItem.firstElementChild
      avatarAndName.insertBefore(span, avatarAndName.firstElementChild)
    }
  } catch (e) {}
}

const highlightUserInHolderList = function (profileDetails) {
  if (!profileDetails) return

  const highlightClassName = 'plus-profile-user-highlight'
  if (document.getElementsByClassName(highlightClassName).length > 0) return

  try {
    const holderDiv = profileDetails.firstElementChild.lastElementChild
    const holderContainer = holderDiv.children.item(1)
    const holderList = holderContainer.firstElementChild

    const username = getLoggedInUserName()

    // Skip the first two and last item
    for (let i = 2; i < (holderList.childElementCount - 1); i++) {
      let listItem = holderList.children.item(i)

      const nameElement = listItem.firstElementChild.lastElementChild
      const holderName = nameElement.innerHTML.replace(/\s*<.*?>\s*/g, '').trim()

      if (username === holderName) {
        listItem.className = listItem.className + ` ${highlightClassName}`
        listItem.style.backgroundColor = '#FFFACD'
      }
    }

    // Avoid going through the list again if none were found the first time
    let listItem = holderList.children.item(0)
    listItem.className = listItem.className + ` ${highlightClassName}`
  } catch (e) {}
}

const getUserNameFromUrl = function () {
  const segments = new URL(document.location).pathname.split('/')
  return segments.pop() || segments.pop()
}

const addProfileEnrichmentsFromUser = function (topCard) {
  if (!topCard) return

  const username = getUserNameFromUrl()
  getProfile(username)
    .then(profile => {
      addNativeCoinPrice(topCard, profile)
      addFounderReward(topCard, profile)
    }).catch(e => {})
}

const getLoggedInProfile = function () {
  let promise
  if (loggedInProfile) {
    promise = Promise.resolve(loggedInProfile)
  } else {
    const loggedInUserName = getLoggedInUserName()
    promise = getProfile(loggedInUserName)
  }
  return promise
}

const addProfileEnrichmentsFromLoggedInUser = function (topCard) {
  if (!topCard) return

  if (document.getElementById(followingCountId)) return

  getLoggedInProfile()
    .then(loggedInProfile => {
      console.log(`loggedInProfile = ${JSON.stringify(loggedInProfile)}`);
      if (document.getElementById(followingCountId)) return Promise.reject('Already ran')

      const profileUsername = getUserNameFromUrl()

      return getFollowing(profileUsername).then(followingRes => {
        if (document.getElementById(followingCountId)) return Promise.reject('Already ran')

        const userDataDiv = topCard.firstElementChild.children.item(3)

        const usernameDiv = userDataDiv.firstElementChild
        const followingList = followingRes.PublicKeyToProfileEntry
        const loggedInKey = loggedInProfile.PublicKeyBase58Check

        let followsYou = followingList[loggedInKey] !== undefined
        if (followsYou) {
          const followsYouSpan = document.createElement('span')
          followsYouSpan.className = 'plus-profile-label ml-3 fs-12px font-weight-normal text-grey5 br-12px'
          followsYouSpan.innerText = 'Follows you'

          usernameDiv.appendChild(followsYouSpan)
        }

        const userDataFooter = userDataDiv.lastElementChild
        userDataFooter.className = userDataFooter.className + ' mb-1 mt-3'

        const countSpan = document.createElement('span')
        countSpan.className = 'font-weight-bold'
        countSpan.innerText = `${followingRes.NumFollowers}`

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
            if (coinPriceLabelDiv.innerHTML.startsWith('Coin Price')) {
              userDataFooter.insertBefore(a, child)
              break
            }
          }
        }

        const hodlerLabelId = 'plus-profile-hodler-label'
        if (document.getElementById(hodlerLabelId)) return

        return getProfile(profileUsername)
          .then(profile => {
            if (document.getElementById(hodlerLabelId)) return

            const key = profile.PublicKeyBase58Check

            let hodler = loggedInProfile.UsersThatHODL.find(user => user.HODLerPublicKeyBase58Check === key)
            if (hodler) {
              const isHodlerSpan = document.createElement('span')
              isHodlerSpan.className = 'plus-profile-label ml-2 fs-12px font-weight-normal text-grey5 br-12px'
              isHodlerSpan.title = 'Coin holder'
              isHodlerSpan.setAttribute('bs-toggle', 'tooltip')
              isHodlerSpan.innerHTML = '<i class="fas fa-coins" aria-hidden="true"></i>'

              usernameDiv.appendChild(isHodlerSpan)
            }
          })
          .catch(e => {})
      })
    })
    .catch(e => {})
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
    button.onclick = ev => window.location.href = 'posts/new'

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
    input.onclick = ev => toggleDarkMode(input.checked)

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

    const username = getUserNameFromUrl()
    a.onclick = ev => window.location.href = `send-bitclout?username=${username}`

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

    const username = getUserNameFromUrl()
    a.onclick = ev => window.location.href = `inbox/${username}`

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

  const topCard = document.querySelector('creator-profile-top-card')
  addProfileEnrichmentsFromUser(topCard)
  addProfileEnrichmentsFromLoggedInUser(topCard)
  addHoldersCount(profileDetails)
  addHolderPercentages(profileDetails, topCard)
  highlightUserInHolderList(profileDetails)
  addHolderRankings(profileDetails)
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
      if (exchangingAmount === 0) return Promise.reject()

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
    .catch(e => {})
}

const enrichTransfer = function () {
  const transferElement = document.querySelector('transfer-bitclout')
  const recipientDiv = transferElement.children.item(2)
  const usernameInput = recipientDiv.lastElementChild

  if (usernameInput.value && usernameInput.value.length > 0) return

  const params = new URLSearchParams(window.location.search)
  const username = params.get('username')
  usernameInput.value = username
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

// Callback function to execute when body mutations are observed
const appRootObserverCallback = function (mutationsList, observer) {
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
    return
  }

  const transferPage = document.querySelector('transfer-bitclout-page')
  if (transferPage) {
    enrichTransfer()
  }
}

const updateLoggedInProfile = function () {
  const username = getLoggedInUserName()
  if (username) {
    getProfile(username)
      .then(profile => {
        loggedInProfile = profile
        enrichBalanceBox(profile)
      })
      .catch(e => {})
  }
}

const globalContainerObserverCallback = function (mutationsList, observer) {
  updateLoggedInProfile()
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

  const globalContainer = document.getElementsByClassName('global__container').item(0)
  if (globalContainer) {
    const globalObserverConfig = { childList: true, subtree: false }
    const globalObserver = new MutationObserver(globalContainerObserverCallback)
    globalObserver.observe(globalContainer, globalObserverConfig)
  }

  if (timer) clearInterval(timer)
  timer = setInterval(updateLoggedInProfile, 60 * 1000)
}

init()