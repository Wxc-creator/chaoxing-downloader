// ==UserScript==
// @name         超星学习通课件与资料下载助手 (Tampermonkey版)
// @namespace    https://github.com/Wxc-creator/chaoxing-downloader
// @version      1.2.0
// @description  一键提取并下载超星学习通/泛雅平台的课件(PPT/PDF/Word/Excel)、课程资料、音视频及作业附件，解除教师禁止下载限制与预览隐藏，支持全课程文件树递归透视与极速下载。
// @author       Wxc-creator
// @match        *://*.chaoxing.com/*
// @match        *://*.fanya.chaoxing.com/*
// @match        *://*.ananas.chaoxing.com/*
// @match        *://*.edu.cn/*
// @run-at       document-end
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  if (window.__CX_TM_DOWNLOADER_LOADED__) return;
  window.__CX_TM_DOWNLOADER_LOADED__ = true;

  const isTop = window === window.top;
  const discoveredMap = new Map();
  const discoveredFolders = [];
  let panelVisible = false;

  let floatingPos = {
    x: Math.max(20, window.innerWidth - 76),
    y: Math.max(20, window.innerHeight - 96)
  };
  let currentActiveTab = 'files'; // 'files' | 'tree'
  let courseFileTree = null;
  let isScanningTree = false;

  const customCSS = `
    .cx-tm-btn {
      position: fixed;
      left: 0;
      top: 0;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #1890ff, #2f54eb);
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(24, 144, 255, 0.42), 0 2px 8px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      z-index: 2147483640;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      will-change: transform;
      transition: box-shadow 0.25s ease, transform 0.2s cubic-bezier(0.25, 1, 0.5, 1);
    }
    .cx-tm-btn:hover {
      box-shadow: 0 8px 24px rgba(24, 144, 255, 0.55), 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .cx-tm-btn.cx-dragging {
      cursor: grabbing !important;
      transition: none !important;
      box-shadow: 0 12px 28px rgba(24, 144, 255, 0.65), 0 6px 16px rgba(0, 0, 0, 0.25) !important;
    }
    .cx-tm-btn svg { width: 26px; height: 26px; fill: #fff; pointer-events: none; }
    .cx-tm-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: #ff4d4f;
      color: #fff;
      font-size: 11px;
      font-weight: bold;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(255, 77, 79, 0.4);
    }
    .cx-tm-panel {
      position: fixed;
      left: 0;
      top: 0;
      width: 440px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 40px);
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(210, 222, 238, 0.9);
      border-radius: 16px;
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.18), 0 4px 14px rgba(0, 0, 0, 0.08);
      z-index: 2147483640;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      color: #262626;
      overflow: hidden;
      will-change: transform;
      box-sizing: border-box;
      transition: box-shadow 0.25s ease;
    }
    .cx-tm-panel.cx-dragging {
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28), 0 8px 20px rgba(0, 0, 0, 0.12) !important;
    }
    .cx-tm-header {
      padding: 12px 16px;
      background: linear-gradient(135deg, #f7faff, #edf3fc);
      border-bottom: 1px solid #e1e9f4;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    }
    .cx-tm-header:active {
      cursor: grabbing;
    }
    .cx-tm-tabs {
      display: flex;
      background: #f0f4f9;
      padding: 4px;
      border-bottom: 1px solid #e2e8f0;
      gap: 4px;
    }
    .cx-tm-tab-btn {
      flex: 1;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      color: #595959;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .cx-tm-tab-btn.active {
      background: #ffffff;
      color: #1890ff;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }
    .cx-tm-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      margin: 0;
      list-style: none;
      max-height: 380px;
    }
    .cx-tm-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 5px;
      background: #ffffff;
      border: 1px solid #f0f2f5;
      border-radius: 6px;
    }
    .cx-tm-item:hover {
      background: #f7faff;
      border-color: #d6e4ff;
    }
    .cx-tm-item-title {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
    }
    .cx-tm-actions {
      display: flex;
      gap: 4px;
      margin-left: 8px;
    }
    .cx-tm-action-btn {
      padding: 3px 8px;
      border: 1px solid #d9d9d9;
      background: #fff;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }
    .cx-tm-action-btn:hover {
      color: #1890ff;
      border-color: #91d5ff;
      background: #e6f7ff;
    }
    .cx-tm-action-btn.primary {
      background: #1890ff;
      color: #fff;
      border-color: #1890ff;
    }
    .cx-tm-action-btn.primary:hover {
      background: #40a9ff;
    }
    .cx-inline-dl-btn {
      display: inline-flex !important;
      align-items: center !important;
      padding: 2px 8px !important;
      margin-left: 8px !important;
      background: #1890ff !important;
      color: #ffffff !important;
      font-size: 11px !important;
      border-radius: 4px !important;
      border: none !important;
      cursor: pointer !important;
      vertical-align: middle !important;
      box-shadow: 0 1px 3px rgba(24,144,255,0.3) !important;
    }
    .cx-inline-dl-btn:hover { background: #40a9ff !important; }
    .cx-tm-batch-btn {
      padding: 4px 10px;
      background: #1890ff;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .cx-tm-batch-btn:hover { background: #40a9ff; }
    .cx-tm-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 7px 16px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 2147483647;
      pointer-events: none;
    }
    /* 树形结构样式 */
    .cx-tm-tree-box {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      max-height: 380px;
    }
    .cx-tm-tree-folder {
      margin-bottom: 5px;
      border: 1px solid #f0f2f5;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }
    .cx-tm-tree-folder-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 10px;
      background: #fafbfc;
      cursor: pointer;
      user-select: none;
    }
    .cx-tm-tree-folder-head:hover { background: #f2f7ff; }
    .cx-tm-tree-arrow {
      display: inline-block;
      width: 14px;
      font-size: 10px;
      color: #8c8c8c;
      transition: transform 0.2s;
    }
    .cx-tm-tree-arrow.expanded { transform: rotate(90deg); }
    .cx-tm-tree-children {
      padding: 4px 8px 8px 14px;
      border-top: 1px solid #f0f2f5;
    }
    .cx-tm-tree-file {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 8px;
      margin: 2px 0;
      border-radius: 4px;
      background: #fafbfc;
      border: 1px solid #f0f0f0;
    }
    .cx-tm-tree-file:hover { background: #f0f7ff; border-color: #d6e4ff; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = customCSS;
  (document.head || document.documentElement).appendChild(styleEl);

  function showToast(msg) {
    if (!isTop) {
      try { window.top.postMessage({ type: 'CX_TM_TOAST', msg }, '*'); } catch (e) {}
      return;
    }
    const old = document.querySelector('.cx-tm-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'cx-tm-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 2500);
  }

  function getCourseContext() {
    const urls = [location.href, document.referrer || ''];
    try { if (window.top && window.top.location.href) urls.push(window.top.location.href); } catch (e) {}
    let courseid = '', clazzid = '', cpi = '';
    for (const u of urls) {
      if (!u) continue;
      try {
        const parsed = new URL(u, location.origin);
        if (!courseid) courseid = parsed.searchParams.get('courseid') || parsed.searchParams.get('courseId') || '';
        if (!clazzid) clazzid = parsed.searchParams.get('clazzid') || parsed.searchParams.get('clazzId') || '';
        if (!cpi) cpi = parsed.searchParams.get('cpi') || '';
      } catch (e) {}
    }
    if (!courseid) {
      const m = document.cookie.match(/(\d{6,12})cpi=(\d+)/);
      if (m) { courseid = m[1]; cpi = m[2]; }
    }
    return { courseid, clazzid, cpi };
  }

  // 联动坐标更新函数
  function updateLinkedPositions(animate = false) {
    const btn = document.getElementById('cx-tm-floating-btn');
    const panel = document.getElementById('cx-tm-floating-panel');
    if (!btn) return;

    const minX = 12, maxX = window.innerWidth - 64;
    const minY = 12, maxY = window.innerHeight - 64;
    floatingPos.x = Math.max(minX, Math.min(maxX, floatingPos.x));
    floatingPos.y = Math.max(minY, Math.min(maxY, floatingPos.y));

    btn.style.transform = `translate3d(${floatingPos.x}px, ${floatingPos.y}px, 0)`;
    btn.style.transition = animate ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s ease' : 'none';

    if (!panel) return;

    const panelWidth = Math.min(440, window.innerWidth - 24);
    const panelHeight = Math.min(560, window.innerHeight - 40);

    let panelX, panelY;
    if (floatingPos.x > window.innerWidth / 2) {
      panelX = floatingPos.x + 52 - panelWidth;
      if (panelX < 12) panelX = 12;
    } else {
      panelX = floatingPos.x;
      if (panelX + panelWidth > window.innerWidth - 12) panelX = window.innerWidth - panelWidth - 12;
    }

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

  // 丝滑拖拽绑定
  function bindSmoothDraggable(handleElement) {
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
          const btn = document.getElementById('cx-tm-floating-btn');
          const panel = document.getElementById('cx-tm-floating-panel');
          if (btn) { btn.dataset.isDragging = 'true'; btn.classList.add('cx-dragging'); }
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
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const btn = document.getElementById('cx-tm-floating-btn');
      const panel = document.getElementById('cx-tm-floating-panel');
      if (btn) btn.classList.remove('cx-dragging');
      if (panel) panel.classList.remove('cx-dragging');

      if (hasMoved) {
        if (floatingPos.x < 36) floatingPos.x = 16;
        else if (floatingPos.x > window.innerWidth - 88) floatingPos.x = window.innerWidth - 68;
        updateLinkedPositions(true);
        setTimeout(() => { if (btn) btn.dataset.isDragging = 'false'; }, 80);
      } else {
        if (btn) btn.dataset.isDragging = 'false';
      }
    }

    handleElement.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('.cx-tm-tab-btn')) return;
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

  function addFile(item) {
    if (!item) return;
    const key = item.objectid ? 'oid_' + item.objectid : (item.dataId ? 'did_' + item.dataId : 'url_' + item.url);
    if (!discoveredMap.has(key)) {
      discoveredMap.set(key, item);
      if (isTop) {
        renderUI(Array.from(discoveredMap.values()), discoveredFolders);
      } else {
        try {
          window.top.postMessage({ type: 'CX_TM_DISCOVERY', items: [item], folders: discoveredFolders }, '*');
        } catch (e) {}
      }
    }
  }

  // 获取官方鉴权直链
  async function resolveOfficialDownloadInfo(item) {
    if (item.objectid) {
      const hosts = ['https://mooc2-ans.chaoxing.com', 'https://mooc1.chaoxing.com'];
      for (const h of hosts) {
        try {
          const res = await fetch(`${h}/ananas/status/${item.objectid}?k=&_dc=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.download || data.pdf || data.httphd || data.http)) {
              return {
                url: (data.download || data.httphd || data.http || data.pdf).replace('http://', 'https://'),
                filename: data.filename || item.name
              };
            }
          }
        } catch (e) {}
      }
    }
    return { url: item.url, filename: item.name };
  }

  // 安全下载
  async function downloadFile(item) {
    showToast(`正在获取下载凭据: ${item.name}...`);
    try {
      const resolved = await resolveOfficialDownloadInfo(item);
      let targetUrl = resolved.url;
      const filename = (resolved.filename || item.name || '超星课件.pdf').replace(/[\\/:*?"<>|]/g, '_');

      if (!targetUrl) {
        showToast('未能获取到下载链接');
        return;
      }

      showToast(`正在下载: ${filename}`);

      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url: targetUrl,
          responseType: 'blob',
          headers: { 'Referer': 'https://mooc2-ans.chaoxing.com/' },
          onload: function (resp) {
            if (resp.status === 200) {
              const blobUrl = URL.createObjectURL(resp.response);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
              showToast(`下载完成: ${filename}`);
            } else {
              showToast(`下载失败: 状态码 ${resp.status}`);
            }
          },
          onerror: function () {
            showToast('网络请求失败');
          }
        });
      } else {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      showToast('下载出错: ' + e.message);
    }
  }

  function sniff() {
    document.querySelectorAll('ul.dataBody_td, .dataBody_td').forEach(el => {
      const type = (el.getAttribute('type') || '').toLowerCase();
      let rawName = el.getAttribute('dataName') || el.getAttribute('dataname') || '';
      try { rawName = decodeURIComponent(rawName); } catch (e) {}

      const objectId = el.getAttribute('objectId') || el.getAttribute('objectid') || '';
      const dataId = el.getAttribute('id') || el.getAttribute('dataid') || '';

      if (type === 'afolder' || type === 'folder') {
        if (rawName && !discoveredFolders.some(f => f.name === rawName)) {
          discoveredFolders.push({ name: rawName, id: dataId });
        }
      } else if (type && type !== 'tch-courseware' && (rawName || objectId)) {
        const fileItem = {
          objectid: objectId,
          dataId: dataId,
          name: rawName,
          type: type
        };
        addFile(fileItem);

        if (!el.querySelector('.cx-inline-dl-btn')) {
          const btn = document.createElement('button');
          btn.className = 'cx-inline-dl-btn';
          btn.textContent = '⬇ 下载';
          btn.onclick = (e) => {
            e.stopPropagation();
            downloadFile(fileItem);
          };
          const target = el.querySelector('.dataBody_time_stu, .dataBody_creater_stu') || el;
          target.appendChild(btn);
        }
      }
    });

    document.querySelectorAll('iframe[data], div[data]').forEach(el => {
      const d = el.getAttribute('data');
      if (d && d.includes('objectid')) {
        try {
          const obj = JSON.parse(d);
          if (obj.objectid) {
            addFile({
              objectid: obj.objectid,
              name: obj.name || document.title || '章节课件',
              size: obj.size || 0
            });
          }
        } catch (e) {}
      }
    });

    try {
      const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      if (w.mArg && Array.isArray(w.mArg.attachments)) {
        w.mArg.attachments.forEach(att => {
          const p = att.property || {};
          const oid = p.objectid || att.objectid;
          if (oid) {
            addFile({
              objectid: oid,
              name: p.name || att.name || '章节课件',
              size: p.size || 0
            });
          }
        });
      }
    } catch (e) {}

    const urlParams = new URLSearchParams(window.location.search);
    const fileParam = urlParams.get('file');
    if (fileParam && fileParam.startsWith('http')) {
      addFile({
        url: decodeURIComponent(fileParam),
        name: (document.title || '课件文档') + '.pdf'
      });
    }

    document.querySelectorAll('[style*="display: none"][class*="down"], #download').forEach(el => {
      el.style.display = 'inline-block';
      el.removeAttribute('hidden');
    });
  }

  // ================= 🌳 递归爬取全课程文件树 (油猴版) =================

  async function fetchFolderDataTM(courseid, clazzid, cpi, dataId = '') {
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
          fileType: '.' + type,
          sizeText: sizeText
        });
      }
    });

    return { folders, files };
  }

  async function startFullCourseTreeScanTM() {
    if (isScanningTree) return;
    const ctx = getCourseContext();
    if (!ctx.courseid) {
      showToast('未检测到课程参数，请进入课程“资料”或“章节”页面');
      return;
    }

    isScanningTree = true;
    const scanBtn = document.getElementById('cx-tm-btn-scan');
    const contentEl = document.getElementById('cx-tm-tree-content');
    if (scanBtn) scanBtn.disabled = true;

    if (contentEl) {
      contentEl.innerHTML = `<div style="text-align:center;padding:24px;color:#8c8c8c;">正在深入扫描全课程文件树...</div>`;
    }

    const visitedFolders = new Set();
    let totalFilesFound = 0;

    async function walk(folderId, folderName, depth = 0) {
      if (depth > 6 || visitedFolders.has(folderId)) {
        return { id: folderId, name: folderName, folders: [], files: [] };
      }
      visitedFolders.add(folderId);

      try {
        const { folders, files } = await fetchFolderDataTM(ctx.courseid, ctx.clazzid, ctx.cpi, folderId);
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
          isOpen: depth < 2
        };
      } catch (e) {
        return { id: folderId, name: folderName, folders: [], files: [] };
      }
    }

    try {
      showToast('开始递归扫描全课资料树...');
      const tree = await walk('', '课程根目录', 0);
      courseFileTree = tree;
      showToast(`扫描完成！共发现 ${totalFilesFound} 个课件/资料`);
      renderCourseTreeTM(tree);
    } catch (e) {
      showToast('扫描全课程文件树失败: ' + (e.message || e));
    } finally {
      isScanningTree = false;
      if (scanBtn) scanBtn.disabled = false;
    }
  }

  function collectAllFilesTM(node, list = []) {
    if (!node) return list;
    if (node.files && Array.isArray(node.files)) list.push(...node.files);
    if (node.folders && Array.isArray(node.folders)) {
      node.folders.forEach(sub => collectAllFilesTM(sub, list));
    }
    return list;
  }

  function renderTreeNodeTM(node, container) {
    if (!node) return;

    if (node.folders && node.folders.length > 0) {
      node.folders.forEach(folder => {
        const totalSubFiles = collectAllFilesTM(folder, []).length;
        const folderDiv = document.createElement('div');
        folderDiv.className = 'cx-tm-tree-folder';

        const head = document.createElement('div');
        head.className = 'cx-tm-tree-folder-head';
        head.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
            <span class="cx-tm-tree-arrow ${folder.isOpen ? 'expanded' : ''}">▶</span>
            <span>📁</span>
            <span style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${folder.name}</span>
            <span style="font-size:10px;color:#888;background:#eee;padding:1px 5px;border-radius:10px;">${totalSubFiles} 项</span>
          </div>
          ${totalSubFiles > 0 ? `<button class="cx-tm-action-btn primary btn-folder-dl" style="font-size:10px;padding:2px 6px;">打包下载</button>` : ''}
        `;

        const children = document.createElement('div');
        children.className = 'cx-tm-tree-children';
        children.style.display = folder.isOpen ? 'block' : 'none';

        head.addEventListener('click', (e) => {
          if (e.target.closest('.btn-folder-dl')) return;
          folder.isOpen = !folder.isOpen;
          children.style.display = folder.isOpen ? 'block' : 'none';
          const arr = head.querySelector('.cx-tm-tree-arrow');
          if (arr) {
            if (folder.isOpen) arr.classList.add('expanded');
            else arr.classList.remove('expanded');
          }
        });

        const dlBtn = head.querySelector('.btn-folder-dl');
        if (dlBtn) {
          dlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const allFiles = collectAllFilesTM(folder, []);
            showToast(`正在批量下载 [${folder.name}] 中的 ${allFiles.length} 个文件...`);
            allFiles.forEach((file, idx) => {
              setTimeout(() => downloadFile(file), idx * 1500);
            });
          });
        }

        renderTreeNodeTM(folder, children);
        folderDiv.appendChild(head);
        folderDiv.appendChild(children);
        container.appendChild(folderDiv);
      });
    }

    if (node.files && node.files.length > 0) {
      node.files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'cx-tm-tree-file';
        fileDiv.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
            <span style="font-size:10px;background:#e6f7ff;color:#1890ff;padding:1px 4px;border-radius:3px;font-weight:bold;">FILE</span>
            <span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${file.name}">${file.name}</span>
            <span style="font-size:10px;color:#999;">${file.sizeText || ''}</span>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="cx-tm-action-btn primary btn-dl">下载</button>
            <button class="cx-tm-action-btn btn-cp">直链</button>
          </div>
        `;
        fileDiv.querySelector('.btn-dl').addEventListener('click', () => downloadFile(file));
        fileDiv.querySelector('.btn-cp').addEventListener('click', async () => {
          const resolved = await resolveOfficialDownloadInfo(file);
          if (resolved && resolved.url) {
            if (typeof GM_setClipboard === 'function') GM_setClipboard(resolved.url);
            else navigator.clipboard.writeText(resolved.url);
            showToast('直链已复制！');
          }
        });
        container.appendChild(fileDiv);
      });
    }
  }

  function renderCourseTreeTM(tree) {
    const contentEl = document.getElementById('cx-tm-tree-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';
    const all = collectAllFilesTM(tree, []);
    if (all.length === 0) {
      contentEl.innerHTML = `<div style="text-align:center;padding:20px;color:#999;">未检测到课程资料</div>`;
      return;
    }
    renderTreeNodeTM(tree, contentEl);
  }

  function renderUI(files, folders) {
    let btn = document.getElementById('cx-tm-floating-btn');
    let panel = document.getElementById('cx-tm-floating-panel');

    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'cx-tm-floating-btn';
      btn.className = 'cx-tm-btn';
      btn.innerHTML = `
        <svg viewBox="0 0 1024 1024"><path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/></svg>
        <span class="cx-tm-badge" id="cx-tm-badge" style="display:none;">0</span>
      `;
      document.body.appendChild(btn);

      panel = document.createElement('div');
      panel.id = 'cx-tm-floating-panel';
      panel.className = 'cx-tm-panel';
      panel.style.display = 'none';
      panel.innerHTML = `
        <div class="cx-tm-header" title="按住标题栏可随意拖动面板">
          <div style="display:flex;align-items:center;gap:6px;">
            <svg viewBox="0 0 1024 1024" width="16" height="16" fill="#1890ff"><path d="M505.7 661a8 8 0 0 0 12.6 0l112-141.7c4.1-5.2.4-12.9-6.3-12.9h-74.1V168c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v338.3H400c-6.7 0-10.4 7.7-6.3 12.9l112 141.8zM878 626h-60c-4.4 0-8 3.6-8 8v154H214V634c0-4.4-3.6-8-8-8h-60c-4.4 0-8 3.6-8 8v198c0 17.7 14.3 32 32 32h684c17.7 0 32-14.3 32-32V634c0-4.4-3.6-8-8-8z"/></svg>
            <span>超星课件下载助手</span>
          </div>
          <button id="cx-tm-close" style="border:none;background:none;cursor:pointer;font-size:16px;color:#888;">×</button>
        </div>

        <div class="cx-tm-tabs">
          <button class="cx-tm-tab-btn active" id="cx-tm-tab-files">页面课件</button>
          <button class="cx-tm-tab-btn" id="cx-tm-tab-tree">全课程文件树</button>
        </div>

        <div id="cx-tm-view-files" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
          <div style="padding:6px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;">
            <span id="cx-tm-count" style="font-size:12px;color:#888;">已发现 0 个文件</span>
            <button class="cx-tm-batch-btn" id="cx-tm-batch">全部下载</button>
          </div>
          <ul class="cx-tm-list" id="cx-tm-items"></ul>
        </div>

        <div id="cx-tm-view-tree" style="display:none;flex-direction:column;flex:1;overflow:hidden;">
          <div style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center;background:#f0f7ff;border-bottom:1px solid #d6e4ff;">
            <span style="font-size:11px;color:#1d39c4;">全课文件透视扫描</span>
            <button class="cx-tm-batch-btn" id="cx-tm-btn-scan">一键扫描</button>
          </div>
          <div class="cx-tm-tree-box" id="cx-tm-tree-content"></div>
        </div>
      `;
      document.body.appendChild(panel);

      updateLinkedPositions(false);
      bindSmoothDraggable(btn);
      bindSmoothDraggable(panel.querySelector('.cx-tm-header'));

      window.addEventListener('resize', () => updateLinkedPositions(true));

      btn.addEventListener('click', () => {
        if (btn.dataset.isDragging === 'true') return;
        panelVisible = !panelVisible;
        panel.style.display = panelVisible ? 'flex' : 'none';
        if (panelVisible) updateLinkedPositions(true);
      });

      panel.querySelector('#cx-tm-close').addEventListener('click', () => {
        panelVisible = false;
        panel.style.display = 'none';
      });

      panel.querySelector('#cx-tm-batch').addEventListener('click', () => {
        const allFiles = Array.from(discoveredMap.values());
        allFiles.forEach((f, idx) => {
          setTimeout(() => downloadFile(f), idx * 1500);
        });
      });

      const tabF = panel.querySelector('#cx-tm-tab-files');
      const tabT = panel.querySelector('#cx-tm-tab-tree');
      const vF = panel.querySelector('#cx-tm-view-files');
      const vT = panel.querySelector('#cx-tm-view-tree');

      tabF.addEventListener('click', () => {
        tabF.classList.add('active');
        tabT.classList.remove('active');
        vF.style.display = 'flex';
        vT.style.display = 'none';
      });

      tabT.addEventListener('click', () => {
        tabT.classList.add('active');
        tabF.classList.remove('active');
        vF.style.display = 'none';
        vT.style.display = 'flex';
        if (!courseFileTree && !isScanningTree) startFullCourseTreeScanTM();
      });

      panel.querySelector('#cx-tm-btn-scan').addEventListener('click', () => {
        startFullCourseTreeScanTM();
      });
    }

    const badge = document.getElementById('cx-tm-badge');
    if (badge) {
      badge.textContent = files.length;
      badge.style.display = files.length > 0 ? 'flex' : 'none';
    }

    const countEl = document.getElementById('cx-tm-count');
    if (countEl) countEl.textContent = `已发现 ${files.length} 个文件`;

    const listEl = document.getElementById('cx-tm-items');
    if (listEl) {
      listEl.innerHTML = '';
      if (files.length === 0 && (!folders || folders.length === 0)) {
        listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#999;">正在嗅探中...</div>`;
      } else {
        if (folders && folders.length > 0) {
          folders.forEach(f => {
            const div = document.createElement('div');
            div.className = 'cx-tm-item';
            div.style.background = '#fcfdfe';
            div.style.border = '1px solid #d6e4ff';
            div.style.cursor = 'pointer';
            div.innerHTML = `
              <div class="cx-tm-item-title" style="color:#1d39c4;font-weight:600;">📁 ${f.name}</div>
              <span style="font-size:11px;color:#1890ff;background:#e6f7ff;padding:2px 6px;border-radius:4px;">打开 ➔</span>
            `;
            div.addEventListener('click', async () => {
              listEl.innerHTML = `<div style="text-align:center;padding:20px;color:#888;">正在打开文件夹 [${f.name}]...</div>`;
              const ctx = getCourseContext();
              try {
                const res = await fetchFolderDataTM(ctx.courseid, ctx.clazzid, ctx.cpi, f.id);
                listEl.innerHTML = `
                  <div style="padding:6px;background:#f0f5ff;display:flex;justify-content:space-between;align-items:center;border-radius:4px;margin-bottom:6px;">
                    <span style="font-weight:600;font-size:12px;">📁 ${f.name} (${res.files.length}个文件)</span>
                    <button id="cx-tm-btn-back-root" style="border:1px solid #d9d9d9;background:#fff;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px;">返回</button>
                  </div>
                `;
                document.getElementById('cx-tm-btn-back-root').onclick = () => renderUI(files, folders);
                res.files.forEach(sf => {
                  const li = document.createElement('li');
                  li.className = 'cx-tm-item';
                  li.innerHTML = `
                    <div class="cx-tm-item-title" title="${sf.name}">${sf.name}</div>
                    <div class="cx-tm-actions">
                      <button class="cx-tm-action-btn primary btn-dl">下载</button>
                      <button class="cx-tm-action-btn btn-cp">直链</button>
                    </div>
                  `;
                  li.querySelector('.btn-dl').addEventListener('click', () => downloadFile(sf));
                  li.querySelector('.btn-cp').addEventListener('click', async () => {
                    const resolved = await resolveOfficialDownloadInfo(sf);
                    if (resolved && resolved.url) {
                      if (typeof GM_setClipboard === 'function') GM_setClipboard(resolved.url);
                      else navigator.clipboard.writeText(resolved.url);
                      showToast('直链已复制！');
                    }
                  });
                  listEl.appendChild(li);
                });
              } catch (e) {
                showToast('打开文件夹失败');
              }
            });
            listEl.appendChild(div);
          });
        }
        files.forEach(f => {
          const li = document.createElement('li');
          li.className = 'cx-tm-item';
          li.innerHTML = `
            <div class="cx-tm-item-title" title="${f.name}">${f.name}</div>
            <div class="cx-tm-actions">
              <button class="cx-tm-action-btn primary btn-dl">下载</button>
              <button class="cx-tm-action-btn btn-cp">直链</button>
            </div>
          `;
          li.querySelector('.btn-dl').addEventListener('click', () => downloadFile(f));
          li.querySelector('.btn-cp').addEventListener('click', async () => {
            const resolved = await resolveOfficialDownloadInfo(f);
            if (resolved && resolved.url) {
              if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(resolved.url);
              } else {
                navigator.clipboard.writeText(resolved.url);
              }
              showToast('直链已复制！');
            }
          });
          listEl.appendChild(li);
        });
      }
    }
  }

  window.addEventListener('message', (e) => {
    if (isTop && e.data && e.data.type === 'CX_TM_DISCOVERY') {
      if (e.data.folders) {
        e.data.folders.forEach(f => {
          if (!discoveredFolders.some(item => item.name === f.name)) discoveredFolders.push(f);
        });
      }
      (e.data.items || []).forEach(addFile);
    }
    if (isTop && e.data && e.data.type === 'CX_TM_TOAST') {
      showToast(e.data.msg);
    }
  });

  sniff();
  setTimeout(sniff, 1000);
  setTimeout(sniff, 2500);
  setInterval(sniff, 3500);
})();
