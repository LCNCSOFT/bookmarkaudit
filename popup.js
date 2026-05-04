// Count bookmarks and folders for the popup glance.
async function quickCount() {
  const tree = await chrome.bookmarks.getTree();
  let bookmarks = 0;
  let folders = 0;

  function walk(node) {
    if (node.url) bookmarks++;
    else if (node.children) {
      // Only count user-visible folders (skip the unnamed root + its top kids
      // when they are empty containers; here we just count any folder with a title).
      if (node.title) folders++;
      node.children.forEach(walk);
    }
  }
  tree.forEach(walk);
  // Subtract the top-level system folders if you want; we'll keep them.
  return { bookmarks, folders };
}

async function init() {
  try {
    const { bookmarks, folders } = await quickCount();
    document.getElementById("qTotal").textContent = bookmarks.toLocaleString();
    document.getElementById("qFolders").textContent = folders.toLocaleString();
  } catch (err) {
    console.error("[Bookmark Audit] popup count failed:", err);
  }
}

document.getElementById("runBtn").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  window.close();
});

init();
