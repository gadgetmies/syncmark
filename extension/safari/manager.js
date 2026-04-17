let fileHandle = null;
let bookmarkData = null;

const setupView = document.getElementById('setupView');
const bookmarksView = document.getElementById('bookmarksView');
const bookmarksGrid = document.getElementById('bookmarksGrid');
const fileStatus = document.getElementById('fileStatus');

// Persistence using IndexedDB for FileSystemFileHandle
const DB_NAME = 'SyncMarkDB';
const STORE_NAME = 'handles';

async function saveHandle(handle) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).put(handle, 'lastHandle');
}

async function loadHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get('lastHandle');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function init() {
  try {
    const savedHandle = await loadHandle();
    if (savedHandle) {
      // Check if we still have permission
      const options = { mode: 'readwrite' };
      if ((await savedHandle.queryPermission(options)) === 'granted') {
        fileHandle = savedHandle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        bookmarkData = JSON.parse(text);
        updateUI();
        checkPendingBookmarks();
      } else {
        fileStatus.innerText = 'Permission required to reconnect file';
        fileStatus.style.cursor = 'pointer';
        fileStatus.onclick = async () => {
          if ((await savedHandle.requestPermission(options)) === 'granted') {
            fileHandle = savedHandle;
            const file = await fileHandle.getFile();
            const text = await file.text();
            bookmarkData = JSON.parse(text);
            updateUI();
            checkPendingBookmarks();
          }
        };
      }
    }
  } catch (err) {
    console.error('Failed to restore handle:', err);
  }
}

async function checkPendingBookmarks() {
  if (!bookmarkData || !fileHandle) return;

  const result = await browser.storage.local.get('pendingBookmarks');
  const pending = result.pendingBookmarks || [];
  const syncStatus = document.getElementById('syncStatus');

  if (pending.length > 0) {
    console.log(`Syncing ${pending.length} pending bookmarks...`);
    syncStatus.innerText = `Sync ${pending.length} Pending`;
    syncStatus.classList.remove('hidden');
    
    // Auto-sync
    for (const b of pending) {
      if (b.previewImage && !b.previewImage.startsWith('data:')) {
        b.previewImage = await resizeImage(b.previewImage);
      }
    }
    bookmarkData.bookmarks.unshift(...pending);
    await saveToFile();
    await browser.storage.local.set({ pendingBookmarks: [] });
    renderBookmarks();
    
    // Show success for a bit then hide
    syncStatus.innerText = '\u2713 Synced';
    setTimeout(() => {
      syncStatus.classList.add('hidden');
    }, 3000);
    
    console.log('Pending bookmarks synced successfully.');
  } else {
    syncStatus.classList.add('hidden');
  }
}

document.getElementById('syncStatus').addEventListener('click', checkPendingBookmarks);

async function updateUI() {
  if (bookmarkData) {
    setupView.classList.add('hidden');
    bookmarksView.classList.remove('hidden');
    fileStatus.innerText = 'Connected: ' + (fileHandle?.name || 'Local File');
    fileStatus.classList.add('connected');
    fileStatus.onclick = null;
    fileStatus.style.cursor = 'default';
    renderBookmarks();
  } else {
    setupView.classList.remove('hidden');
    bookmarksView.classList.add('hidden');
    fileStatus.classList.remove('connected');
  }
}

function renderBookmarks() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = bookmarkData.bookmarks.filter(b => 
    b.title.toLowerCase().includes(query) || 
    b.url.toLowerCase().includes(query) ||
    (b.tags && b.tags.some(t => t.toLowerCase().includes(query)))
  );

  bookmarksGrid.innerHTML = filtered.map(b => `
    <div class="card">
      ${b.previewImage ? `<img src="${b.previewImage}" class="card-image" alt="${b.title}" referrerPolicy="no-referrer">` : ''}
      <div class="card-header">
        <div class="card-title">${b.title}</div>
        <button data-id="${b.id}" class="btn-delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="card-url">${b.url}</div>
      ${b.tags && b.tags.length > 0 ? `
        <div class="tag-container">
          ${b.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      ` : ''}
      <a href="${b.url}" target="_blank" class="card-link">Open Link \u2192</a>
    </div>
  `).join('');

  // Fetch missing previews lazily
  filtered.forEach(b => {
    if (!b.previewImage) {
      fetchPreviewForBookmark(b);
    }
  });

  updateTagSuggestions();
}

function updateTagSuggestions() {
  if (!bookmarkData) return;
  const allTags = new Set();
  bookmarkData.bookmarks.forEach(b => {
    if (b.tags) b.tags.forEach(t => allTags.add(t));
  });
  
  const datalist = document.getElementById('tagSuggestions');
  if (datalist) {
    datalist.innerHTML = Array.from(allTags).map(t => `<option value="${t}">`).join('');
  }
}

async function resizeImage(url, maxWidth = 400, maxHeight = 300) {
  if (!url) return null;
  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // Compressed JPEG
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } catch (err) {
    console.error('Resize error:', err);
    return null;
  }
}

async function fetchPreviewForBookmark(bookmark) {
  if (bookmark.previewImage || bookmark._fetching || bookmark._fetchFailed) return;
  bookmark._fetching = true;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(bookmark.url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    let imageUrl = null;
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) imageUrl = ogImage.content;
    
    if (!imageUrl) {
      const twitterImage = doc.querySelector('meta[name="twitter:image"]');
      if (twitterImage && twitterImage.content) imageUrl = twitterImage.content;
    }

    if (imageUrl) {
      if (!imageUrl.startsWith('http')) {
        const baseUrl = new URL(bookmark.url);
        imageUrl = new URL(imageUrl, baseUrl.origin).href;
      }
      const resized = await resizeImage(imageUrl);
      if (resized) {
        bookmark.previewImage = resized;
        await saveToFile();
        renderBookmarks();
      } else {
        bookmark._fetchFailed = true;
      }
    } else {
      bookmark._fetchFailed = true;
    }
  } catch (err) {
    bookmark._fetchFailed = true;
  } finally {
    delete bookmark._fetching;
  }
}

// Event delegation for delete buttons (fixes CSP)
bookmarksGrid.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.btn-delete');
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    bookmarkData.bookmarks = bookmarkData.bookmarks.filter(b => b.id !== id);
    await saveToFile();
    renderBookmarks();
  }
});

// File Operations
document.getElementById('openFileBtn').addEventListener('click', async () => {
  try {
    [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    await saveHandle(fileHandle);
    const file = await fileHandle.getFile();
    const text = await file.text();
    bookmarkData = JSON.parse(text);
    updateUI();
  } catch (err) { console.error(err); }
});

document.getElementById('createFileBtn').addEventListener('click', async () => {
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: 'bookmarks.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    await saveHandle(fileHandle);
    bookmarkData = { version: '1.0.0', bookmarks: [], categories: ['General'] };
    await saveToFile();
    updateUI();
  } catch (err) { console.error(err); }
});

async function saveToFile() {
  if (!fileHandle || !bookmarkData) return;
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(bookmarkData, null, 2));
  await writable.close();
}

// Actions
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MANAGER_ADD_BOOKMARK') {
    if (!bookmarkData) {
      sendResponse({ success: false, error: 'No file connected in Manager' });
      return true;
    }
    
    const { title, url, previewImage, tags } = message.bookmark;
    
    const newBookmark = {
      id: crypto.randomUUID(),
      title: title || new URL(url).hostname,
      url,
      tags: tags || [],
      createdAt: Date.now()
    };

    (async () => {
      if (previewImage) {
        newBookmark.previewImage = await resizeImage(previewImage);
      }
      bookmarkData.bookmarks.unshift(newBookmark);
      await saveToFile();
      renderBookmarks();
      sendResponse({ success: true });
    })().catch(err => {
      console.error(err);
      sendResponse({ success: false, error: 'Failed to save to file' });
    });
    
    return true; // Keep channel open for async response
  }
});

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('addModal').classList.remove('hidden');
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('addModal').classList.add('hidden');
});

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = document.getElementById('bmUrl').value;
  const title = document.getElementById('bmTitle').value || new URL(url).hostname;
  const tags = document.getElementById('bmTags').value.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  bookmarkData.bookmarks.unshift({
    id: crypto.randomUUID(),
    title,
    url,
    tags,
    createdAt: Date.now()
  });
  
  await saveToFile();
  document.getElementById('addModal').classList.add('hidden');
  document.getElementById('addForm').reset();
  renderBookmarks();
  
  // Fetch preview for manual add
  fetchPreviewForBookmark(bookmarkData.bookmarks[0]);
});

document.getElementById('searchInput').addEventListener('input', renderBookmarks);

// Instapaper Import
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

importBtn.addEventListener('click', () => {
  if (!bookmarkData) {
    alert('Please connect a bookmarks file first.');
    return;
  }
  importInput.click();
});

importInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target.result;
    const imported = parseInstapaperCSV(text);
    
    if (imported.length > 0) {
      if (confirm(`Import ${imported.length} bookmarks from Instapaper?`)) {
        // Add to existing bookmarks, avoiding duplicates by URL
        const existingUrls = new Set(bookmarkData.bookmarks.map(b => b.url));
        const newBookmarks = imported.filter(b => !existingUrls.has(b.url));
        
        bookmarkData.bookmarks.unshift(...newBookmarks);
        await saveToFile();
        renderBookmarks();
        alert(`Successfully imported ${newBookmarks.length} new bookmarks.`);
      }
    } else {
      alert('No valid bookmarks found in the file.');
    }
    importInput.value = ''; // Reset input
  };
  reader.readAsText(file);
});

function parseInstapaperCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const bookmarks = [];
  // Instapaper CSV: URL,Title,Selection,Folder,Timestamp
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = [];
    let currentPart = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(currentPart.replace(/^"|"$/g, ''));
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart.replace(/^"|"$/g, ''));

    if (parts.length >= 2 && parts[0].startsWith('http')) {
      bookmarks.push({
        id: crypto.randomUUID(),
        url: parts[0],
        title: parts[1] || new URL(parts[0]).hostname,
        createdAt: parts[4] ? parseInt(parts[4]) * 1000 : Date.now()
      });
    }
  }
  return bookmarks;
}

init();
