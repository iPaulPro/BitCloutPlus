/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const isBurnNftUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft' && segments[segments.length - 1] === 'burn';

}

let isRequestingNftEntries = false

const enrichNftPostPage = (nftPostPage) => {
  if (!nftPostPage || isRequestingNftEntries) return

  const burnNftButtonId = 'plus-btn-burn-nft'
  if (document.getElementById(burnNftButtonId)) return

  const publicKey = getLoggedInPublicKey()
  const postHashHex = getPostHashHexFromUrl()
  if (!publicKey || !postHashHex) return

  const nftPost = nftPostPage.querySelector('nft-post')

  const feedPostElement = nftPost.querySelector('feed-post')
  if (!feedPostElement) return

  const footerElement = feedPostElement.firstElementChild.lastElementChild
  if (!footerElement) return

  isRequestingNftEntries = true

  getNftEntriesForPostHashHex(publicKey, postHashHex)
    .then(nftEntries => {
      const ownedEntries = nftEntries.filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      if (ownedEntries.length === 0 || !isRequestingNftEntries) return

      const button = document.createElement('button')
      button.id = burnNftButtonId
      button.type = 'button'
      button.className = 'btn btn-danger font-weight-bold br-8px fs-13px'
      button.innerText = 'Burn NFT'

      const ownedEntriesForSale = ownedEntries.filter(entry => entry['IsForSale'] === true)
      if (ownedEntriesForSale.length === ownedEntries.length) {
        button.disabled = true
        button.title = 'You cannot burn an NFT that is for sale'
      }

      const url = window.location.href.split('?')[0]
      button.onclick = () => window.location.href = `${url}/burn`

      const container = footerElement.firstElementChild
      container.appendChild(button)
    })
    .finally(() => {
      isRequestingNftEntries = false
    })
}

const onBurnNftClick = (publicKey, postHashHex, serialNumberSelector) =>
  burnNft(publicKey, postHashHex, Number(serialNumberSelector.value))
    .then(result => {
      const transactionHex = result['TransactionHex']
      console.log(`burnNft transaction hash ${transactionHex}`)
      if (!transactionHex) {
        return Promise.reject('Error creating burn-nft transaction')
      }

      const identity = getCurrentIdentity()
      console.log(`burnNft identity ${JSON.stringify(identity)}`)
      if (!identity) {
        return Promise.reject('No Identity found')
      }

      const id = _.UUID.v4()
      sendSignTransactionMsg(identity, transactionHex, id)
    })
    .catch(console.error)

const createNftBurnInnerPage = (postEntry, ownedEntries, publicKey, postHashHex, notFoundElement, username) => {
  const postDiv = document.createElement('div')
  postDiv.className = 'feed-post__container d-flex justify-content-left w-100 px-15px pb-15px pt-15px feed-post__blue-border feed-post__parent-post-font-size'

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

  const options = []
  ownedEntries.forEach(entry => {
    const option = document.createElement('option')
    option.value = entry['SerialNumber']
    option.innerText = `Serial #${entry['SerialNumber']}`
    options.push(option)
  })

  const serialNumberSelector = document.createElement('select')
  serialNumberSelector.className = 'form-control w-auto'

  const postFooterContentDiv = document.createElement('div')
  postFooterContentDiv.className = 'd-flex justify-content-between align-items-center'

  options.forEach(option => serialNumberSelector.appendChild(option))
  postFooterContentDiv.appendChild(serialNumberSelector)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-danger font-weight-bold br-8px fs-13px'
  button.innerText = 'Burn NFT'
  postFooterContentDiv.appendChild(button)

  button.onclick = () => {
    const spinnerAlt = document.createElement('span')
    spinnerAlt.className = 'sr-only'
    spinnerAlt.innerText = 'Working...'

    const spinner = document.createElement('div')
    spinner.className = 'spinner-border spinner-border-sm text-light'
    spinner.dataset.role = 'status'
    spinner.appendChild(spinnerAlt)

    button.innerText = ''
    button.appendChild(spinner)

    onBurnNftClick(publicKey, postHashHex, serialNumberSelector)
      .catch(err => {
        console.error(err)
        button.innerText = 'Burn NFT'
        button.classList.remove('disabled')
      })
  }

  const postFooterDiv = document.createElement('div')
  postFooterDiv.className = 'p-15px fs-15px w-100 background-color-grey feed-post__blue-border'
  postFooterDiv.appendChild(postFooterContentDiv)
  notFoundElement.appendChild(postDiv)
  notFoundElement.appendChild(postFooterDiv)

  const padding = document.createElement('div')
  padding.className = 'w-100 p-35px'
  notFoundElement.appendChild(padding)
}

const createBurnNftPage = () => {
  const topBar = document.querySelector(`top-bar-mobile-navigation-control`)
  if (!topBar) return

  const titleElement = topBar.parentElement
  titleElement.innerText = 'Burn NFT'

  const notFoundElement = document.querySelector(`not-found`)
  const notFoundContentContainer = document.querySelector(`.not-found__content-container`)
  notFoundElement.removeChild(notFoundContentContainer)

  const headerElement = document.createElement('div')
  headerElement.className = 'd-flex align-items-center fs-15px fc-muted p-15px border-bottom border-color-grey background-color-light-grey'
  headerElement.innerText = 'Burning an NFT is an irreversible action that revokes your ownership and "un-mints" the serial number.'
  notFoundElement.appendChild(headerElement)

  const confirmTextElement = document.createElement('div')
  confirmTextElement.className = 'fs-15px font-weight-bold mt-15px px-15px text-danger pb-3 border-bottom border-color-grey'
  confirmTextElement.innerText = 'Are you sure you want to burn this NFT?'
  notFoundElement.appendChild(confirmTextElement)

  const postHashHex = getPostHashHexFromUrl()
  const publicKey = getLoggedInPublicKey()
  if (!publicKey || !postHashHex) return

  getBidsForNftPost(publicKey, postHashHex)
    .then(res => {
      const postEntry = res['PostEntryResponse']
      const nftEntries = res['NFTEntryResponses']

      const ownedEntries = nftEntries.filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      if (ownedEntries.length === 0) {
        confirmTextElement.innerText = 'You don\'t own this NFT'
        return
      }

      getProfileByPublicKey(postEntry['PosterPublicKeyBase58Check'])
        .then(profile => {
          const username = profile['Username']
          createNftBurnInnerPage(postEntry, ownedEntries, publicKey, postHashHex, notFoundElement, username)
        })
    })
}
