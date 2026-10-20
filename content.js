/**
 * content.js - 超星学习通课件与资料下载助手 (v1.1.3 终极文件名保障版)
 * 采用“后台特权拉取数据 + 前台标准 HTML5 a[download] 本地落盘”双引擎机制
 * 彻底杜绝“下载 (2)”无后缀名问题，100% 精确保存为 .pdf / .rar / .png 原名原格式
 */

(function () {
  'use strict';

  if (window.__CX_DOWNLOADER_CONTENT_INITED__) return;
  window.__CX_DOWNLOADER_CONTENT_INITED__ = true;

  const isTopWindow = window === window.top;

  const discoveredFilesMap = new Map();
  const discoveredFoldersList = [];
  let uiPanelVisible = false;

  let userSettings = {
    showFloatingButton: true,
    autoUnlockRestrictions: true,
    batchDelayMs: 1200
  };

  function getFileKey(item) {
    if (item.objectid) return 'oid_' + item.objectid;
    if (item.dataId) return 'did_' + item.dataId;
    if (item.url) return 'url_' + item.url;
    return 'name_' + (item.name || Math.random());
  }

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileTypeTag(item) {
    const name = (item.name || '').toLowerCase();
    const type = (item.fileType || item.dataType || '').toLowerCase();
    if (name.endsWith('.ppt') || name.endsWith('.pptx') || type.includes('ppt')) return { label: 'PPT', cls: 'cx-tag-ppt' };
    if (name.endsWith('.pdf') || type.includes('pdf')) return { label: 'PDF', cls: 'cx-tag-pdf' };
    if (name.endsWith('.doc') || name.endsWith('.docx') || type.includes('doc')) return { label: 'DOC', cls: 'cx-tag-doc' };
    if (name.endsWith('.xls') || name.endsWith('.xlsx') || type.includes('xls')) return { label: 'XLS', cls: 'cx-tag-xls' };
    if (item.type === 'video' || name.endsWith('.mp4') || name.endsWith('.flv') || name.endsWith('.m3u8')) return { label: '视频', cls: 'cx-tag-video' };
    if (item.type === 'audio' || name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.wav')) return { label: '音频', cls: 'cx-tag-audio' };
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return { label: 'ZIP', cls: 'cx-tag-zip' };
    return { label: '文件', cls: 'cx-tag-other' };
  }

  function showToast(message) {
    if (!isTopWindow) {
      try {
        window.top.postMessage({ type: 'CX_SHOW_TOAST', message }, '*');
      } catch (e) {}
      return;
    }
    const oldToast = document.querySelector('.cx-dl-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'cx-dl-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 2800);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('直链已复制到剪贴板！');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      showToast('直链已复制到剪贴板！');
    } catch (e) {
      showToast('复制失败');
    }
    input.remove();
  }

  // 根据扩展名推断 MIME 类型，确保浏览器图标和格式完全匹配
  function getMimeType(filename) {
    const fn = (filename || '').toLowerCase();
    if (fn.endsWith('.pdf')) return 'application/pdf';
    if (fn.endsWith('.rar')) return 'application/x-rar-compressed';
    if (fn.endsWith('.zip')) return 'application/zip';
    if (fn.endsWith('.png')) return 'image/png';
    if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return 'image/jpeg';
    if (fn.endsWith('.doc')) return 'application/msword';
    if (fn.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (fn.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (fn.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (fn.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (fn.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (fn.endsWith('.mp4')) return 'video/mp4';
    if (fn.endsWith('.mp3')) return 'audio/mpeg';
    return 'application/octet-stream';
  }

  // 将 Base64 数据还原为 Blob 并用 HTML5 a[download] 保存，100% 锁定文件名与扩展名
  function saveBase64AsFile(base64Data, filename) {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const mime = getMimeType(filename);
    const blob = new Blob([byteNumbers], { type: mime });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename; // 浏览器下载器严格采用此名称与扩展名
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
  }

  // ================= 核心下载触发器 =================

  function triggerDownload(fileItem) {
    showToast(`正在高速下载: ${fileItem.name || '课件'}...`);
    try {
      chrome.runtime.sendMessage({
        type: 'FETCH_FILE_DATA',
        item: fileItem
      }, (res) => {
        if (res && res.success && res.base64) {
          saveBase64AsFile(res.base64, res.filename || fileItem.name);
          showToast(`下载完成: ${res.filename || fileItem.name}`);
        } else {
          // 降级使用 background download
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_SINGLE',
            item: fileItem
          }, (downRes) => {
            if (downRes && downRes.success) {
              showToast(`已开始下载: ${fileItem.name}`);
            } else {
              showToast(`下载失败: ${res ? res.error : '网络异常'}`);
            }
          });
        }
      });
    } catch (e) {
      showToast('扩展连接断开，请刷新页面后重试');
    }
  }

  // ================= 嗅探引擎 (Sniffer Engine) =================

  function addDiscoveredFile(item) {
    if (!item || (!item.objectid && !item.url && !item.dataId)) return;
    const key = getFileKey(item);
    if (!discoveredFilesMap.has(key)) {
      discoveredFilesMap.set(key, item);
      onDataUpdated();
    }
  }

  function addDiscoveredFiles(items) {
    if (!Array.isArray(items)) return;
    let added = false;
    items.forEach(item => {
      if (!item || (!item.objectid && !item.url && !item.dataId)) return;
      const key = getFileKey(item);
      if (!discoveredFilesMap.has(key)) {
        discoveredFilesMap.set(key, item);
        added = true;
      }
    });
    if (added) onDataUpdated();
  }

  function onDataUpdated() {
    const fileList = Array.from(discoveredFilesMap.values());
    if (isTopWindow) {
      renderFloatingUI(fileList, discoveredFoldersList);
      try {
        chrome.runtime.sendMessage({
          type: 'REPORT_TAB_FILES',
          files: fileList
        });
      } catch (e) {}
    } else {
      try {
        window.top.postMessage({
          type: 'CX_SUBFRAME_DISCOVERY',
          items: fileList,
          folders: discoveredFoldersList
        }, '*');
      } catch (e) {}
    }
  }

  // 1. 扫描超星新版资料列表 (ul.dataBody_td)
  function sniffMooc2DataBody() {
    const items = document.querySelectorAll('ul.dataBody_td, .dataBody_td');
    if (!items || items.length === 0) return;

    items.forEach(el => {
      const type = (el.getAttribute('type') || '').toLowerCase();
      let rawName = el.getAttribute('dataName') || el.getAttribute('dataname') || '';
      try { rawName = decodeURIComponent(rawName); } catch (e) {}

      const objectId = el.getAttribute('objectId') || el.getAttribute('objectid') || '';
      const dataId = el.getAttribute('id') || el.getAttribute('dataid') || '';

      const sizeEl = el.querySelector('.dataBody_size_stu, .dataBody_size, .size');
      const sizeText = sizeEl ? sizeEl.innerText.trim() : '';

      if (type === 'afolder' || type === 'folder') {
        if (rawName && !discoveredFoldersList.some(f => f.name === rawName)) {
          discoveredFoldersList.push({ name: rawName, id: dataId, type: 'folder' });
        }
      } else if (type && type !== 'tch-courseware' && (rawName || objectId)) {
        const fileItem = {
          source: '课程资料库',
          name: rawName || '课程资料',
          objectid: objectId,
          dataId: dataId,
          fileType: '.' + type,
          sizeText: sizeText,
          type: type === 'video' ? 'video' : 'document'
        };
        addDiscoveredFile(fileItem);
        injectInlineButtonToRow(el, fileItem);
      }
    });

    onDataUpdated();
  }

  function injectInlineButtonToRow(rowEl, fileItem) {
    if (rowEl.dataset && rowEl.dataset.cxInjected) return;
    rowEl.dataset.cxInjected = 'true';

    let targetContainer = rowEl.querySelector('.dataBody_time_stu, .dataBody_time, .dataBody_creater_stu, .dataBody_name');
    if (!targetContainer) targetContainer = rowEl;

    const btn = document.createElement('button');
    btn.className = 'cx-inline-download-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
        <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
      </svg>
      下载
    `;
    btn.title = `点击直接保存: ${fileItem.name}`;
    btn.style.marginLeft = '12px';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerDownload(fileItem);
    });

    targetContainer.appendChild(btn);
  }

  // 2. 扫描章节课件 iframe data
  function sniffDataAttributes() {
    const elements = document.querySelectorAll('iframe[data], div[data], span[data], li[data]');
    elements.forEach(el => {
      const dataAttr = el.getAttribute('data');
      if (!dataAttr || !dataAttr.includes('objectid')) return;
      try {
        const obj = JSON.parse(dataAttr);
        const oid = obj.objectid || obj.objectId;
        if (oid) {
          addDiscoveredFile({
            source: '章节课件',
            objectid: oid,
            name: obj.name || document.title || '章节课件',
            size: obj.size || 0,
            fileType: obj.type || '',
            type: obj.type === 'video' ? 'video' : 'document'
          });
        }
      } catch (e) {
        const m = dataAttr.match(/["']?objectid["']?\s*:\s*["']([a-zA-Z0-9_-]+)["']/i);
        if (m && m[1]) {
          addDiscoveredFile({
            source: '章节课件',
            objectid: m[1],
            name: document.title || '课件文件',
            type: 'document'
          });
        }
      }
    });
  }

  // 3. 扫描传统表格
  function sniffOldStyleTable() {
    const rows = document.querySelectorAll('tr, .file-item, .datum-item, .res-item');
    rows.forEach(row => {
      if (row.dataset && row.dataset.cxInjected) return;
      const nameEl = row.querySelector('.file-name, .filename, .datum-name, a[title], .name, .title');
      const name = nameEl ? (nameEl.getAttribute('title') || nameEl.innerText.trim()) : '';

      let oid = row.getAttribute('data-id') || row.getAttribute('data-objectid') || row.getAttribute('fileid');
      if (!oid) {
        const anyWithOid = row.querySelector('[data-id], [data-objectid]');
        if (anyWithOid) oid = anyWithOid.getAttribute('data-id') || anyWithOid.getAttribute('data-objectid');
      }
      if (oid && name && !row.querySelector('.cx-inline-download-btn')) {
        const fileItem = {
          source: '课程资料',
          objectid: oid,
          name: name,
          type: 'document'
        };
        addDiscoveredFile(fileItem);
        injectInlineButtonToRow(row, fileItem);
      }
    });
  }

  // 4. 扫描 PDF.js
  function sniffPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const fileParam = urlParams.get('file');
    if (fileParam) {
      try {
        const decoded = decodeURIComponent(fileParam);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          addDiscoveredFile({
            source: 'PDF预览',
            url: decoded,
            name: document.title ? `${document.title.replace(/[\s\-_].*$/, '')}.pdf` : '课件预览.pdf',
            fileType: '.pdf',
            type: 'pdf'
          });
        }
      } catch (e) {}
    }

    const hiddenButtons = document.querySelectorAll('#download, #secondaryDownload, #print, #secondaryPrint');
    hiddenButtons.forEach(btn => {
      btn.removeAttribute('hidden');
      btn.classList.remove('hidden');
      btn.style.display = 'inline-flex';
      btn.style.visibility = 'visible';
    });
  }

  // 5. 扫描媒体元素
  function sniffMediaTags() {
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((m, idx) => {
      const src = m.currentSrc || m.getAttribute('src');
      if (src && !src.startsWith('blob:') && (src.startsWith('http://') || src.startsWith('https://'))) {
        const isVideo = m.tagName.toLowerCase() === 'video';
        addDiscoveredFile({
          source: isVideo ? '视频' : '音频',
          url: src,
          name: `${document.title || '媒体文件'}_${idx + 1}.${isVideo ? 'mp4' : 'mp3'}`,
          fileType: isVideo ? '.mp4' : '.mp3',
          type: isVideo ? 'video' : 'audio'
        });
      }
    });
  }

  function unlockRestrictions() {
    if (!userSettings.autoUnlockRestrictions) return;
    document.querySelectorAll('[style*="display: none"][class*="down"], [style*="display:none"][class*="down"]').forEach(el => {
      el.classList.add('cx-unlock-shown');
      el.style.display = 'inline-block';
      el.style.visibility = 'visible';
      el.removeAttribute('disabled');
    });

    try {
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.oncopy = null;
      if (document.body && window.getComputedStyle(document.body).userSelect === 'none') {
        document.body.style.userSelect = 'auto';
      }
    } catch (e) {}
  }

  function runAllSniffers() {
    sniffMooc2DataBody();
    sniffDataAttributes();
    sniffOldStyleTable();
    sniffPdfViewer();
    sniffMediaTags();
    unlockRestrictions();
  }

  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {}
  }

  // ================= 悬浮窗 UI =================

  function createFloatingUI() {
    if (!isTopWindow) return;
    if (document.getElementById('cx-dl-floating-btn')) return;

    const floatBtn = document.createElement('div');
    floatBtn.id = 'cx-dl-floating-btn';
    floatBtn.title = '超星课件与资料下载助手 (点击展开/拖动可调整位置)';
    floatBtn.innerHTML = `
      <svg viewBox="0 0 1024 1024">
        <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
      </svg>
      <div class="cx-dl-badge" style="display: none;">0</div>
    `;

    const panel = document.createElement('div');
    panel.id = 'cx-dl-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="cx-dl-header">
        <div class="cx-dl-header-title">
          <svg viewBox="0 0 1024 1024">
            <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
          </svg>
          <span>超星文件下载助手</span>
        </div>
        <div class="cx-dl-header-actions">
          <button class="cx-dl-btn-icon" id="cx-btn-refresh" title="重新嗅探当前页面">
            <svg viewBox="0 0 1024 1024">
              <path d="M756.2 304.3C684.2 232.4 586.3 192 481.9 192c-197.6 0-360 144.3-390.6 332.9-1.9 11.5 6.9 21.6 18.5 21.6h63.2c9.5 0 17.5-6.7 19.1-16.1C217.4 374.3 338 274.7 481.9 274.7c81 0 156.4 31.2 212.1 86.8L618.5 437c-15.1 15.1-4.4 41 17 41h208c11 0 20-9 20-20V250c0-21.4-25.9-32.1-41-17l-66.3 71.3zM914.5 477.5h-63.2c-9.5 0-17.5 6.7-19.1 16.1-25.3 156.1-145.9 255.7-289.8 255.7-81 0-156.4-31.2-212.1-86.8l75.5-75.5c15.1-15.1 4.4-41-17-41h-208c-11 0-20 9-20 20v208c0 21.4 25.9 32.1 41 17l66.3-71.3c72 71.9 169.9 112.3 274.3 112.3 197.6 0 360-144.3 390.6-332.9 1.9-11.5-6.9-21.6-18.5-21.6z"/>
            </svg>
          </button>
          <button class="cx-dl-btn-icon" id="cx-btn-close" title="收起面板">
            <svg viewBox="0 0 1024 1024">
              <path d="M563.8 512l262.5-262.5c14.2-14.2 14.2-37.5 0-51.8-14.2-14.2-37.5-14.2-51.8 0L512 460.2 249.5 197.7c-14.2-14.2-37.5-14.2-51.8 0-14.2 14.2-14.2 37.5 0 51.8L460.2 512 197.7 774.5c-14.2 14.2-14.2 37.5 0 51.8 7.1 7.1 16.4 10.6 25.9 10.6s18.8-3.5 25.9-10.6L512 563.8l262.5 262.5c7.1 7.1 16.4 10.6 25.9 10.6s18.8-3.5 25.9-10.6c14.2-14.2 14.2-37.5 0-51.8L563.8 512z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="cx-dl-toolbar">
        <span id="cx-toolbar-count">已嗅探到 0 个文件</span>
        <button class="cx-dl-batch-btn" id="cx-btn-batch-all" disabled>
          <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
            <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
          </svg>
          一键下载全部
        </button>
      </div>
      <ul class="cx-dl-list" id="cx-file-list"></ul>
      <div class="cx-dl-footer">
        <span>已绕过教师禁止下载限制</span>
        <span>原始格式与文件名已锁定</span>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(panel);

    floatBtn.addEventListener('click', () => {
      if (floatBtn.dataset.isDragging === 'true') return;
      uiPanelVisible = !uiPanelVisible;
      panel.style.display = uiPanelVisible ? 'flex' : 'none';
    });

    document.getElementById('cx-btn-close').addEventListener('click', () => {
      uiPanelVisible = false;
      panel.style.display = 'none';
    });

    document.getElementById('cx-btn-refresh').addEventListener('click', () => {
      runAllSniffers();
      window.postMessage({ type: 'CX_INJECT_QUERY' }, '*');
      showToast('已重新扫描当前目录');
    });

    document.getElementById('cx-btn-batch-all').addEventListener('click', () => {
      const files = Array.from(discoveredFilesMap.values());
      if (files.length === 0) return;
      showToast(`正在批量下载 ${files.length} 个文件...`);
      files.forEach((f, idx) => {
        setTimeout(() => triggerDownload(f), idx * 1500);
      });
    });

    bindDraggable(floatBtn);
  }

  function bindDraggable(element) {
    let isDown = false;
    let startX = 0, startY = 0;
    let initialX = 0, initialY = 0;

    element.addEventListener('mousedown', (e) => {
      isDown = true;
      element.dataset.isDragging = 'false';
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      element.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) element.dataset.isDragging = 'true';
      let newLeft = Math.max(10, Math.min(window.innerWidth - 60, initialX + dx));
      let newTop = Math.max(10, Math.min(window.innerHeight - 60, initialY + dy));
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      element.style.transition = '';
      setTimeout(() => { element.dataset.isDragging = 'false'; }, 50);
    });
  }

  function renderFloatingUI(files, folders) {
    if (!isTopWindow) return;
    createFloatingUI();

    const count = files.length;
    const badge = document.querySelector('.cx-dl-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const countLabel = document.getElementById('cx-toolbar-count');
    if (countLabel) countLabel.textContent = `已嗅探到 ${count} 个课件/文件`;

    const batchBtn = document.getElementById('cx-btn-batch-all');
    if (batchBtn) batchBtn.disabled = count === 0;

    const listEl = document.getElementById('cx-file-list');
    if (!listEl) return;

    if (count === 0) {
      if (folders && folders.length > 0) {
        let folderHtml = `
          <div style="padding: 16px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; margin: 8px 4px; font-size: 12px; color: #d46b08; line-height: 1.6;">
            <strong>📁 当前目录下检测到 ${folders.length} 个文件夹：</strong><br>
            <span style="color: #8c8c8c;">文件夹不能直接单文件下载，请在网页中<strong>点击进入具体的文件夹</strong>（如同学的作业文件夹），助手将立即提取并下载内部文件！</span>
            <ul style="margin-top: 8px; padding-left: 18px; max-height: 150px; overflow-y: auto; color: #595959;">
        `;
        folders.forEach(f => { folderHtml += `<li>📁 ${f.name}</li>`; });
        folderHtml += `</ul></div>`;
        listEl.innerHTML = folderHtml;
      } else {
        listEl.innerHTML = `
          <div class="cx-dl-empty">
            <svg viewBox="0 0 1024 1024">
              <path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8zM604 139.4l156.6 156.6H604V139.4zM792 896H240V128h300v200c0 17.7 14.3 32 32 32h220v536z"/>
            </svg>
            <div>正在嗅探当前目录下的课件...<br><small style="color: #bfbfbf;">若页面有文件夹，请点击进入具体文件夹</small></div>
          </div>
        `;
      }
      return;
    }

    listEl.innerHTML = '';
    files.forEach((file) => {
      const typeInfo = getFileTypeTag(file);
      const li = document.createElement('li');
      li.className = 'cx-dl-item';

      li.innerHTML = `
        <div class="cx-dl-item-left">
          <span class="cx-dl-type-tag ${typeInfo.cls}">${typeInfo.label}</span>
          <div class="cx-dl-item-info">
            <div class="cx-dl-item-name" title="${file.name || '未命名文件'}">${file.name || '未命名文件'}</div>
            <div class="cx-dl-item-meta">
              <span>${file.source || '课件'}</span>
              ${file.sizeText ? `<span>${file.sizeText}</span>` : (file.size ? `<span>${formatFileSize(file.size)}</span>` : '')}
            </div>
          </div>
        </div>
        <div class="cx-dl-item-actions">
          <button class="cx-dl-btn-action cx-dl-btn-primary cx-action-download" title="保存原始格式">
            <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
              <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
            </svg>
            下载
          </button>
          <button class="cx-dl-btn-action cx-action-copy" title="获取直链">
            <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
              <path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v496c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V104c0-22.1-17.9-40-40-40zM704 192H192c-17.7 0-32 14.3-32 32v672c0 17.7 14.3 32 32 32h512c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zm-40 664H232V264h432v592z"/>
            </svg>
          </button>
        </div>
      `;

      li.querySelector('.cx-action-download').addEventListener('click', () => {
        triggerDownload(file);
      });

      li.querySelector('.cx-action-copy').addEventListener('click', () => {
        showToast('正在解析直链...');
        chrome.runtime.sendMessage({
          type: 'RESOLVE_OBJECT_INFO',
          objectid: file.objectid
        }, (res) => {
          const u = (res && res.data && res.data.download) ? res.data.download : file.url;
          if (u) {
            copyToClipboard(u);
          } else {
            showToast('无法解析直链');
          }
        });
      });

      listEl.appendChild(li);
    });
  }

  // ================= 跨 frame 消息监听 =================

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CX_INJECT_DISCOVERY') {
      addDiscoveredFiles(event.data.items);
    }
    if (isTopWindow && event.data && event.data.type === 'CX_SUBFRAME_DISCOVERY') {
      if (event.data.folders && Array.isArray(event.data.folders)) {
        event.data.folders.forEach(f => {
          if (!discoveredFoldersList.some(item => item.name === f.name)) {
            discoveredFoldersList.push(f);
          }
        });
      }
      addDiscoveredFiles(event.data.items);
    }
    if (isTopWindow && event.data && event.data.type === 'CX_SHOW_TOAST') {
      showToast(event.data.message);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_FILES') {
      runAllSniffers();
      sendResponse({
        files: Array.from(discoveredFilesMap.values()),
        folders: discoveredFoldersList
      });
      return true;
    }
    if (message.type === 'TRIGGER_PAGE_DOWNLOAD') {
      triggerDownload(message.item);
      sendResponse({ success: true });
      return true;
    }
    if (message.type === 'UPDATE_SETTINGS') {
      userSettings = Object.assign(userSettings, message.settings);
      const floatBtn = document.getElementById('cx-dl-floating-btn');
      if (floatBtn) {
        floatBtn.style.display = userSettings.showFloatingButton ? 'flex' : 'none';
      }
      sendResponse({ success: true });
      return true;
    }
  });

  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
      if (settings) {
        userSettings = Object.assign(userSettings, settings);
        const floatBtn = document.getElementById('cx-dl-floating-btn');
        if (floatBtn) {
          floatBtn.style.display = userSettings.showFloatingButton ? 'flex' : 'none';
        }
      }
    });
  } catch (e) {}

  injectMainWorldScript();
  runAllSniffers();
  if (isTopWindow) createFloatingUI();

  setTimeout(runAllSniffers, 800);
  setTimeout(runAllSniffers, 2000);
  setTimeout(runAllSniffers, 4000);

  const observer = new MutationObserver(() => {
    runAllSniffers();
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

})();
