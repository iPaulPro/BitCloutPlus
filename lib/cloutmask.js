/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

"use strict"

let isLookingUpHasPressedMaskButton

const hasPressedMaskButton = () => new Promise((resolve) => {
  isLookingUpHasPressedMaskButton = true
  chrome.storage.local.get(['hasPressedMaskButton'], items => {
    isLookingUpHasPressedMaskButton = false
    if (chrome.runtime.lastError) return resolve(false)
    resolve(items.hasPressedMaskButton)
  })
})

const setHasPressedMaskButton = () => {
  chrome.storage.local.set({hasPressedMaskButton: true})
}

const isMaskedUser = (identityUser) => {
  return identityUser && identityUser['isMaskedUser']
}

const isLoggedInAsMaskedUser = () => {
  const loggedInIdentityUser = getCurrentIdentity()
  return loggedInIdentityUser && isMaskedUser(loggedInIdentityUser)
}

const getMaskedIdentityUsers = () => {
  const identityUsers = getIdentityUsers()
  if (!identityUsers) return

  const maskedUsers = []
  for (const key in identityUsers) {
    const identityUser = identityUsers[key]
    if (identityUser.isMaskedUser) maskedUsers.push(identityUser)
  }
  return maskedUsers
}

const addPublicKeyToIdentityUsers = (key) => {
  const identityUsers = getIdentityUsers()
  if (!identityUsers || identityUsers[key]) return

  const dummyUser = getCurrentIdentity() || {}
  dummyUser.isMaskedUser = true
  identityUsers[key] = dummyUser

  window.localStorage.setItem('identityUsersV2', JSON.stringify(identityUsers))
  window.localStorage.setItem('lastLoggedInUserV2', `"${key}"`)

  window.location.reload()

  setHasPressedMaskButton()
}

function switchToUnmaskedAccount(identityUsers) {
  if (!identityUsers) return
  const firstKey = Object.keys(identityUsers)[0]
  if (firstKey) window.localStorage.setItem('lastLoggedInUserV2', `"${firstKey}"`)
}

const removePublicKeyFromIdentityUsers = (key) => {
  const identityUsers = getIdentityUsers()
  if (!identityUsers || (identityUsers[key] && !identityUsers[key]['isMaskedUser'])) return

  try {
    delete identityUsers[key]
    window.localStorage.setItem('identityUsersV2', JSON.stringify(identityUsers))
  } catch (e) {
    return
  }

  if (key === getLoggedInPublicKey()) switchToUnmaskedAccount(identityUsers)

  window.location.reload()
}

const removeAllMaskedUsers = () => {
  const identityUsers = getIdentityUsers()
  const realUsers = {}
  const loggedInAsMaskedUser = isLoggedInAsMaskedUser()

  for (const key in identityUsers) {
    const identityUser = identityUsers[key]
    if (!identityUser.isMaskedUser) realUsers[key] = identityUser
  }

  window.localStorage.setItem('identityUsersV2', JSON.stringify(realUsers))

  if (loggedInAsMaskedUser) switchToUnmaskedAccount(identityUsers)

  window.location.reload()
}

const createCloutMaskIconElement = () => {
  const iconUrl = chrome.runtime.getURL('/images/cloutmask.svg')
  const img = document.createElement('img')
  img.width = 16
  img.height = 16
  img.alt = "Mask Logo"
  img.src = iconUrl
  return img
}

const addCloutMaskButton = (page) => {
  if (isLookingUpHasPressedMaskButton || !page || page.querySelector('#__clout-mask-button')) return

  const publicKeyFromPage = getPublicKeyFromPage(page)
  if (!publicKeyFromPage) return

  const identityUsers = getIdentityUsers()
  if (!identityUsers) return

  const pageIdentityUser = identityUsers[publicKeyFromPage]
  if (pageIdentityUser && !pageIdentityUser['isMaskedUser']) return

  const topBar = page.querySelector('.creator-profile__top-bar')
  if (!topBar) return

  hasPressedMaskButton().then(hasPressed => {
    topBar.style.justifyContent = 'flex-end'
    topBar.style.alignItems = 'center'

    const maskButton = document.createElement('button')
    maskButton.id = '__clout-mask-button'
    maskButton.className = 'btn btn-sm text-muted fs-14px rounded-pill'
    maskButton.classList.add(hasPressed ? 'btn-dark' : 'btn-primary')

    const icon = createCloutMaskIconElement().outerHTML
    const userAddedByCloutMask = isMaskedUser(pageIdentityUser)
    if (userAddedByCloutMask) {
      maskButton.innerHTML = `${icon} Remove account`
      maskButton.onclick = () => removePublicKeyFromIdentityUsers(publicKeyFromPage)
      topBar.appendChild(maskButton)
    } else if (!pageIdentityUser) {
      maskButton.setAttribute('bs-toggle', 'tooltip')
      maskButton.innerHTML = icon
      maskButton.title = "Browse as this user"
      maskButton.onclick = () => addPublicKeyToIdentityUsers(publicKeyFromPage)
      topBar.appendChild(maskButton)
    }
  })
}

const disabledClassName = '__clout-mask-disabled'

const disableElement = (element) => {
  if (!element) return
  element.classList.add(disabledClassName)
  element.disabled = true
}

const reEnableElements = () => {
  const disabledElements = document.getElementsByClassName(disabledClassName)
  Array.from(disabledElements).forEach(element => {
    element.classList.remove(disabledClassName)
    element.disabled = false
  })
}

const disableFeedPostButtons = () => {
  const iconRows = document.querySelectorAll('.js-feed-post-icon-row__container')
  iconRows.forEach((row) => {
    const postButtons = Array.from(row.children)
    postButtons.splice(postButtons.length - 1, 1)
    postButtons.forEach(disableElement)
  })
}

const disableKnownLinks = () => {
  const anchors = document.querySelectorAll(
    "a[href*='/buy'], a[href*='/sell'], a[href*='/transfer'], a[href*='/select-creator-coin'], a[href*='/send-deso'], a[href*='/settings'], a[href*='/buy-deso'], a[href*='/admin'], a[href*='/nft-transfers']"
  )
  anchors.forEach(disableElement)
}

const disableClasses = () => {
  const elements = document.querySelectorAll(
    '.feed-create-post__textarea, .update-profile__image-delete, feed-post-dropdown, app-update-profile-page .btn-primary'
  )
  elements.forEach(disableElement)
}

const disablePostButtons = () => {
  const createPostElement = document.querySelector('feed-create-post')
  if (createPostElement) {
    const postButton = createPostElement.querySelector('.btn-primary')
    disableElement(postButton)
  }
}

const disableFollowButtons = (mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      const node = mutation.target
      if ((node.innerText === 'Unfollow' || node.innerText === 'Follow')) {
        disableElement(node)
      }
    }
  }
}

const addMaskToAccountSelector = () => {
  const accountSelectorMaskIconId = '__clout-mask-account-selector-icon'
  if (document.getElementById(accountSelectorMaskIconId)) return

  const accountName = document.querySelector('.change-account-selector__ellipsis-restriction')
  if (!accountName) return

  const icon = createCloutMaskIconElement()
  icon.id = accountSelectorMaskIconId
  icon.classList.add('mr-2')

  accountName.innerHTML = `${icon.outerHTML} ${accountName.innerText}`
}

const addClearAllToAccountSelector = () => {
  const id = '__clout-mask-clear-all-item'
  if (document.getElementById(id)) return

  const accountsList = document.querySelector('.change-account-selector_list')
  if (!accountsList || accountsList.classList.contains('change-account-selector__hover')) return

  const div = document.createElement('div')
  div.id = id
  div.innerHTML = `<div class="pl-15px text-link_hover pr-10px pt-10px"> Clear Masked Accts </div>`
  div.onclick = removeAllMaskedUsers

  accountsList.appendChild(div)
}

const cloutMaskAppRootObserverCallback = (mutationsList) => {
  if (isLoggedInAsMaskedUser()) {
    disableFollowButtons(mutationsList)
    disableFeedPostButtons()
    disableKnownLinks()
    disableClasses()
    disablePostButtons()
  } else {
    reEnableElements()
  }

  if (getMaskedIdentityUsers().length > 0) {
    addClearAllToAccountSelector()
  }

  const profilePage = document.querySelector('creator-profile-page')
  if (profilePage) {
    addCloutMaskButton(profilePage)
  }
}

const cloutMaskBodyObserverCallback = () => {
  if (isLoggedInAsMaskedUser()) {
    addMaskToAccountSelector()
  }
}

const initCloutMask = () => {
  const appRoot = document.querySelector('app-root')
  if (appRoot) {
    const appRootObserverConfig = {childList: true, subtree: true}
    const appRootObserver = new MutationObserver(cloutMaskAppRootObserverCallback)
    appRootObserver.observe(appRoot, appRootObserverConfig)
  }

  const body = document.querySelector('body')
  if (body) {
    const bodyObserverConfig = { childList: true, subtree: false }
    const bodyObserver = new MutationObserver(cloutMaskBodyObserverCallback)
    bodyObserver.observe(body, bodyObserverConfig)
  }
}

initCloutMask()
