/**
 * content.js - 超星学习通课件与资料下载助手 (v1.2.1 资料库穿透与全景文件树版)
 * 采用“后台特权拉取数据 + 前台标准 HTML5 a[download] 本地落盘”双引擎机制
 * 彻底杜绝“下载 (2)”无后缀名及15字节“无效的参数”问题，100% 精确保存为 .pdf / .rar / .png 原名原格式
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

  async function triggerDownload(fileItem) {
    showToast(`正在高速下载: ${fileItem.name || '课件'}...`);
    const ctx = getCourseContext();
    const itemToSend = Object.assign({}, fileItem, {
      courseid: fileItem.courseid || ctx.courseid,
      clazzid: fileItem.clazzid || ctx.clazzid,
      cpi: fileItem.cpi || ctx.cpi
    });

    // 如果是资料库课件且有 dataId，前台同源尝试预取 previewUrl，双保险
    if (itemToSend.dataId && !itemToSend.previewUrl && itemToSend.courseid && itemToSend.clazzid) {
      try {
        const pUrl = `/mooc2-ans/coursedata/get-preview-url?dataId=${itemToSend.dataId}&cpi=${itemToSend.cpi || ''}&clazzid=${itemToSend.clazzid}&ut=s&courseid=${itemToSend.courseid}`;
        const pResp = await fetch(pUrl, { credentials: 'include' });
        if (pResp.ok) {
          const pData = await pResp.json();
          if (pData && pData.status && pData.url) {
            itemToSend.previewUrl = pData.url;
          }
        }
      } catch (e) {
        console.warn('Pre-fetching preview url in content failed, background will resolve it', e);
      }
    }

    try {
      chrome.runtime.sendMessage({
        type: 'FETCH_FILE_DATA',
        item: itemToSend
      }, (res) => {
        if (res && res.success && res.base64) {
          saveBase64AsFile(res.base64, res.filename || itemToSend.name);
          showToast(`下载完成: ${res.filename || itemToSend.name}`);
        } else {
          // 降级使用 background download
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_SINGLE',
            item: itemToSend
          }, (downRes) => {
            if (downRes && downRes.success) {
              showToast(`已开始下载: ${itemToSend.name}`);
            } else {
              const errMsg = (res && res.error) || (downRes && downRes.error) || '网络异常';
              showToast(`下载失败: ${errMsg}`);
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
        const ctx = getCourseContext();
        const fileItem = {
          source: '课程资料库',
          name: rawName || '课程资料',
          objectid: objectId,
          dataId: dataId,
          courseid: ctx.courseid,
          clazzid: ctx.clazzid,
          cpi: ctx.cpi,
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

  // ================= 悬浮窗 UI 与联动自适应系统 =================

  let floatingPos = {
    x: Math.max(20, window.innerWidth - 76),
    y: Math.max(20, window.innerHeight - 96)
  };
  let currentActiveTab = 'files'; // 'files' | 'tree'
  let courseFileTree = null;
  let isScanningTree = false;

  // 获取当前课程上下文参数 (courseid, clazzid, cpi, enc)
  function getCourseContext() {
    let courseid = '', clazzid = '', cpi = '', enc = '';

    // 1. 优先从超星标准 DOM 隐藏域获取（最稳定准确）
    try {
      const cIdEl = document.getElementById('courseId') || document.getElementById('courseid') || document.querySelector('input[name="courseId"]');
      if (cIdEl && cIdEl.value) courseid = cIdEl.value;

      const clIdEl = document.getElementById('classId') || document.getElementById('clazzid') || document.querySelector('input[name="classId"]');
      if (clIdEl && clIdEl.value) clazzid = clIdEl.value;

      const cpiEl = document.getElementById('cpi') || document.querySelector('input[name="cpi"]');
      if (cpiEl && cpiEl.value) cpi = cpiEl.value;
    } catch (e) {}

    // 2. 从当前 URL / 父级 iframe / Referrer 中解析
    const urlsToSearch = [location.href, document.referrer || ''];
    try {
      if (window.top && window.top.location.href) urlsToSearch.push(window.top.location.href);
    } catch (e) {}

    for (const u of urlsToSearch) {
      if (!u) continue;
      try {
        const parsed = new URL(u, location.origin);
        if (!courseid) courseid = parsed.searchParams.get('courseid') || parsed.searchParams.get('courseId') || '';
        if (!clazzid) clazzid = parsed.searchParams.get('clazzid') || parsed.searchParams.get('clazzId') || parsed.searchParams.get('classId') || '';
        if (!cpi) cpi = parsed.searchParams.get('cpi') || '';
        if (!enc) enc = parsed.searchParams.get('enc') || '';
      } catch (e) {}
    }

    // 3. 从 Cookie 中提取兜底 (如 266674469cpi=406496632)
    if (!courseid || !cpi) {
      const m = document.cookie.match(/(\d{6,12})cpi=(\d+)/);
      if (m) {
        if (!courseid) courseid = m[1];
        if (!cpi) cpi = m[2];
      }
    }
    return { courseid, clazzid, cpi, enc };
  }

  // 联动坐标更新函数：同时精准驱动悬浮球与展开面板，四向智能自适应避障
  function updateLinkedPositions(animate = false) {
    const floatBtn = document.getElementById('cx-dl-floating-btn');
    const panel = document.getElementById('cx-dl-panel');
    if (!floatBtn) return;

    // 限制小球在视口内安全区域
    const minX = 12, maxX = window.innerWidth - 64;
    const minY = 12, maxY = window.innerHeight - 64;
    floatingPos.x = Math.max(minX, Math.min(maxX, floatingPos.x));
    floatingPos.y = Math.max(minY, Math.min(maxY, floatingPos.y));

    floatBtn.style.transform = `translate3d(${floatingPos.x}px, ${floatingPos.y}px, 0)`;
    floatBtn.style.transition = animate ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease' : 'none';

    if (!panel) return;

    // 计算展开面板的四向自适应尺寸与坐标
    const panelWidth = Math.min(440, window.innerWidth - 24);
    const panelHeight = Math.min(560, window.innerHeight - 40);

    let panelX, panelY;

    // 水平方向自适应：根据小球在屏幕左右半区决定向左展开还是向右展开
    if (floatingPos.x > window.innerWidth / 2) {
      panelX = floatingPos.x + 52 - panelWidth;
      if (panelX < 12) panelX = 12;
    } else {
      panelX = floatingPos.x;
      if (panelX + panelWidth > window.innerWidth - 12) panelX = window.innerWidth - panelWidth - 12;
    }

    // 垂直方向自适应：根据小球在屏幕上下半区决定向上展开还是向下展开
    if (floatingPos.y > window.innerHeight / 2) {
      panelY = floatingPos.y - panelHeight - 12;
      if (panelY < 12) {
        panelY = 12;
        panel.style.maxHeight = Math.max(260, floatingPos.y - 24) + 'px';
      } else {
        panel.style.maxHeight = panelHeight + 'px';
      }
    } else {
      panelY = floatingPos.y + 52 + 12;
      if (panelY + panelHeight > window.innerHeight - 12) {
        panel.style.maxHeight = Math.max(260, window.innerHeight - panelY - 12) + 'px';
      } else {
        panel.style.maxHeight = panelHeight + 'px';
      }
    }

    panel.style.transform = `translate3d(${panelX}px, ${panelY}px, 0)`;
    panel.style.transition = animate ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease' : 'none';
  }

  // 高性能丝滑拖拽引擎 (支持 requestAnimationFrame 60/120fps + 边缘缓冲吸附)
  function bindSmoothDraggable(handleElement, isPanelHeader = false) {
    let isDown = false;
    let hasMoved = false;
    let startX = 0, startY = 0;
    let origPosX = 0, origPosY = 0;
    let rafId = null;

    function onPointerMove(e) {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!hasMoved) {
        if (Math.hypot(dx, dy) > 5) {
          hasMoved = true;
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'grabbing';
          const floatBtn = document.getElementById('cx-dl-floating-btn');
          const panel = document.getElementById('cx-dl-panel');
          if (floatBtn) {
            floatBtn.dataset.isDragging = 'true';
            floatBtn.classList.add('cx-dragging');
          }
          if (panel) panel.classList.add('cx-dragging');
        }
      }
      if (!hasMoved) return;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          floatingPos.x = origPosX + dx;
          floatingPos.y = origPosY + dy;
          updateLinkedPositions(false);
          rafId = null;
        });
      }
    }

    function onPointerUp() {
      if (!isDown) return;
      isDown = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const floatBtn = document.getElementById('cx-dl-floating-btn');
      const panel = document.getElementById('cx-dl-panel');
      if (floatBtn) floatBtn.classList.remove('cx-dragging');
      if (panel) panel.classList.remove('cx-dragging');

      if (hasMoved) {
        // 微吸附
        if (floatingPos.x < 36) floatingPos.x = 16;
        else if (floatingPos.x > window.innerWidth - 88) floatingPos.x = window.innerWidth - 68;
        updateLinkedPositions(true);

        setTimeout(() => {
          if (floatBtn) floatBtn.dataset.isDragging = 'false';
        }, 80);
      } else {
        if (floatBtn) floatBtn.dataset.isDragging = 'false';
      }
    }

    handleElement.addEventListener('mousedown', (e) => {
      // 排除头部按钮和输入交互的点击，避免误触发拖拽
      if (e.target.closest('button') || e.target.closest('.cx-dl-btn-icon') || e.target.closest('.cx-dl-tab-btn')) {
        return;
      }
      isDown = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      origPosX = floatingPos.x;
      origPosY = floatingPos.y;

      window.addEventListener('mousemove', onPointerMove, { passive: true });
      window.addEventListener('mouseup', onPointerUp);
    });
  }

  // 文件夹内嵌层级浏览栈 (支持在插件内直接打开文件夹并展示下载)
  let folderNavStack = [];
  let activeNavFolder = null;
  let activeFolderFiles = [];

  function createFloatingUI() {
    if (!isTopWindow) return;
    if (document.getElementById('cx-dl-floating-btn')) return;

    const floatBtn = document.createElement('div');
    floatBtn.id = 'cx-dl-floating-btn';
    floatBtn.title = '超星课件与资料下载助手 (点击展开/按住可随意拖拽)';
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
      <div class="cx-dl-header" title="按住标题栏可随意拖动面板">
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

      <div class="cx-dl-tabs">
        <button class="cx-dl-tab-btn active" id="cx-tab-files">
          <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
            <path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8z"/>
          </svg>
          课程资料
        </button>
        <button class="cx-dl-tab-btn" id="cx-tab-tree">
          <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
            <path d="M880 298.4H521L437 138c-6.5-12.4-19.3-20.2-33.3-20.2H144c-22.1 0-40 17.9-40 40v696c0 22.1 17.9 40 40 40h736c22.1 0 40-17.9 40-40V338.4c0-22.1-17.9-40-40-40z"/>
          </svg>
          全课程透视
        </button>
      </div>

      <!-- 视图 1：资料与文件夹浏览器 -->
      <div id="cx-view-files" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
        <div class="cx-dl-nav-bar" id="cx-dl-nav-bar" style="display: none;">
          <div class="cx-dl-breadcrumb" id="cx-dl-breadcrumb">
            <span class="cx-dl-crumb-link" id="cx-crumb-root">🏠 资料根目录</span>
            <span style="color: #bfbfbf;">/</span>
            <span id="cx-crumb-current" style="color: #1f1f1f; font-weight: 600;"></span>
          </div>
          <button class="cx-dl-btn-back" id="cx-btn-back" title="返回上一层目录">
            <svg viewBox="0 0 1024 1024" width="10" height="10" fill="currentColor"><path d="M724 218.3V141c0-6.7-7.7-10.4-12.9-6.3L260.3 486.8a31.8 31.8 0 0 0 0 50.4l450.8 352.1c5.2 4.1 12.9.4 12.9-6.3v-77.3c0-4.8-2.3-9.3-6.1-12.2L357.2 512l360.7-281.5c3.8-2.9 6.1-7.4 6.1-12.2z"/></svg>
            返回
          </button>
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
      </div>

      <!-- 视图 2：全课程结构文件树 -->
      <div id="cx-view-tree" style="display: none; flex-direction: column; flex: 1; overflow: hidden;">
        <div class="cx-tree-container" id="cx-tree-container">
          <div class="cx-tree-scan-banner" id="cx-tree-banner">
            <div>
              <strong>全课程资料库透视</strong><br>
              <span style="color: #595959; font-size: 11px;">自动向下深度遍历整门课程的所有目录与课件</span>
            </div>
            <button class="cx-tree-scan-btn" id="cx-btn-scan-tree">
              <svg viewBox="0 0 1024 1024" width="12" height="12" fill="currentColor">
                <path d="M756.2 304.3C684.2 232.4 586.3 192 481.9 192c-197.6 0-360 144.3-390.6 332.9-1.9 11.5 6.9 21.6 18.5 21.6h63.2c9.5 0 17.5-6.7 19.1-16.1C217.4 374.3 338 274.7 481.9 274.7c81 0 156.4 31.2 212.1 86.8L618.5 437c-15.1 15.1-4.4 41 17 41h208c11 0 20-9 20-20V250c0-21.4-25.9-32.1-41-17l-66.3 71.3z"/>
              </svg>
              一键扫描
            </button>
          </div>
          <div id="cx-tree-content"></div>
        </div>
      </div>

      <div class="cx-dl-footer">
        <span>支持拖拽与四向自适应</span>
        <span>原始文件名格式保障</span>
      </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(panel);

    // 初始位置设置
    updateLinkedPositions(false);

    // 绑定小球与面板头部双向丝滑拖拽
    bindSmoothDraggable(floatBtn, false);
    bindSmoothDraggable(panel.querySelector('.cx-dl-header'), true);

    // 视口尺寸变化防跑出屏幕
    window.addEventListener('resize', () => {
      updateLinkedPositions(true);
    });

    // 点击小球展开/收起面板 (彻底杜绝拖拽干扰)
    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (floatBtn.dataset.isDragging === 'true') return;
      uiPanelVisible = !uiPanelVisible;
      panel.style.display = uiPanelVisible ? 'flex' : 'none';
      if (uiPanelVisible) {
        updateLinkedPositions(false);
        if (!activeNavFolder) {
          renderFloatingUI(Array.from(discoveredFilesMap.values()), discoveredFoldersList);
        }
      }
    });

    document.getElementById('cx-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      uiPanelVisible = false;
      panel.style.display = 'none';
    });

    document.getElementById('cx-btn-refresh').addEventListener('click', () => {
      if (activeNavFolder) {
        openFolderInPanel(activeNavFolder);
      } else {
        runAllSniffers();
        window.postMessage({ type: 'CX_INJECT_QUERY' }, '*');
        showToast('已重新扫描当前目录');
      }
    });

    // 面包屑返回上一级
    document.getElementById('cx-btn-back').addEventListener('click', () => {
      navigateBackFolder();
    });

    document.getElementById('cx-crumb-root').addEventListener('click', () => {
      folderNavStack = [];
      activeNavFolder = null;
      document.getElementById('cx-dl-nav-bar').style.display = 'none';
      renderFloatingUI(Array.from(discoveredFilesMap.values()), discoveredFoldersList);
    });

    document.getElementById('cx-btn-batch-all').addEventListener('click', () => {
      const targetFiles = activeNavFolder ? activeFolderFiles : Array.from(discoveredFilesMap.values());
      if (targetFiles.length === 0) return;
      showToast(`正在批量下载 ${targetFiles.length} 个文件...`);
      targetFiles.forEach((f, idx) => {
        setTimeout(() => triggerDownload(f), idx * 1500);
      });
    });

    // Tab 切换逻辑
    const tabFiles = document.getElementById('cx-tab-files');
    const tabTree = document.getElementById('cx-tab-tree');
    const viewFiles = document.getElementById('cx-view-files');
    const viewTree = document.getElementById('cx-view-tree');

    tabFiles.addEventListener('click', () => {
      currentActiveTab = 'files';
      tabFiles.classList.add('active');
      tabTree.classList.remove('active');
      viewFiles.style.display = 'flex';
      viewTree.style.display = 'none';
    });

    tabTree.addEventListener('click', () => {
      currentActiveTab = 'tree';
      tabTree.classList.add('active');
      tabFiles.classList.remove('active');
      viewFiles.style.display = 'none';
      viewTree.style.display = 'flex';
      if (!courseFileTree && !isScanningTree) {
        startFullCourseTreeScan();
      }
    });

    document.getElementById('cx-btn-scan-tree').addEventListener('click', () => {
      startFullCourseTreeScan();
    });
  }

  // ================= 📁 插件内直接进入文件夹与浏览 =================

  async function openFolderInPanel(folder) {
    if (!folder) return;
    activeNavFolder = folder;
    if (!folderNavStack.some(item => item.id === folder.id)) {
      folderNavStack.push(folder);
    }

    const listEl = document.getElementById('cx-file-list');
    const navBar = document.getElementById('cx-dl-nav-bar');
    const crumbCurrent = document.getElementById('cx-crumb-current');
    const countLabel = document.getElementById('cx-toolbar-count');
    const batchBtn = document.getElementById('cx-btn-batch-all');

    if (navBar) navBar.style.display = 'flex';
    if (crumbCurrent) crumbCurrent.textContent = folder.name;

    if (listEl) {
      listEl.innerHTML = `
        <div class="cx-dl-empty">
          <svg viewBox="0 0 1024 1024" style="animation: cxRotate 1.2s linear infinite;">
            <path d="M756.2 304.3C684.2 232.4 586.3 192 481.9 192c-197.6 0-360 144.3-390.6 332.9-1.9 11.5 6.9 21.6 18.5 21.6h63.2c9.5 0 17.5-6.7 19.1-16.1C217.4 374.3 338 274.7 481.9 274.7c81 0 156.4 31.2 212.1 86.8L618.5 437c-15.1 15.1-4.4 41 17 41h208c11 0 20-9 20-20V250c0-21.4-25.9-32.1-41-17l-66.3 71.3z"/>
          </svg>
          <div>正在打开文件夹 [${folder.name}]...</div>
        </div>
      `;
    }

    const ctx = getCourseContext();
    try {
      const { folders, files } = await fetchFolderData(ctx.courseid, ctx.clazzid, ctx.cpi, folder.id);
      activeFolderFiles = files;

      if (countLabel) {
        countLabel.textContent = `当前目录含 ${files.length} 个课件` + (folders.length > 0 ? ` / ${folders.length} 个子文件夹` : '');
      }
      if (batchBtn) batchBtn.disabled = files.length === 0;

      renderFolderContentInList(folders, files);
    } catch (e) {
      showToast('打开文件夹失败: ' + (e.message || e));
      if (listEl) {
        listEl.innerHTML = `<div class="cx-dl-empty"><div>打开失败，请刷新或重试</div></div>`;
      }
    }
  }

  function navigateBackFolder() {
    folderNavStack.pop();
    if (folderNavStack.length === 0) {
      activeNavFolder = null;
      activeFolderFiles = [];
      const navBar = document.getElementById('cx-dl-nav-bar');
      if (navBar) navBar.style.display = 'none';
      renderFloatingUI(Array.from(discoveredFilesMap.values()), discoveredFoldersList);
    } else {
      const prev = folderNavStack.pop();
      openFolderInPanel(prev);
    }
  }

  function renderFolderContentInList(folders, files) {
    const listEl = document.getElementById('cx-file-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (folders.length === 0 && files.length === 0) {
      listEl.innerHTML = `
        <div class="cx-dl-empty">
          <svg viewBox="0 0 1024 1024"><path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8z"/></svg>
          <div>此文件夹为空，没有检测到文件</div>
        </div>
      `;
      return;
    }

    // 先渲染子文件夹项 (点击直接进入该子文件夹)
    folders.forEach(sub => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'cx-dl-item-folder';
      folderDiv.innerHTML = `
        <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
          <span class="cx-dl-folder-icon">📁</span>
          <span class="cx-dl-folder-title" title="${sub.name}">${sub.name}</span>
        </div>
        <span class="cx-dl-folder-action-enter">打开文件夹 ➔</span>
      `;
      folderDiv.addEventListener('click', () => {
        openFolderInPanel(sub);
      });
      listEl.appendChild(folderDiv);
    });

    // 渲染该文件夹下的所有具体文件
    files.forEach(file => {
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
          objectid: file.objectid,
          item: file
        }, (res) => {
          const u = (res && res.data && (res.data.download || res.data.url)) ? (res.data.download || res.data.url) : file.url;
          if (u) copyToClipboard(u);
          else showToast('无法解析直链');
        });
      });

      listEl.appendChild(li);
    });
  }

  // ================= 🌳 递归爬取全课程文件树 =================

  async function fetchFolderData(courseid, clazzid, cpi, dataId = '') {
    const url = `/mooc2-ans/coursedata/stu-datalist?courseid=${courseid}&clazzid=${clazzid}&cpi=${cpi}&dataId=${dataId}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const htmlText = await resp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const items = doc.querySelectorAll('ul.dataBody_td, .dataBody_td');

    const folders = [];
    const files = [];

    items.forEach(el => {
      const type = (el.getAttribute('type') || '').toLowerCase();
      let rawName = el.getAttribute('dataName') || el.getAttribute('dataname') || '';
      try { rawName = decodeURIComponent(rawName); } catch (e) {}

      const objectId = el.getAttribute('objectId') || el.getAttribute('objectid') || '';
      const id = el.getAttribute('id') || el.getAttribute('dataid') || '';

      const sizeEl = el.querySelector('.dataBody_size_stu, .dataBody_size, .size');
      const sizeText = sizeEl ? sizeEl.innerText.trim() : '';

      if (type === 'afolder' || type === 'folder') {
        if (rawName) folders.push({ id, name: rawName });
      } else if (type && type !== 'tch-courseware' && (rawName || objectId)) {
        files.push({
          source: '课程资料库',
          name: rawName || '未命名文件',
          objectid: objectId,
          dataId: id,
          courseid: courseid,
          clazzid: clazzid,
          cpi: cpi,
          fileType: '.' + type,
          sizeText: sizeText,
          type: type === 'video' ? 'video' : 'document'
        });
      }
    });

    return { folders, files };
  }

  async function startFullCourseTreeScan() {
    if (isScanningTree) return;
    const ctx = getCourseContext();
    if (!ctx.courseid) {
      showToast('未检测到课程参数，请进入课程“资料”或“章节”页面');
      return;
    }

    isScanningTree = true;
    const scanBtn = document.getElementById('cx-btn-scan-tree');
    const contentEl = document.getElementById('cx-tree-content');
    if (scanBtn) scanBtn.disabled = true;

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="cx-dl-empty">
          <svg viewBox="0 0 1024 1024" style="animation: cxRotate 1.5s linear infinite;">
            <path d="M756.2 304.3C684.2 232.4 586.3 192 481.9 192c-197.6 0-360 144.3-390.6 332.9-1.9 11.5 6.9 21.6 18.5 21.6h63.2c9.5 0 17.5-6.7 19.1-16.1C217.4 374.3 338 274.7 481.9 274.7c81 0 156.4 31.2 212.1 86.8L618.5 437c-15.1 15.1-4.4 41 17 41h208c11 0 20-9 20-20V250c0-21.4-25.9-32.1-41-17l-66.3 71.3z"/>
          </svg>
          <div id="cx-tree-scan-status">正在深入探测全课程文件树...</div>
        </div>
      `;
    }

    const visitedFolders = new Set();
    let totalFilesFound = 0;

    async function walk(folderId, folderName, depth = 0) {
      if (depth > 6 || visitedFolders.has(folderId)) {
        return { id: folderId, name: folderName, folders: [], files: [] };
      }
      visitedFolders.add(folderId);

      const statusEl = document.getElementById('cx-tree-scan-status');
      if (statusEl) {
        statusEl.textContent = `正在扫描：${folderName || '根目录'} (已发现 ${totalFilesFound} 个文件)...`;
      }

      try {
        const { folders, files } = await fetchFolderData(ctx.courseid, ctx.clazzid, ctx.cpi, folderId);
        totalFilesFound += files.length;

        const subTreeNodes = [];
        for (const sub of folders) {
          const subNode = await walk(sub.id, sub.name, depth + 1);
          subTreeNodes.push(subNode);
        }

        return {
          id: folderId,
          name: folderName,
          folders: subTreeNodes,
          files: files,
          isOpen: depth < 2 // 默认展开前两层
        };
      } catch (e) {
        console.warn('Scan folder error:', e);
        return { id: folderId, name: folderName, folders: [], files: [] };
      }
    }

    try {
      showToast('开始递归扫描全课资料树...');
      const tree = await walk('', '课程根目录', 0);
      courseFileTree = tree;
      showToast(`扫描完成！共发现 ${totalFilesFound} 个课件/资料`);
      renderCourseTree(tree);
    } catch (e) {
      showToast('扫描全课程文件树失败: ' + (e.message || e));
    } finally {
      isScanningTree = false;
      if (scanBtn) scanBtn.disabled = false;
    }
  }

  // 递归收集某个文件夹下的所有文件 (用于文件夹一键批量打包)
  function collectAllFilesFromNode(node, list = []) {
    if (!node) return list;
    if (node.files && Array.isArray(node.files)) {
      list.push(...node.files);
    }
    if (node.folders && Array.isArray(node.folders)) {
      node.folders.forEach(sub => collectAllFilesFromNode(sub, list));
    }
    return list;
  }

  // 渲染文件树 DOM 节点
  function renderTreeNode(node, container) {
    if (!node) return;

    // 渲染该节点包含的子文件夹
    if (node.folders && node.folders.length > 0) {
      node.folders.forEach(folder => {
        const totalSubFiles = collectAllFilesFromNode(folder, []).length;
        const folderDiv = document.createElement('div');
        folderDiv.className = 'cx-tree-folder';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'cx-tree-folder-header';
        headerDiv.innerHTML = `
          <div class="cx-tree-folder-left">
            <span class="cx-tree-arrow ${folder.isOpen ? 'expanded' : ''}">▶</span>
            <span class="cx-tree-folder-icon">📁</span>
            <span class="cx-tree-folder-title" title="${folder.name}">${folder.name}</span>
            <span class="cx-tree-folder-badge">${totalSubFiles} 项</span>
          </div>
          <div class="cx-tree-folder-actions">
            ${totalSubFiles > 0 ? `
              <button class="cx-tree-btn-folder-dl" title="一键下载此文件夹下的所有课件">
                <svg viewBox="0 0 1024 1024" width="10" height="10" fill="currentColor">
                  <path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/>
                </svg>
                打包下载
              </button>
            ` : ''}
          </div>
        `;

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'cx-tree-children';
        childrenDiv.style.display = folder.isOpen ? 'block' : 'none';

        // 折叠 / 展开点击事件
        headerDiv.querySelector('.cx-tree-folder-left').addEventListener('click', (e) => {
          e.stopPropagation();
          folder.isOpen = !folder.isOpen;
          childrenDiv.style.display = folder.isOpen ? 'block' : 'none';
          const arrow = headerDiv.querySelector('.cx-tree-arrow');
          if (arrow) {
            if (folder.isOpen) arrow.classList.add('expanded');
            else arrow.classList.remove('expanded');
          }
        });

        // 文件夹一键批量下载
        const folderDlBtn = headerDiv.querySelector('.cx-tree-btn-folder-dl');
        if (folderDlBtn) {
          folderDlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const allFiles = collectAllFilesFromNode(folder, []);
            if (allFiles.length === 0) return;
            showToast(`正在批量下载 [${folder.name}] 中的 ${allFiles.length} 个文件...`);
            allFiles.forEach((file, idx) => {
              setTimeout(() => triggerDownload(file), idx * 1500);
            });
          });
        }

        // 递归渲染子文件夹与子文件
        renderTreeNode(folder, childrenDiv);

        folderDiv.appendChild(headerDiv);
        folderDiv.appendChild(childrenDiv);
        container.appendChild(folderDiv);
      });
    }

    // 渲染该节点下的直接文件列表
    if (node.files && node.files.length > 0) {
      node.files.forEach(file => {
        const typeInfo = getFileTypeTag(file);
        const fileDiv = document.createElement('div');
        fileDiv.className = 'cx-tree-file';
        fileDiv.innerHTML = `
          <div class="cx-tree-file-left">
            <span class="cx-tree-file-ext ${typeInfo.cls}">${typeInfo.label}</span>
            <span class="cx-tree-file-name" title="${file.name}">${file.name}</span>
            <span class="cx-tree-file-size">${file.sizeText || ''}</span>
          </div>
          <div class="cx-tree-file-actions">
            <button class="cx-tree-btn-action cx-primary cx-tree-btn-dl" title="下载原文件">下载</button>
            <button class="cx-tree-btn-action cx-tree-btn-copy" title="复制直链">直链</button>
          </div>
        `;

        fileDiv.querySelector('.cx-tree-btn-dl').addEventListener('click', () => {
          triggerDownload(file);
        });

        fileDiv.querySelector('.cx-tree-btn-copy').addEventListener('click', () => {
          showToast('正在解析直链...');
          chrome.runtime.sendMessage({
            type: 'RESOLVE_OBJECT_INFO',
            objectid: file.objectid,
            item: file
          }, (res) => {
            const u = (res && res.data && (res.data.download || res.data.url)) ? (res.data.download || res.data.url) : file.url;
            if (u) copyToClipboard(u);
            else showToast('无法解析直链');
          });
        });

        container.appendChild(fileDiv);
      });
    }
  }

  function renderCourseTree(tree) {
    const contentEl = document.getElementById('cx-tree-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const allFiles = collectAllFilesFromNode(tree, []);
    if (allFiles.length === 0) {
      contentEl.innerHTML = `
        <div class="cx-dl-empty">
          <svg viewBox="0 0 1024 1024"><path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8z"/></svg>
          <div>未扫描到课程资料文件</div>
        </div>
      `;
      return;
    }

    renderTreeNode(tree, contentEl);
  }

  function renderFloatingUI(files, folders) {
    if (!isTopWindow) return;
    createFloatingUI();

    // 如果用户当前正在插件内浏览某个子文件夹，不被后台自动扫描重置界面
    if (activeNavFolder !== null) return;

    const count = files ? files.length : 0;
    const folderCount = folders ? folders.length : 0;
    const totalCount = count + folderCount;

    const badge = document.querySelector('.cx-dl-badge');
    if (badge) {
      const showNum = count > 0 ? count : folderCount;
      badge.textContent = showNum > 99 ? '99+' : showNum;
      badge.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    const countLabel = document.getElementById('cx-toolbar-count');
    if (countLabel) {
      if (count > 0 && folderCount > 0) {
        countLabel.textContent = `当前目录含 ${count} 个课件 / ${folderCount} 个文件夹`;
      } else if (folderCount > 0) {
        countLabel.textContent = `检测到 ${folderCount} 个文件夹 (点击直接进入)`;
      } else {
        countLabel.textContent = `已嗅探到 ${count} 个课件/文件`;
      }
    }

    const batchBtn = document.getElementById('cx-btn-batch-all');
    if (batchBtn) batchBtn.disabled = count === 0;

    const listEl = document.getElementById('cx-file-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (totalCount === 0) {
      listEl.innerHTML = `
        <div class="cx-dl-empty">
          <svg viewBox="0 0 1024 1024">
            <path d="M854.6 288.6L639.4 73.4c-15.6-15.6-36.8-24.4-58.8-24.4H240c-44.2 0-80 35.8-80 80v768c0 44.2 35.8 80 80 80h544c44.2 0 80-35.8 80-80V347.4c0-22-8.8-43.2-24.4-58.8zM604 139.4l156.6 156.6H604V139.4zM792 896H240V128h300v200c0 17.7 14.3 32 32 32h220v536z"/>
          </svg>
          <div>正在嗅探当前目录下的课件...<br><small style="color: #bfbfbf;">若页面有文件夹，将在此处直接呈现并支持进入</small></div>
        </div>
      `;
      return;
    }

    // 1. 优先渲染所有检测到的文件夹：用户可以直接在插件面板内点击打开文件夹！
    if (folders && folders.length > 0) {
      folders.forEach(f => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'cx-dl-item-folder';
        folderDiv.title = `点击直接在插件中打开: ${f.name}`;
        folderDiv.innerHTML = `
          <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
            <span class="cx-dl-folder-icon">📁</span>
            <span class="cx-dl-folder-title" title="${f.name}">${f.name}</span>
          </div>
          <span class="cx-dl-folder-action-enter">打开文件夹 ➔</span>
        `;
        folderDiv.addEventListener('click', () => {
          openFolderInPanel(f);
        });
        listEl.appendChild(folderDiv);
      });
    }

    // 2. 渲染当前目录下的具体课件文件
    if (files && files.length > 0) {
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
            objectid: file.objectid,
            item: file
          }, (res) => {
            const u = (res && res.data && (res.data.download || res.data.url)) ? (res.data.download || res.data.url) : file.url;
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
