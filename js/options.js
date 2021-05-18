const saveOptions = () => {
  const longPostEnabled = document.getElementById('longPostCheck').checked
  chrome.storage.local.set({ longPost: longPostEnabled }, () => {
    window.close()
  })
}

const restoreOptions = () => {
  chrome.storage.local.get(['longPost'], items => {
    const enabled = items.longPost === undefined || items.longPost
    document.getElementById('longPostCheck').checked = enabled
  })
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);