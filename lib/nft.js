/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const DESO_PUBLIC_KEY_PREFIX = 'BC1YL'

let isRequestingNftEntries = false,
  transferNftUnlockableText = null,
  transferNftPostEntry = null,
  transferNftOwnedEntries = []

const isBurnNftUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft' && segments[segments.length - 1] === 'burn'
}

const isNftTransfersUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft-transfers'

}

const isTransferNftUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft' && segments[segments.length - 1] === 'transfer'
}

const getNftPostPageFooter = (nftPostPage) => {
  const nftPost = nftPostPage.querySelector('nft-post')

  const feedPostElement = nftPost.querySelector('feed-post')
  if (!feedPostElement) return

  return feedPostElement.firstElementChild.lastElementChild
}

const enrichNftPostPage = (nftPostPage) => {
  if (!nftPostPage || isRequestingNftEntries) return

  const burnNftButtonId = 'plus-btn-burn-nft'
  if (document.getElementById(burnNftButtonId)) return

  const publicKey = getLoggedInPublicKey()
  const postHashHex = getPostHashHexFromUrl()
  if (!publicKey || !postHashHex) return

  const footerElement = getNftPostPageFooter(nftPostPage)
  if (!footerElement) return

  isRequestingNftEntries = true

  addNftExtraDataToNftPage(nftPostPage)

  getNftEntriesForPostHashHex(publicKey, postHashHex)
    .then(nftEntries => {
      const ownedEntries = nftEntries.filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      if (ownedEntries.length === 0 || !isRequestingNftEntries) return

      const container = footerElement.firstElementChild
      container.firstElementChild.classList.add('flex-grow-1')

      const transferButton = createTransferNftButton(postHashHex)
      container.appendChild(transferButton)

      const url = window.location.href.split('?')[0]
      const burnButton = createDangerButton('Burn NFT')
      burnButton.id = burnNftButtonId
      burnButton.onclick = () => window.location.href = `${url}/burn`

      const ownedEntriesForSale = ownedEntries.filter(entry => entry['IsForSale'] === true)
      if (ownedEntriesForSale.length === ownedEntries.length) {
        burnButton.disabled = true
        burnButton.title = 'You cannot burn an NFT that is for sale'
        transferButton.disabled = true
        transferButton.title = 'You cannot transfer an NFT that is for sale'
      }

      container.appendChild(burnButton)
    })
    .finally(() => {
      isRequestingNftEntries = false
    })
}

const signTransaction = (res) => {
  const transactionHex = res['TransactionHex']
  if (!transactionHex) {
    return Promise.reject('Error creating transaction')
  }

  const identity = getCurrentIdentity()
  if (!identity) {
    return Promise.reject('No Identity found')
  }

  const id = _.UUID.v4()
  sendSignTransactionMsg(identity, transactionHex, id)
}

const onBurnNftClick = (publicKey, postHashHex, serialNumber) =>
  burnNft(publicKey, postHashHex, serialNumber)
    .then(signTransaction)
    .catch(console.error)

const onSerialNumberSelected = () => {
  const serialNumber = getSerialNumber()

  transferNftUnlockableText = null

  const nftEntry = transferNftOwnedEntries.find(entry => entry['SerialNumber'] === serialNumber)
  if (!nftEntry) return

  const encryptedUnlockableText = nftEntry['EncryptedUnlockableText']
  const lastOwnerPublicKey = nftEntry['LastOwnerPublicKeyBase58Check']

  if (encryptedUnlockableText) {
    sendDecryptMsg(encryptedUnlockableText, lastOwnerPublicKey)
  }

  const hasUnlockable = transferNftPostEntry['HasUnlockable']
  if (hasUnlockable) {
    const unlockableTextDiv = document.getElementById('plus-nft-transfer-unlockable-text')
    unlockableTextDiv.style.display = 'inherit'
    unlockableTextDiv.onclick = () => showUnlockableTextDialog().then((res) => {
      if (res.isConfirmed) {
        transferNftUnlockableText = res.value
      }
    })
  }
}

const createSerialNumberSelector = () => {
  if (transferNftOwnedEntries.length === 0) {
    throw new Error('User doesn\'t own any entries for this NFT.')
  }

  const serialNumberSelector = document.createElement('select')
  serialNumberSelector.id = 'plus_nft-serial-number-selector'
  serialNumberSelector.className = 'form-control w-auto'
  serialNumberSelector.addEventListener('change', onSerialNumberSelected)

  const options = []
  transferNftOwnedEntries.forEach(entry => {
    const option = document.createElement('option')
    option.value = entry['SerialNumber']
    option.innerText = `Serial #${entry['SerialNumber']}`
    options.push(option)
  })
  options.forEach(option => serialNumberSelector.appendChild(option))

  const unlockableTextIcon = document.createElement('i')
  unlockableTextIcon.className = 'fas fa-unlock-alt'

  const unlockableTextSpan = document.createElement('span')
  unlockableTextSpan.innerText = 'Unlockable text'
  unlockableTextSpan.className = 'ml-2'

  const encryptedUnlockableTextDiv = document.createElement('div')
  encryptedUnlockableTextDiv.id = 'plus-nft-transfer-unlockable-text'
  encryptedUnlockableTextDiv.className = 'ml-3 cursor-pointer align-items-center'
  encryptedUnlockableTextDiv.style.display = 'none'
  encryptedUnlockableTextDiv.appendChild(unlockableTextIcon)
  encryptedUnlockableTextDiv.appendChild(unlockableTextSpan)

  const container = document.createElement('div')
  container.className = 'flex-grow-1 d-flex align-items-center'
  container.appendChild(serialNumberSelector)
  container.appendChild(encryptedUnlockableTextDiv)

  return container
}

const createNftPostElement = (postEntry, notFoundElement, username, buttonElements, serialNumberElement, singleEntryDisplayed = false) => {
  const postDiv = document.createElement('div')
  postDiv.id = `plus-nft-post-${postEntry['PostHashHex']}`
  postDiv.className = 'feed-post__container js-feed-post-hover border d-flex justify-content-left w-100 px-15px pb-15px pt-15px feed-post__parent-post-font-size cursor-pointer'
  postDiv.onclick = () => window.location.href = `/nft/${postEntry['PostHashHex']}`
  if (singleEntryDisplayed) postDiv.classList.add('feed-post__blue-border')

  const avatarAnchor = document.createElement('a')
  avatarAnchor.className = 'feed-post__avatar br-12px'
  avatarAnchor.style.backgroundImage = `url("${getProfilePhotoUrlForPublicKey(postEntry['PosterPublicKeyBase58Check'])}")`

  const avatarContainer = document.createElement('div')
  avatarContainer.className = 'feed-post__avatar-container'
  avatarContainer.appendChild(avatarAnchor)
  postDiv.appendChild(avatarContainer)

  const contentInnerDiv = document.createElement('div')
  contentInnerDiv.className = 'roboto-regular mt-1'
  contentInnerDiv.style.overflowWrap = 'anywhere'
  contentInnerDiv.style.wordBreak = 'break-word'
  contentInnerDiv.style.outline = 'none'
  contentInnerDiv.innerText = postEntry['Body']

  const imageUrls = postEntry['ImageURLs']
  if (imageUrls && imageUrls.length > 0) {
    const contentImage = document.createElement('img')
    contentImage.className = 'feed-post__image'
    contentImage.src = imageUrls[0]

    const contentImageDiv = document.createElement('div')
    contentImageDiv.className = 'feed-post__image-container'
    contentImageDiv.appendChild(contentImage)
    contentInnerDiv.appendChild(contentImageDiv)
  }

  const usernameDiv = document.createElement('div')
  usernameDiv.className = 'fc-default font-weight-bold'
  usernameDiv.innerText = username

  const contentOuterDiv = document.createElement('div')
  contentOuterDiv.className = 'w-100'
  contentOuterDiv.appendChild(usernameDiv)
  contentOuterDiv.appendChild(contentInnerDiv)
  postDiv.appendChild(contentOuterDiv)

  const postFooterContentDiv = document.createElement('div')
  postFooterContentDiv.className = 'd-flex justify-content-between align-items-center'
  postFooterContentDiv.appendChild(serialNumberElement)

  if (buttonElements) {
    buttonElements.forEach(button => {
      postFooterContentDiv.appendChild(button)
    })
  }

  const postFooterDiv = document.createElement('div')
  postFooterDiv.className = 'p-15px fs-15px w-100 background-color-grey'
  if (singleEntryDisplayed) postFooterDiv.classList.add('feed-post__blue-border')
  postFooterDiv.appendChild(postFooterContentDiv)
  notFoundElement.appendChild(postDiv)
  notFoundElement.appendChild(postFooterDiv)

  const padding = document.createElement('div')
  padding.className = 'w-100'
  padding.classList.add(singleEntryDisplayed ? 'p-35px' : 'p-1')

  const postContainerDiv = document.createElement('div')
  postContainerDiv.className = 'feed-post__container w-100 px-15px'
  if (!singleEntryDisplayed) postContainerDiv.classList.add('pt-15px')
  postContainerDiv.appendChild(postDiv)
  postContainerDiv.appendChild(postFooterDiv)
  postContainerDiv.appendChild(padding)

  notFoundElement.appendChild(postContainerDiv)
}

const setCustomPageTopBarTitle = (title) => {
  const topBar = document.querySelector(`top-bar-mobile-navigation-control`)
  if (!topBar) return

  const titleElement = topBar.parentElement
  titleElement.innerText = title
}

const getCustomPageNotFoundElement = () => {
  const notFoundElement = document.querySelector(`not-found`)
  const notFoundContentContainer = document.querySelector(`.not-found__content-container`)
  notFoundElement.removeChild(notFoundContentContainer)
  return notFoundElement
}

function showSpinner(button) {
  const spinnerAlt = document.createElement('span')
  spinnerAlt.className = 'sr-only'
  spinnerAlt.innerText = 'Working...'

  const spinner = document.createElement('div')
  spinner.className = 'spinner-border spinner-border-sm text-light'
  spinner.dataset.role = 'status'
  spinner.appendChild(spinnerAlt)

  button.disabled = true
  button.innerText = ''
  button.appendChild(spinner)
}

const getSerialNumber = () => {
  const serialNumberSelector = document.getElementById('plus_nft-serial-number-selector')
  if (!serialNumberSelector) return undefined

  return Number(serialNumberSelector.value)
}

function createDangerButton(text) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-danger font-weight-bold br-8px fs-13px'
  button.innerText = text
  return button
}

const createBurnButton = (publicKey, postHashHex, text) => {
  const button = createDangerButton(text)
  button.onclick = () => {
    showSpinner(button)

    const restoreButton = (button) => {
      button.innerText = 'Burn NFT'
      button.disabled = false
    }

    Swal.fire({
      title: 'Burn NFT?',
      icon: 'warning',
      text: 'Are you sure you want to burn this NFT? This cannot be undone.',
      confirmButtonText: 'Burn',
      showCancelButton: true,
      reverseButtons: true,
      customClass: {
        confirmButton: 'btn btn-light',
        cancelButton: 'btn btn-light no'
      }
    }).then((res) => {
      if (res.isConfirmed) {
        const serialNumber = getSerialNumber()
        onBurnNftClick(publicKey, postHashHex, serialNumber)
          .catch(err => {
            console.error(err)
            restoreButton(button)
          })
      } else {
        restoreButton(button)
      }
    })

  }
  return button
}

const createTransferNftButton = (postHashHex) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-info font-weight-bold br-8px fs-13px mx-3'
  button.innerText = 'Transfer NFT'
  button.onclick = () => window.location.href = `/nft/${postHashHex}/transfer`
  return button
}

function createCustomPageHeaderElement(text) {
  const headerElement = document.createElement('div')
  headerElement.className = 'd-flex align-items-center fs-15px fc-muted p-15px background-color-light-grey'
  headerElement.innerText = text
  return headerElement
}

function addPostToBody(post, confirmTextElement, notFoundElement, buttons, singleEntryDisplayed) {
  getProfileByPublicKey(post['PosterPublicKeyBase58Check'])
    .then(profile => {
      const username = profile['Username']
      try {
        const serialNumberSelector = createSerialNumberSelector()
        createNftPostElement(post, notFoundElement, username, buttons, serialNumberSelector, singleEntryDisplayed)
        onSerialNumberSelected()
      } catch (e) {
        confirmTextElement.innerText = 'You don\'t own this NFT'
      }
    })
}

const createBurnNftPage = () => {
  setCustomPageTopBarTitle('Burn NFT')

  const notFoundElement = getCustomPageNotFoundElement()
  const headerElement = createCustomPageHeaderElement(
    'Burning an NFT is an irreversible action that revokes your ownership and "un-mints" the serial number.'
  )
  notFoundElement.appendChild(headerElement)

  const confirmTextElement = document.createElement('div')
  confirmTextElement.className = 'fs-15px font-weight-bold mt-15px px-15px text-danger pb-3 border-bottom border-color-grey'
  confirmTextElement.innerText = 'Are you sure you want to burn this NFT?'
  notFoundElement.appendChild(confirmTextElement)

  const postHashHex = getPostHashHexFromUrl()
  const publicKey = getLoggedInPublicKey()
  if (!publicKey || !postHashHex) return

  const button = createBurnButton(publicKey, postHashHex, 'Burn NFT')

  getBidsForNftPost(publicKey, postHashHex)
    .then(res => {
      transferNftPostEntry = res['PostEntryResponse']
      transferNftOwnedEntries = res['NFTEntryResponses'].filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      addPostToBody(transferNftPostEntry, confirmTextElement, notFoundElement, [button])
    })
}

const search = (text, cb) => {
  if (text.startsWith(DESO_PUBLIC_KEY_PREFIX)) {
    return getProfileByPublicKey(text).then(profile => {
      const profiles = [profile]
      return cb(profiles)
    })
  } else {
    return searchUsernames(text, profiles => {
      return cb(profiles)
    })
  }
}

const getLookupKey = (item, text) => {
  if (text.startsWith(DESO_PUBLIC_KEY_PREFIX)) {
    return item['PublicKeyBase58Check']
  } else {
    return item['Username']
  }
}

const addAutocomplete = (input, containerElement) => {
  const tribute = new Tribute({
    autocompleteMode: true,
    replaceTextSuffix: '',
    values: (text, cb) => search(text, cb),
    menuItemTemplate: (item) => buildTributeUsernameMenuTemplate(item),
    loadingItemTemplate: buildLoadingItemTemplate(),
    fillAttr: 'Username',
    lookup: (item, text) => getLookupKey(item, text)
  })
  tribute.attach(input)
}

const createNftTransfersSearchArea = () => {
  const searchBarIcon = document.createElement('i')
  searchBarIcon.className = 'icon-search'

  const searchBarIconSpan = document.createElement('span')
  searchBarIconSpan.className = 'input-group-text search-bar__icon'
  searchBarIconSpan.style.borderTopLeftRadius = '0.25rem'
  searchBarIconSpan.style.borderBottomLeftRadius = '0.25rem'
  searchBarIconSpan.appendChild(searchBarIcon)

  const input = document.createElement('input')
  input.id = 'plus-nft-recipient-input'
  input.type = 'text'
  input.placeholder = 'Search'
  input.className = 'form-control shadow-none search-bar__fix-active'
  input.style.fontSize = '15px'
  input.style.paddingLeft = '0'
  input.style.borderLeftColor = 'rgba(0, 0, 0, 0)'

  const inputGroupPrepend = document.createElement('div')
  inputGroupPrepend.className = 'input-group-prepend w-100'
  inputGroupPrepend.appendChild(searchBarIconSpan)
  inputGroupPrepend.appendChild(input)

  const inputGroup = document.createElement('div')
  inputGroup.className = 'input-group'
  inputGroup.appendChild(inputGroupPrepend)

  const innerDiv = document.createElement('div')
  innerDiv.className = 'd-flex align-items-center w-100 text-grey8A fs-15px global__top-bar__height'
  innerDiv.appendChild(inputGroup)

  const searchBar = document.createElement('div')
  searchBar.className = 'w-100 global__top-bar__height'
  searchBar.appendChild(innerDiv)

  const userSelectDiv = document.createElement('div')
  userSelectDiv.className = 'fs-15px font-weight-bold mt-4 px-15px'
  userSelectDiv.innerText = 'Recipient public key or username'
  userSelectDiv.appendChild(searchBar)

  addAutocomplete(input, userSelectDiv)

  return userSelectDiv
}

const showConfirmTransferDialog = (text) => {
  return Swal.fire({
    title: 'Transfer NFT?',
    icon: 'warning',
    text: `Are you sure you want to transfer this NFT to ${text}? This cannot be undone.`,
    confirmButtonText: 'Transfer',
    showCancelButton: true,
    reverseButtons: true,
    customClass: {
      confirmButton: 'btn btn-light',
      cancelButton: 'btn btn-light no'
    }
  })
}

const showUnlockableTextDialog = () => {
  const burnNftUrl = isBurnNftUrl()
  let config = {
    title: 'Unlockable content',
    showConfirmButton: !burnNftUrl,
    customClass: {
      confirmButton: 'btn btn-light',
      cancelButton: 'btn btn-light no'
    }
  }

  if (burnNftUrl) {
    config = {
      ...config,
      text: transferNftUnlockableText
    }
  } else {
    config = {
      ...config,
      input: 'textarea',
      inputLabel: 'Add or edit the unlockable content.',
      inputPlaceholder: 'Enter URL, code to redeem, link, etc...',
      inputValue: transferNftUnlockableText,
      confirmButtonText: 'Set',
      showCancelButton: true,
      reverseButtons: true,
      focusConfirm: false,
      inputValidator: (value) => {
        if (!value) {
          return 'You need to write something!'
        }
      }
    }
  }

  return Swal.fire(config)
}

const sendEncryptMsg = (recipientPublicKey, text) => {
  const identity = getCurrentIdentity()

  const payload = {
    recipientPublicKey: recipientPublicKey,
    message: text
  }

  if (identity) {
    payload.accessLevel = identity.accessLevel
    payload.accessLevelHmac = identity.accessLevelHmac
    payload.encryptedSeedHex = identity.encryptedSeedHex
  }

  pendingSignTransactionId = _.UUID.v4()

  postIdentityMessage(pendingSignTransactionId, 'encrypt', payload)
}

const sendDecryptMsg = (text, lastOwnerPublicKey) => {
  const identity = getCurrentIdentity()

  const payload = {
    encryptedMessages: [{
      EncryptedHex: text,
      PublicKey: lastOwnerPublicKey
    }]
  }

  if (identity) {
    payload.accessLevel = identity.accessLevel
    payload.accessLevelHmac = identity.accessLevelHmac
    payload.encryptedSeedHex = identity.encryptedSeedHex
  }

  pendingSignTransactionId = _.UUID.v4()
  postIdentityMessage(pendingSignTransactionId, 'decrypt', payload)
}

const getNftTransferRecipientFromInput = () => {
  const input = document.getElementById('plus-nft-recipient-input')
  if (!input) return undefined

  return input.value && input.value.trim()
}

const getRecipientProfileFromInput = () => {
  const recipient = getNftTransferRecipientFromInput()
  if (!recipient || recipient.length === 0) return undefined
  const textIsPublicKey = recipient.startsWith(DESO_PUBLIC_KEY_PREFIX)
  return textIsPublicKey ? getProfileByPublicKey(recipient) : getProfileByUsername(recipient)
}

const restoreTransferButton = () => {
  const button = document.getElementById('plus-nft-transfer-button')
  button.disabled = false
  button.innerText = 'Transfer'
}

const initTransfer = (senderPublicKey, postHashHex, recipient, encryptedUnlockableText) => {
  showConfirmTransferDialog(recipient)
    .then((res) => {
      if (res.isConfirmed) {
        const textIsPublicKey = recipient.startsWith(DESO_PUBLIC_KEY_PREFIX)
        return textIsPublicKey ? getProfileByPublicKey(recipient) : getProfileByUsername(recipient)
      } else {
        restoreTransferButton()
      }
    })
    .then(profile => {
      const recipientPublicKey = profile['PublicKeyBase58Check']
      if (!recipientPublicKey) return Promise.reject(`Unable to retrieve profile for ${recipient}`)
      const serialNumber = getSerialNumber()
      return transferNft(senderPublicKey, recipientPublicKey, postHashHex, serialNumber, encryptedUnlockableText)
    })
    .then(signTransaction)
    .catch(err => {
      console.error(err)
      restoreTransferButton()
    })
}

const onNftTransferUnlockableEncrypted = (encryptedUnlockableText) => {
  const recipient = getNftTransferRecipientFromInput()
  if (!recipient || recipient.length === 0) return

  const publicKey = getLoggedInPublicKey()
  const postHashHex = getPostHashHexFromUrl()
  if (!publicKey || !postHashHex) return

  initTransfer(publicKey, postHashHex, recipient, encryptedUnlockableText)
}

const onNftTransferUnlockableDecrypted = (unlockableText) => {
  transferNftUnlockableText = unlockableText
}

const createTransferButton = (senderPublicKey, postHashHex) => {
  const transferButton = document.createElement('button')
  transferButton.id = 'plus-nft-transfer-button'
  transferButton.type = 'button'
  transferButton.className = 'btn btn-primary font-weight-bold br-8px fs-13px ml-3'
  transferButton.innerText = 'Transfer'
  transferButton.onclick = () => {
    const recipient = getNftTransferRecipientFromInput()
    if (!recipient || recipient.length === 0) return

    showSpinner(transferButton)

    const hasUnlockable = transferNftPostEntry['HasUnlockable']

    if (hasUnlockable) {
      getRecipientProfileFromInput().then(profile => {
        const recipientPublicKey = profile['PublicKeyBase58Check']
        if (transferNftUnlockableText) {
          // Already have decrypted unlockable text
          sendEncryptMsg(recipientPublicKey, transferNftUnlockableText)
        } else {
          // Entry requires unlockable text, but we don't have any
          showUnlockableTextDialog().then(res => {
            if (res.isConfirmed) {
              sendEncryptMsg(recipientPublicKey, res.value)
            } else {
              restoreTransferButton()
            }
          })
        }
      })
    } else {
      initTransfer(senderPublicKey, postHashHex, recipient)
    }
  }

  return transferButton
}

const createTransferNftPage = () => {
  transferNftUnlockableText = null
  transferNftPostEntry = null
  transferNftOwnedEntries = []

  setCustomPageTopBarTitle('Transfer an NFT')

  const notFoundElement = getCustomPageNotFoundElement()

  const headerElement = createCustomPageHeaderElement(
    'When you transfer an NFT, the recipient may only be notified if they have BitClout+ installed.\n\n' +
    'The recipient may accept the transfer, return it, or burn the NFT to reject it. You cannot undo this.'
  )
  notFoundElement.appendChild(headerElement)

  const userSelectDiv = createNftTransfersSearchArea()
  notFoundElement.appendChild(userSelectDiv)

  const postHashHex = getPostHashHexFromUrl()
  const publicKey = getLoggedInPublicKey()
  if (!publicKey || !postHashHex) return

  getBidsForNftPost(publicKey, postHashHex)
    .then(res => {
      transferNftPostEntry = res['PostEntryResponse']
      transferNftOwnedEntries = res['NFTEntryResponses'].filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      const transferButton = createTransferButton(publicKey, postHashHex)
      addPostToBody(transferNftPostEntry, headerElement, notFoundElement, [transferButton], true)
    })
}

const createAcceptButton = (publicKey, postEntry, serialNumber, declineButton) => {
  const acceptButton = document.createElement('button')
  acceptButton.type = 'button'
  acceptButton.className = 'btn btn-primary font-weight-bold br-8px fs-13px ml-3'
  acceptButton.innerText = 'Accept'
  acceptButton.onclick = () => {
    showSpinner(acceptButton)
    declineButton.disabled = true
    acceptTransferNft(publicKey, postEntry['PostHashHex'], serialNumber)
      .then(signTransaction)
      .catch(err => {
        console.error(err)
        acceptButton.disabled = false
        acceptButton.innerText = 'Accept'
        declineButton.disabled = false
      })
  }
  return acceptButton
}

function createNftTransfersElement() {
  const emptySpan = document.createElement('span')
  emptySpan.innerText = 'No pending NFT transfers'

  const emptyInnerDiv = document.createElement('div')
  emptyInnerDiv.className = 'background-color-grey p-35px br-12px d-flex flex-row align-items-center'
  emptyInnerDiv.style.textAlign = 'center'
  emptyInnerDiv.appendChild(emptySpan)

  const emptyOuterDiv = document.createElement('div')
  emptyOuterDiv.className = 'p-15px'
  emptyOuterDiv.appendChild(emptyInnerDiv)

  return emptyOuterDiv
}

const getPendingNftTransfers = (publicKey) => getNftsForUser(publicKey).then(res =>
  Object.values(res).filter(value => value['NFTEntryResponses']
    .filter(nft => nft['IsPending'] === true).length > 0)
)

const createNftTransfersPage = () => {
  setCustomPageTopBarTitle('NFT Transfers')

  const notFoundElement = getCustomPageNotFoundElement()

  const headerElement = createCustomPageHeaderElement(
    'When an NFT is transferred it remains in a "pending" state until accepted by the recipient.'
  )
  notFoundElement.appendChild(headerElement)

  const publicKey = getLoggedInPublicKey()
  getPendingNftTransfers(publicKey).then(pendingNfts => {
    if (pendingNfts.length === 0) {
      const emptyElement = createNftTransfersElement(notFoundElement)
      notFoundElement.appendChild(emptyElement)
      return
    }

    pendingNfts.forEach(value => {
      const postEntry = value['PostEntryResponse']
      const nftEntries = value['NFTEntryResponses']

      nftEntries.forEach(nft => {
        const serialNumber = nft['SerialNumber']

        const serialNumberElement = document.createElement('div')
        serialNumberElement.className = 'form-control w-auto'
        serialNumberElement.innerText = `Serial ${serialNumber}`

        const serialNumberSpacer = document.createElement('div')
        serialNumberSpacer.className = 'flex-grow-1'
        serialNumberSpacer.appendChild(serialNumberElement)

        const declineButton = createDangerButton('Decline')
        declineButton.onclick = () => window.location.href = `/nft/${postEntry['PostHashHex']}/burn`

        const acceptButton = createAcceptButton(publicKey, postEntry, serialNumber, declineButton)

        const buttonElements = [serialNumberSpacer, declineButton, acceptButton]

        const username = postEntry['ProfileEntryResponse']['Username']

        createNftPostElement(postEntry, notFoundElement, username, buttonElements, serialNumberElement)
      })
    })
  })
}

const addNftTransfersMenuItem = () => {
  const id = 'plus-nft-transfers-left-bar-button'
  if (document.getElementById(id)) return

  const leftBarButtons = document.querySelectorAll('left-bar-button')
  if (!leftBarButtons || leftBarButtons.length === 0) return

  const sidebar = leftBarButtons[0].parentElement

  const dividers = sidebar.querySelectorAll('.p-15px')
  if (!dividers) return

  const a = document.createElement('a')
  a.className = 'cursor-pointer fs-15px text-grey5'
  a.href = '/nft-transfers'
  a.innerText = 'NFT Transfers'

  const innerDiv = document.createElement('div')
  innerDiv.className = 'd-flex justify-content-center align-items-center'
  innerDiv.appendChild(a)

  const active = new URL(window.location).pathname.includes('nft-transfers')

  if (active) a.classList.add('fc-default')

  const dot = document.createElement('a')
  dot.className = active ? 'left-bar__dot-active' : 'left-bar__dot-inactive'
  dot.href = '/nft-transfers'
  dot.innerText = ' · '

  const outerDiv = document.createElement('div')
  outerDiv.className = 'w-100 d-flex pt-15px pl-15px'
  outerDiv.appendChild(dot)
  outerDiv.appendChild(innerDiv)

  const leftBarButton = document.createElement('left-bar-button')
  leftBarButton.id = id
  leftBarButton.appendChild(outerDiv)

  sidebar.insertBefore(leftBarButton, dividers[1])

  checkForNftTransfers()
}

const addNftExtraDataToNftPage = (nftPostPage) => {
  const extraDataLinkId = 'plus_nft-extra-data-link'
  if (document.getElementById(extraDataLinkId)) return

  const postHashHex = getPostHashHexFromUrl()
  getSinglePost(postHashHex)
    .then(data => data['PostFound']['PostExtraData'])
    .then(postExtraData => {
      if (!postExtraData || _.isEmpty(postExtraData) || document.getElementById(extraDataLinkId)) return

      const json = document.createElement('pre')
      json.innerText = JSON.stringify(postExtraData, null, 2)
      json.className = 'plus-text-primary d-none p-3 rounded mt-2 border-secondary'
      json.style.border = '1px solid'
      json.style.whiteSpace = 'pre'

      const link = document.createElement('div')
      link.id = extraDataLinkId
      link.className = 'cursor-pointer'
      link.innerText = "Show Extra Data"
      link.onclick = () => {
        if (json.classList.contains('d-none')) {
          json.classList.remove('d-none')
          link.innerText = "Hide Extra Data"
        } else {
          json.classList.add('d-none')
          link.innerText = "Show Extra Data"
        }
      }

      const footer = getNftPostPageFooter(nftPostPage)
      footer?.appendChild(link)
      footer?.appendChild(json)
    })
    .catch()
}
