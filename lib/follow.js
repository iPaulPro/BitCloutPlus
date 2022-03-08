let blockJwtMsgId
let pendingBlockUser = {}

const isBlockedUsersUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  const params = (new URL(document.location)).searchParams
  return segments[1] === 'u' && segments[segments.length - 1] === 'following' && params.get('tab') === 'blocked'
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

const observeFollowLists = (page) => {
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

const addBlockedUsersTabToFollows = (page) => {
  const loggedInPublicKey = getLoggedInPublicKey()
  if (!loggedInPublicKey) return

  const blockedUsersTabClass = 'plus-blocked-users-tab'
  if (document.getElementsByClassName(blockedUsersTabClass).length >= 2) return

  const tabSelectors = page.querySelectorAll('tab-selector')
  tabSelectors.forEach(tabSelector => {
    const tabsInner = tabSelector?.firstElementChild
    if (!tabsInner) return

    const username = getUsernameFromUrl()

    // Restore the click handling for the Following tab
    tabsInner.children.item(1).onclick = () => window.location.href = `/u/${username}/following`

    const tabText = document.createElement('div')
    tabText.className = 'd-flex h-100 align-items-center fs-15px fc-muted'
    tabText.innerText = 'Blocked'

    const tabUnderlineActive = document.createElement('div')
    tabUnderlineActive.className = 'tab-underline-inactive'
    tabUnderlineActive.style.width = '50px'

    const blockedUsersTab = document.createElement('div')
    blockedUsersTab.className = blockedUsersTabClass + ' d-flex flex-column align-items-center h-100 pl-15px pr-15px'
    blockedUsersTab.appendChild(tabText)
    blockedUsersTab.appendChild(tabUnderlineActive)

    blockedUsersTab.onclick = () => window.location.href = `/u/${username}/following?tab=blocked`

    tabsInner.appendChild(blockedUsersTab)
  })
}

const createListFromBlockedUsers = (publicKey, users, blockList) => {
  const loggedInPublicKey = getLoggedInPublicKey()
  const isLoggedInUser = loggedInPublicKey === publicKey

  const profiles = users.map(user => user['ProfileEntryResponse'])
  profiles.sort((a, b) => a['Username'].localeCompare(b['Username'])).forEach(profile => {
    const container = document.createElement('div')

    blockList.appendChild(container)

    const row = document.createElement('div')
    row.className = 'row no-gutters px-15px border-bottom fs-15px h-100'

    container.appendChild(row)

    const blockPublicKey = profile['PublicKeyBase58Check']
    const username = profile['Username']

    const href = `/u/${username}?tab=posts`

    const outerAnchor = document.createElement('div')
    outerAnchor.className = 'fs-15px d-flex justify-content-left w-100 border-color-grey p-15px'

    row.appendChild(outerAnchor)

    const avatarContainer = document.createElement('div')
    avatarContainer.className = 'manage-follows__avatar-container'

    outerAnchor.appendChild(avatarContainer)

    const avatar = document.createElement('a')
    avatar.className = 'manage-follows__avatar br-12px'
    avatar.style.backgroundImage = `url("${getProfilePhotoUrlForPublicKey(blockPublicKey)}")`
    avatar.href = href

    avatarContainer.appendChild(avatar)

    const textContainer = document.createElement('div')
    textContainer.className = 'w-100 d-flex'

    outerAnchor.appendChild(textContainer)

    const textInner = document.createElement('div')
    textInner.className = 'w-100 d-flex align-items-center'

    textContainer.appendChild(textInner)

    const textAnchor = document.createElement('a')
    textAnchor.className = 'fc-default font-weight-bold flex-grow-1 py-2'
    textAnchor.innerText = ' ' + username
    textAnchor.href = href

    textInner.appendChild(textAnchor)

    if (isLoggedInUser) {
      const buttonContainer = document.createElement('div')
      buttonContainer.className = 'ml-auto'

      textInner.appendChild(buttonContainer)

      const button = document.createElement('button')
      button.className = 'btn btn-sm btn-danger'
      button.innerText = 'Unblock'
      button.onclick = () => {
        button.classList.remove('btn-danger')
        button.classList.add('btn-outline-secondary')
        button.disabled = true
        pendingBlockUser = {
          PublicKeyBase58Check: publicKey,
          BlockPublicKeyBase58Check: blockPublicKey,
          Unblock: true
        }
        blockJwtMsgId = uuid()
        console.log(`getting jwt with id = ${blockJwtMsgId}, user = ${JSON.stringify(pendingBlockUser)}`)
        getJwt(blockJwtMsgId)
      }

      buttonContainer.appendChild(button)
    }
  })
}

const addBlockedUsersList = (page) => {
  const blockListId = 'plus-blocked-users-list'
  if (document.getElementById(blockListId)) return

  const activeTabs = document.querySelectorAll('.tab-underline-active')
  activeTabs.forEach(activeTab => {
    activeTab.className = 'tab-underline-inactive'
  })

  const tabs = document.querySelectorAll('.plus-blocked-users-tab > .tab-underline-inactive')
  tabs.forEach(tab => {
    tab.className = 'tab-underline-active'
  })

  const listDiv = page.querySelector('[ui-scroll]')
  if (!listDiv) return

  const listParent = listDiv.parentElement
  listDiv.remove()

  const footer = page.querySelector('.global__bottom-bar-mobile-height')

  const blockList = document.createElement('div')
  blockList.id = blockListId
  listParent.insertBefore(blockList, footer)

  const username = getUsernameFromUrl()
  getProfileByUsername(username)
    .then(profile => {
      const publicKey = profile['PublicKeyBase58Check']
      return getUserMetadata(publicKey)
        .then(userMetadata => {
          const blockedPubKeys = userMetadata['BlockedPubKeys']
          if (blockedPubKeys && !isEmpty(blockedPubKeys)) {
            return getUsers(Object.keys(blockedPubKeys))
          }
          return new Error(`No blocked users found`)
        })
        .then(users => createListFromBlockedUsers(publicKey, users, blockList))
    })
    .catch(console.error)
}

const blockUser = (jwt) => {
  if (!pendingBlockUser) return

  blockPublicKey(pendingBlockUser, jwt).catch(console.error)

  blockJwtMsgId = null
  pendingBlockUser = {}
}