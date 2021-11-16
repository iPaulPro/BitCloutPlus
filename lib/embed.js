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

const twitchParser = (url) => {
  const regExp = /^.*((player\.|clips\.)?twitch\.tv)\/(videos\/(\d{8,12})|\?video=(\d{8,12})|\?channel=([A-Za-z0-9_]{1,30})|collections\/([A-Za-z0-9]{10,20})|\?collection=([A-Za-z0-9]{10,20}(&video=\d{8,12})?)|embed\?clip=([A-Za-z0-9_-]{1,80})|([A-Za-z0-9_]{1,30}(\/clip\/([A-Za-z0-9_-]{1,80}))?)).*/
  const match = url.match(regExp)
  if (match && match[3]) {
    // https://www.twitch.tv/videos/1234567890
    if (match[3].startsWith('videos') && match[4]) {
      return `player.twitch.tv/?video=${match[4]}`
    }
    // https://player.twitch.tv/?video=1234567890&parent=www.example.com
    if (match[3].startsWith('?video=') && match[5]) {
      return `player.twitch.tv/?video=${match[5]}`
    }
    // https://player.twitch.tv/?channel=xxxyyy123&parent=www.example.com
    if (match[3].startsWith('?channel=') && match[6]) {
      return `player.twitch.tv/?channel=${match[6]}`
    }
    // https://www.twitch.tv/xxxyyy123
    if (match[3] && match[11] && match[3] === match[11] && !match[12] && !match[13]) {
      return `player.twitch.tv/?channel=${match[11]}`
    }
    // https://www.twitch.tv/xxyy_1234m/clip/AbCD123JMn-rrMMSj1239G7
    if (match[12] && match[13]) {
      return `clips.twitch.tv/embed?clip=${match[13]}`
    }
    // https://clips.twitch.tv/embed?clip=AbCD123JMn-rrMMSj1239G7&parent=www.example.com
    if (match[10]) {
      return `clips.twitch.tv/embed?clip=${match[10]}`
    }
    // https://www.twitch.tv/collections/11jaabbcc2yM989x?filter=collections
    if (match[7]) {
      return `player.twitch.tv/?collection=${match[7]}`
    }
    // https://player.twitch.tv/?collection=11jaabbcc2yM989x&video=1234567890&parent=www.example.com
    if (match[8]) {
      return `player.twitch.tv/?collection=${match[8]}`
    }
  }
  return false
}

const constructTwitchEmbedURL = (url) => {
  const twitchParsed = twitchParser(url.toString())
  return twitchParsed ? `https://${twitchParsed}` : ''
}

const isTwitchFromURL = (url) => {
  const pattern = /\btwitch\.tv$/
  return pattern.test(url.hostname)
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
  if (isTwitchFromURL(url)) {
    const embedURL = constructTwitchEmbedURL(url)
    return embedURL ? embedURL + `&autoplay=false&parent=${location.hostname}` : ""
  }
  return undefined
}
