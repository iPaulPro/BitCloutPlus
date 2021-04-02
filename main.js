// Copyright Paul Burke 2021. All Rights Reserved.
// Github: @ipaulpro/bitcloutplus
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

let username

const getSpotPrice = function () {
  const elementList = document.getElementsByClassName('right-bar-creators__balance-box')

  try {
    const priceContainerDiv = elementList.item(0).firstElementChild
    const priceDiv = priceContainerDiv.children.item(1)
    const price = parseFloat(priceDiv.innerHTML.replace(/[^0-9\.]+/g, ''))

    return price
  } catch (e) {}

  return 0
}

const getUserName = function () {
  if (username) return username
  
  const elementList = document.getElementsByClassName('change-account-selector__ellipsis-restriction')

  try {
    const changeAccountSelector = elementList.item(0)
    username = changeAccountSelector.innerHTML.trim() 
    return username
  } catch (e) {}

  return ''
}

const addNativeCoinPrice = function () {
  const nativePriceId = 'plus-native-price'
  if (document.getElementById(nativePriceId)) return

  const topCard = document.querySelector('creator-profile-top-card')
  try {
    const userDataDiv = topCard.firstElementChild.children.item(3)
    const coinPriceDiv = userDataDiv.lastElementChild.lastElementChild
    const coinInDollars = coinPriceDiv.firstElementChild.innerHTML.trim().replace(/,/g, '')
    const price = parseFloat(coinInDollars.slice(2, coinInDollars.length))

    const spotPrice = getSpotPrice()
    const nativePrice = (price / spotPrice).toFixed(3)

    let span = document.createElement('span')
    span.id = nativePriceId
    span.className = 'fc-muted mr-2 fs-13px'
    span.style.fontWeight = '500'
    span.innerText = `(${nativePrice} BTCLT)`
    coinPriceDiv.insertBefore(span, coinPriceDiv.lastElementChild)
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

const addHolderPercentages = function (profileDetails) {
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
        const topCard = document.querySelector('creator-profile-top-card')
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

    const username = getUserName()
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

    const username = getUserName()

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

const enrichProfile = function () {
  let profileDetails = document.querySelector('creator-profile-details')
  if (!profileDetails) return

  addSellButton()

  addNativeCoinPrice()

  addHoldersCount(profileDetails)

  addHolderPercentages(profileDetails)

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

    const spotPrice = getSpotPrice()
    const valueDiv = holdingsDiv.lastElementChild
    const usdValue = parseFloat(valueDiv.firstElementChild.innerHTML.replace(/[^0-9.]+/g, ''))
    const spotValue = (usdValue / spotPrice).toFixed(4)

    const cloutPrice = document.createElement('p')
    cloutPrice.className = 'fc-muted fs-14px ml-3'
    cloutPrice.innerHTML = `${spotValue}`
    valueDiv.appendChild(cloutPrice)
  } catch (e) {}
}

const enrichBuy = function () {
  const percentageId = 'plus-trade-founder-fee-percentage'
  if (document.getElementById(percentageId)) return

  try {
    const tradeCreatorTable = document.querySelector('trade-creator-table')
    if (!tradeCreatorTable) return

    const receiveDiv = tradeCreatorTable.children.item(1).children.item(1)
    const receiveAmount = parseFloat(receiveDiv.innerHTML.replace(/[^0-9\.]+/g, ''))

    const rewardDiv = tradeCreatorTable.lastElementChild
    const rewardSpan = rewardDiv.getElementsByTagName('span').item(0)
    const rewardAmount = parseFloat(rewardSpan.innerHTML.replace(/[^0-9\.]+/g, ''))

    const founderFee = (rewardAmount / receiveAmount * 100)

    let feePercentage = document.createElement('span')
    feePercentage.id = percentageId

    if (receiveAmount === 0) {
      feePercentage.innerHTML = ` (100%)`
    } else {
      feePercentage.innerHTML = ` (${founderFee.toFixed(0)}%)`
    }

    rewardSpan.appendChild(feePercentage)
  } catch (e) {}
}

// Callback function to execute when body mutations are observed
const appRootObserverCallback = function (mutationsList, observer) {
  let profilePage = document.querySelector('app-creator-profile-page')
  if (profilePage) {
    enrichProfile()
    return
  }

  let wallet = document.querySelector('wallet')
  if (wallet) {
    enrichWallet()
    return
  }

  let tradePage = document.querySelector('trade-creator-page')
  if (tradePage) {
    enrichBuy()
  }
}

const init = function () {
  // app-root is dynamically loaded, so we observe changes to the child list
  const config = { childList: true, subtree: true }
  const appRoot = document.querySelector('app-root')
  if (appRoot) {
    const appRootObserver = new MutationObserver(appRootObserverCallback)
    appRootObserver.observe(appRoot, config)
  }
}

init()