/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).

 Adapted from https://github.com/bitclout/frontend/
 */

const isVimeoFromURL = (url) => {
  const pattern = /\bvimeo\.com$/
  return pattern.test(url.hostname)
}

const isYoutubeFromURL = (url) => {
  const patterns = [/\byoutube\.com$/, /\byoutu\.be$/]
  return patterns.some((p) => p.test(url.hostname))
}

const isTiktokFromURL = (url) => {
  const pattern = /\btiktok\.com$/
  return pattern.test(url.hostname)
}

const isGiphyFromURL = (url) => {
  const pattern = /\bgiphy\.com$/
  return pattern.test(url.hostname)
}

const isSpotifyFromURL = (url) => {
  const pattern = /\bspotify\.com$/
  return pattern.test(url.hostname)
}

const isSoundCloudFromURL = (url) => {
  const pattern = /\bsoundcloud\.com$/
  return pattern.test(url.hostname)
}

// This regex helps extract the correct videoID from the various forms of URLs that identify a youtube video.
const youtubeParser = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([A-Za-z0-9_-]{11}).*/
  const match = url.match(regExp)
  return match && match[7].length === 11 ? match[7] : false
}

const constructYoutubeEmbedURL = (url) => {
  const youtubeVideoID = youtubeParser(url.toString())
  // If we can't find the videoID, return the empty string which stops the iframe from loading.
  return youtubeVideoID ? `https://www.youtube.com/embed/${youtubeVideoID}` : ""
}

// Vimeo video URLs are simple -- anything after the last "/" in the url indicates the videoID.
const vimeoParser = (url) => {
  const regExp = /^.*((player\.)?vimeo\.com\/)(video\/)?(\d{0,15}).*/
  const match = url.match(regExp)
  return match && match[4] ? match[4] : false
}

const constructVimeoEmbedURL = (url) => {
  const vimeoVideoID = vimeoParser(url.toString())
  return vimeoVideoID ? `https://player.vimeo.com/video/${vimeoVideoID}` : ""
}

const giphyParser = (url) => {
  const regExp = /^.*((media\.)?giphy\.com\/(gifs|media|embed|clips)\/)([A-Za-z0-9]+-)*([A-Za-z0-9]{0,20}).*/
  const match = url.match(regExp)
  return match && match[5] ? match[5] : false
}

const constructGiphyEmbedURL = (url) => {
  const giphyId = giphyParser(url.toString())
  return giphyId ? `https://giphy.com/embed/${giphyId}` : ""
}

const spotifyParser = (url) => {
  const regExp = /^.*(open\.)?spotify\.com\/(((embed\/)?(track|artist|playlist|album))|((embed-podcast\/)?(episode|show)))\/([A-Za-z0-9]{0,25}).*/
  const match = url.match(regExp)
  if (match && match[9]) {
    if (match[8]) {
      return `embed-podcast/${match[8]}/${match[9]}`
    }
    if (match[5]) {
      return `embed/${match[5]}/${match[9]}`
    }
  }
  return false
}

const constructSpotifyEmbedURL = (url) => {
  const spotifyEmbedSuffix = spotifyParser(url.toString())
  return spotifyEmbedSuffix ? `https://open.spotify.com/${spotifyEmbedSuffix}` : ""
}

const soundCloudParser = (url) => {
  const regExp = /^.*(soundcloud.com\/([a-z0-9-_]+)\/(sets\/)?([a-z0-9-_]+)).*/
  const match = url.match(regExp)
  return match && match[1] ? match[1] : false
}

const constructSoundCloudEmbedURL = (url) => {
  const soundCloudURL = soundCloudParser(url.toString())
  return soundCloudURL
    ? `https://w.soundcloud.com/player/?url=https://${soundCloudURL}?hide_related=true&show_comments=false`
    : ""
}

const extractTikTokVideoID = (fullTikTokURL) => {
  const regExp = /^.*((tiktok\.com\/)(v\/)|(@[A-Za-z0-9_-]{2,24}\/video\/)|(embed\/v2\/))(\d{0,30}).*/
  const match = fullTikTokURL.match(regExp)
  return match && match[6] ? match[6] : false
}

const tiktokParser = (url) => {
  let tiktokURL
  try {
    tiktokURL = new URL(url)
  } catch (e) {
    return undefined
  }

  if (tiktokURL.hostname === "vm.tiktok.com") {
    const regExp = /^.*(vm\.tiktok\.com\/)([A-Za-z0-9]{6,12}).*/
    const match = url.match(regExp)
    if (!match || !match[2]) {
      return undefined
    }

    return extractTikTokVideoID(url)
  }
}

const constructTikTokEmbedURL = (url) => {
  const tikTokId = tiktokParser(url.toString())
  if (!tikTokId) return undefined

  return `https://www.tiktok.com/embed/v2/${tikTokId}`
}

const getEmbedURL = (embedURL) => {
  if (!embedURL) {
    return undefined
  }
  let url
  try {
    url = new URL(embedURL)
  } catch (e) {
    // If the embed video URL doesn't start with http(s), try the url with that as a prefix.
    if (!embedURL.startsWith("https://") && !embedURL.startsWith("http://")) {
      return getEmbedURL(`https://${embedURL}`)
    }
    return undefined
  }
  if (isYoutubeFromURL(url)) {
    return constructYoutubeEmbedURL(url)
  }
  if (isVimeoFromURL(url)) {
    return constructVimeoEmbedURL(url)
  }
  if (isTiktokFromURL(url)) {
    return constructTikTokEmbedURL(url)
  }
  if (isGiphyFromURL(url)) {
    return constructGiphyEmbedURL(url)
  }
  if (isSpotifyFromURL(url)) {
    return constructSpotifyEmbedURL(url)
  }
  if (isSoundCloudFromURL(url)) {
    return constructSoundCloudEmbedURL(url)
  }
  return undefined
}
