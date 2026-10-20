/**
 * popup.js - 浏览器插件弹出窗口交互逻辑 (v1.1.3 终极文件名保障版)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const siteStatusEl = document.getElementById('site-status');
  const fileSummaryEl = document.getElementById('file-summary');
  const fileListEl = document.getElementById('popup-file-list');
  const emptyStateEl = document.getElementById('empty-state');
  const batchDownloadBtn = document.getElementById('btn-batch-download');
  const refreshBtn = document.getElementById('btn-refresh');
  const toggleSettingsBtn = document.getElementById('btn-toggle-settings');
  const settingsDrawer = document.getElementById('settings-drawer');

  const settingFloatingBtn = document.getElementById('setting-floating-btn');
  const settingUnlockCopy = document.getElementById('setting-unlock-copy');

  let currentTab = null;
  let currentFiles = [];

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  const isChaoxing = currentTab && currentTab.url && (
    currentTab.url.includes('chaoxing.com') ||
    currentTab.url.includes('fanya') ||
    currentTab.url.includes('.edu.cn')
  );

  if (isChaoxing) {
    siteStatusEl.textContent = '已连接到超星/泛雅课程页';
    siteStatusEl.style.color = '#52c41a';
  } else {
    siteStatusEl.textContent = '当前非超星网页';
    siteStatusEl.style.color = '#faad14';
  }

  chrome.storage.sync.get({
    showFloatingButton: true,
    autoUnlockRestrictions: true
  }, (items) => {
    settingFloatingBtn.checked = items.showFloatingButton;
    settingUnlockCopy.checked = items.autoUnlockRestrictions;
  });

  function saveSettings() {
    const newSettings = {
      showFloatingButton: settingFloatingBtn.checked,
      autoUnlockRestrictions: settingUnlockCopy.checked
    };
    chrome.storage.sync.set(newSettings, () => {
      if (currentTab && currentTab.id) {
        chrome.tabs.sendMessage(currentTab.id, {
          type: 'UPDATE_SETTINGS',
          settings: newSettings
        }).catch(() => {});
      }
    });
  }

  settingFloatingBtn.addEventListener('change', saveSettings);
  settingUnlockCopy.addEventListener('change', saveSettings);

  toggleSettingsBtn.addEventListener('click', () => {
    const isHidden = settingsDrawer.style.display === 'none';
    settingsDrawer.style.display = isHidden ? 'block' : 'none';
  });

  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getTypeInfo(item) {
    const name = (item.name || '').toLowerCase();
    const type = (item.fileType || item.dataType || '').toLowerCase();
    if (name.endsWith('.ppt') || name.endsWith('.pptx') || type.includes('ppt')) return { label: 'PPT', cls: 'badge-ppt' };
    if (name.endsWith('.pdf') || type.includes('pdf')) return { label: 'PDF', cls: 'badge-pdf' };
    if (name.endsWith('.doc') || name.endsWith('.docx') || type.includes('doc')) return { label: 'DOC', cls: 'badge-doc' };
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || type.includes('xls')) return { label: 'XLS', cls: 'badge-xls' };
    if (item.type === 'video' || name.endsWith('.mp4') || name.endsWith('.flv') || name.endsWith('.m3u8')) return { label: '视频', cls: 'badge-video' };
    if (item.type === 'audio' || name.endsWith('.mp3') || name.endsWith('.m4a')) return { label: '音频', cls: 'badge-audio' };
    if (name.endsWith('.zip') || name.endsWith('.rar')) return { label: 'ZIP', cls: 'badge-zip' };
    return { label: '文件', cls: 'badge-other' };
  }

  function downloadFile(file) {
    if (currentTab && currentTab.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        type: 'TRIGGER_PAGE_DOWNLOAD',
        item: file
      }).catch(() => {
        chrome.runtime.sendMessage({ type: 'DOWNLOAD_SINGLE', item: file });
      });
    } else {
      chrome.runtime.sendMessage({ type: 'DOWNLOAD_SINGLE', item: file });
    }
  }

  function renderFiles(files, folders) {
    currentFiles = files || [];
    const count = currentFiles.length;
    fileSummaryEl.textContent = `检测到 ${count} 个课件/资源`;
    batchDownloadBtn.disabled = count === 0;

    if (count === 0) {
      fileListEl.innerHTML = '';
      if (folders && folders.length > 0) {
        emptyStateEl.style.display = 'block';
        emptyStateEl.innerHTML = `
          <div style="text-align:left; padding: 10px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; font-size: 12px; color: #d46b08; line-height: 1.6;">
            <strong>📁 检测到当前目录包含 ${folders.length} 个文件夹：</strong><br>
            <span style="color:#666;">请在网页中点击进入具体的作业/资料文件夹，助手将自动嗅探并下载内部文件！</span>
            <ul style="margin-top: 6px; padding-left: 18px; max-height: 140px; overflow-y: auto; color: #333;">
              ${folders.map(f => `<li>📁 ${f.name}</li>`).join('')}
            </ul>
          </div>
        `;
      } else {
        emptyStateEl.style.display = 'block';
        emptyStateEl.innerHTML = `
          <svg viewBox="0 0 1024 1024" width="48" height="48" fill="#d9d9d9">
            <path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8zM604 139.4l156.6 156.6H604V139.4zM792 896H240V128h300v200c0 17.7 14.3 32 32 32h220v536z"/>
          </svg>
          <p class="empty-text">当前页面未检测到直接文件</p>
          <p class="empty-hint">若有文件夹，请点击进入具体文件夹后查看</p>
        `;
      }
      return;
    }

    emptyStateEl.style.display = 'none';
    fileListEl.innerHTML = '';

    currentFiles.forEach((file) => {
      const typeInfo = getTypeInfo(file);
      const li = document.createElement('li');
      li.className = 'file-card';

      li.innerHTML = `
        <div class="file-card-main">
          <span class="type-badge ${typeInfo.cls}">${typeInfo.label}</span>
          <div class="file-card-info">
            <div class="file-card-title" title="${file.name || '未命名文件'}">${file.name || '未命名文件'}</div>
            <div class="file-card-meta">
              <span>${file.source || '课件'}</span>
              ${file.sizeText ? `<span>${file.sizeText}</span>` : (file.size ? `<span>${formatSize(file.size)}</span>` : '')}
            </div>
          </div>
        </div>
        <div class="file-card-actions">
          <button class="btn-card-action primary btn-download-item" title="保存原始格式">下载</button>
          <button class="btn-card-action btn-copy-item" title="复制直链">复制</button>
        </div>
      `;

      li.querySelector('.btn-download-item').addEventListener('click', () => {
        downloadFile(file);
        li.querySelector('.btn-download-item').textContent = '已下载';
      });

      li.querySelector('.btn-copy-item').addEventListener('click', async () => {
        if (file.objectid) {
          chrome.runtime.sendMessage({
            type: 'RESOLVE_OBJECT_INFO',
            objectid: file.objectid
          }, (res) => {
            const u = (res && res.data && res.data.download) ? res.data.download : file.url;
            if (u) {
              navigator.clipboard.writeText(u);
              li.querySelector('.btn-copy-item').textContent = '已复制';
              setTimeout(() => { li.querySelector('.btn-copy-item').textContent = '复制'; }, 1800);
            }
          });
        } else if (file.url) {
          navigator.clipboard.writeText(file.url);
          li.querySelector('.btn-copy-item').textContent = '已复制';
          setTimeout(() => { li.querySelector('.btn-copy-item').textContent = '复制'; }, 1800);
        }
      });

      fileListEl.appendChild(li);
    });
  }

  async function fetchFiles() {
    if (!currentTab || !currentTab.id) return;
    try {
      chrome.tabs.sendMessage(currentTab.id, { type: 'GET_PAGE_FILES' }, (res) => {
        if (res && res.files) {
          renderFiles(res.files, res.folders);
        } else {
          fallbackToBackground();
        }
      });
    } catch (e) {
      fallbackToBackground();
    }
  }

  function fallbackToBackground() {
    if (!currentTab || !currentTab.id) return;
    chrome.runtime.sendMessage({
      type: 'GET_TAB_FILES',
      tabId: currentTab.id
    }, (res) => {
      renderFiles(res ? res.files : [], []);
    });
  }

  batchDownloadBtn.addEventListener('click', () => {
    if (currentFiles.length === 0) return;
    batchDownloadBtn.disabled = true;
    batchDownloadBtn.textContent = '下载中...';
    currentFiles.forEach((f, idx) => {
      setTimeout(() => downloadFile(f), idx * 1500);
    });
    setTimeout(() => {
      batchDownloadBtn.textContent = '全部下载';
      batchDownloadBtn.disabled = false;
    }, currentFiles.length * 1500);
  });

  refreshBtn.addEventListener('click', () => {
    fetchFiles();
  });

  fetchFiles();
});
