/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const maxPostLength = 15000
const postButtonClass = 'plus-btn-submit-post'

const extraDataTextAreaId = 'plus_create-post-extra-data'
const extraDataHelpTextId = 'plus_create-post-extra-data-help'
const editPostId = 'plus_edit-post-btn'

const isPostUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'posts' &&  segments[2] !== 'new'
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

const buildTributeUsernameMenuTemplate = item => {
  const spotPrice = getSpotPrice()
  const bitcloutPrice = item.original['CoinPriceDeSoNanos'] / deSoInNanos

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

  const usernameSpan = document.createElement('span')
  usernameSpan.innerText = item.original['Username']
  if (icon) usernameSpan.appendChild(icon)

  const nameDiv = document.createElement('div')
  nameDiv.className = 'ml-1 pl-1'
  nameDiv.appendChild(usernameSpan)
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
  return `<div class="row no-gutters fs-15px p-3 plus-text-muted">Loading...</div>`
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
    if (primaryButton.innerText.includes('Post')) {
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

const addPostErrorDiv = (e, container) => {
  const btn = document.createElement('button')
  btn.className = 'btn btn-danger btn-sm mt-2'
  btn.innerText = 'Disable post enhancements'
  btn.onclick = () => disableLongPost()

  const textarea = document.createElement('textarea')
  textarea.className = 'w-100'
  textarea.rows = 6
  textarea.innerText = `${(e.stack || e)}`

  const span = document.createElement('span')
  span.innerText = 'Trouble posting? Disabling post enhancements may help.'

  const a = document.createElement('a')
  a.href = '/u/plus'
  a.innerText = '@plus'

  const contact = document.createElement('span')
  contact.className = 'd-block my-2'
  contact.innerText = 'Please report this to '
  contact.appendChild(a)

  const p = document.createElement('p')
  p.className = 'plus-text-muted fs-14px'
  p.appendChild(span)
  p.appendChild(contact)
  p.appendChild(textarea)

  const div = document.createElement('div')
  div.className = 'p-2'

  div.appendChild(p)
  div.appendChild(btn)
  container.appendChild(div)
}

const onPostButtonClick = (postButton) => {
  if (!postButton) return

  const restoreButton = () => {
    postButton.classList.remove('disabled')
    postButton.innerText = 'Post'
  }

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

  postButton.innerText = ''
  postButton.appendChild(spinner)

  const onPostSubmitted = (transactionHex) => {
    if (!transactionHex) {
      return Promise.reject('Error creating submit-post transaction')
    }

    const identity = getCurrentIdentity()
    if (!identity) {
      return Promise.reject('No Identity found')
    }

    const id = uuid()
    sendSignTransactionMsg(identity, transactionHex, id)
  }

  const pubKey = getLoggedInPublicKey()

  const params = new URLSearchParams(window.location.search)
  const postHashHexToModify = params.get('edit')
  if (postHashHexToModify) {
    getSinglePost(postHashHexToModify)
      .then(data => data['PostFound'])
      .then(post => {
        if (pubKey !== post['PosterPublicKeyBase58Check']) return Promise.reject('Cannot edit a post you did not create')
        const image = post['ImageURLs']
        const video = post['VideoURLs']
        const extraData = post['PostExtraData']
        if (extraData['DerivedPublicKey']) delete extraData['DerivedPublicKey']
        const repostedPostHashHex = post['RepostedPostEntryResponse'] ? post['RepostedPostEntryResponse']['PostHashHex'] : ''
        const parentStakeID = post['ParentStakeID']
        return submitPost(pubKey, postBody, image, video, null, extraData, postHashHexToModify, repostedPostHashHex, parentStakeID)
      })
      .then(onPostSubmitted)
      .catch(e => {
        addPostErrorDiv(e, container)
        restoreButton()
      })
    return
  }

  const postImage = container.getElementsByClassName('feed-post__image').item(0)
  const hasImage = postImage && postImage.src &&
    (postImage.src.includes(`images.${window.location.hostname}`) || postImage.src.includes(`images.deso.org`))
  const image = hasImage ? postImage.src : undefined

  const postEmbed = container.querySelector('input[type="url"]')
  const embedUrl = postEmbed ? postEmbed.value : undefined

  const video = container.querySelector('.feed-post__video-container')?.firstElementChild?.src

  let extraData = {}
  const extraDataTextArea = document.getElementById(extraDataTextAreaId)
  if (extraDataTextArea) {
    const extraDataTextAreaValue = extraDataTextArea.value
    if (extraDataTextAreaValue && extraDataTextAreaValue.length > 0) {
      try {
        extraData = JSON.parse(extraDataTextAreaValue)
      } catch (e) {
        Swal.fire({
          title: 'Error',
          text: 'Invalid Extra Text JSON.'
        })
        restoreButton()
        return
      }
    }
  }

  if (!extraData['Node']) {
    extraData['Node'] = "2"
  }

  submitPost(pubKey, postBody, [image], [video], embedUrl, extraData)
    .then(onPostSubmitted)
    .catch(e => {
      addPostErrorDiv(e, container)
      restoreButton()
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

function onPostTextAreaInputChange() {
  const container = document.querySelector('feed-create-post')
  if (!container) return

  const characterCounter = container.querySelector('.feed-create-post__character-counter')
  if (!characterCounter) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

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
}

const addPostTextAreaListener = () => {
  if (!longPostEnabled) return

  const container = document.querySelector('feed-create-post')
  if (!container) return

  const postTextArea = container.querySelector('textarea')
  if (!postTextArea) return

  postTextArea.addEventListener('input', () => {
    onPostTextAreaInputChange(postTextArea)
  })
}

const enrichCreatePostPage = (page) => {
  if (!page) return

  const feedCreatePost = page.querySelector('feed-create-post')
  if (!feedCreatePost) return

  const postEmbedContainer = feedCreatePost.lastElementChild
  if (!postEmbedContainer) return

  const icons = postEmbedContainer.querySelectorAll('i')
  const firstIcon = icons.length > 0 ? icons[0] : null
  if (!firstIcon) return

  const textAreaContainerId = 'plus_create-post-extra-data-box'

  const icon = document.createElement('i')
  icon.className = 'fas fa-sitemap fa-lg text-grey8A cursor-pointer fs-18px pr-15px'
  icon.onclick = () => {
    const textArea = document.getElementById(textAreaContainerId)
    if (!textArea) return

    if (textArea.classList.contains('d-none')) {
      textArea.classList.remove('d-none')
    } else {
      textArea.classList.add('d-none')
    }
  }
  postEmbedContainer.insertBefore(icon, firstIcon)

  const textarea = document.createElement('textarea')
  textarea.id = extraDataTextAreaId
  textarea.rows = 5
  textarea.spellcheck = false
  textarea.className = 'form-control fs-14px'
  textarea.placeholder = '{\n    "key": "value" // Values may only be strings\n}'
  textarea.setAttribute('aria-describedby', extraDataHelpTextId)

  tabOverride.tabSize(4)
  tabOverride.autoIndent(true)
  tabOverride.set(textarea)

  const label = document.createElement('label')
  label.setAttribute('for', extraDataTextAreaId)
  label.innerText = 'Extra Data'

  const helpText = document.createElement('small')
  helpText.id = extraDataHelpTextId
  helpText.className = 'form-text text-muted'
  helpText.innerText = 'Extra data allows arbitrary text to be attached to the post, in JSON format. This is useful for things like on-chain NFT attributes.'

  const textAreaContainer = document.createElement('div')
  textAreaContainer.id = textAreaContainerId
  textAreaContainer.className = 'p-3 d-none'
  textAreaContainer.appendChild(label)
  textAreaContainer.appendChild(textarea)
  textAreaContainer.appendChild(helpText)

  feedCreatePost.insertBefore(textAreaContainer, postEmbedContainer)
}

const showEditPostButtonIfNeeded = () => {
  if (document.getElementById(editPostId)) return
  let postHashHex = getPostHashHexFromUrl()
  getSinglePost(postHashHex)
    .then(data => data['PostFound'])
    .then(post => {
      if (document.getElementById(editPostId)) return
      if (post['PosterPublicKeyBase58Check'] === getLoggedInPublicKey()) {
        const hasParent = post['ParentStakeID'].length > 0
        const a = document.createElement('a')
        a.id = editPostId
        a.className = 'fs-14px'
        a.href = `/posts/new?edit=${postHashHex}`
        a.innerText = hasParent ? 'Edit Comment' : 'Edit Post'
        const topBar = document.querySelector(`.global__top-bar`)
        topBar.appendChild(a)
      }
    })
    .catch(console.error)
}

const checkForEditPostQueryParams = (page) => {
  const params = new URLSearchParams(window.location.search)
  const postHashHex = params.get('edit')
  if (postHashHex) {
    getSinglePost(postHashHex)
      .then(data => data['PostFound'])
      .then(post => {
        if (post['PosterPublicKeyBase58Check'] === getLoggedInPublicKey()) {
          const topBar = page.querySelector('create-post-form')?.firstElementChild
          const hasParent = post['ParentStakeID'].length > 0
          if (topBar && topBar.firstElementChild) {
            topBar.firstElementChild.innerText = hasParent ? ' Edit comment ' : ' Edit post '
          }

          const createPostDiv = page.querySelector('feed-create-post')
          const textArea = createPostDiv?.querySelector('textarea')
          if (textArea) {
            textArea.value = post['Body']
            onPostTextAreaInputChange()

            const postAttachmentButtons = createPostDiv.lastElementChild.querySelectorAll('i')
            postAttachmentButtons.forEach(button => {
              button.remove()
            })

            const postButton = document.getElementsByClassName(postButtonClass)[0]
            postButton.innerText = 'Update'

            const text = document.createElement('span')
            text.className = 'flex-grow-1 fs-12px text-muted px-3'
            text.innerText = 'Attachments and extra data will remain unchanged'
            const container = createPostDiv.lastElementChild
            container.insertBefore(text, container.firstElementChild)
          }
        }
      })
      .catch(console.error)
  }
}