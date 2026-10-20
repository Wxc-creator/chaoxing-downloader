// ==UserScript==
// @name         超星学习通课件与资料下载助手 (Tampermonkey版)
// @namespace    https://github.com/chaoxing-downloader
// @version      1.1.1
// @description  一键提取并下载超星学习通/泛雅平台的课件(PPT/PDF/Word)、课程资料、音视频及作业附件，解除教师禁止下载限制与预览隐藏。
// @author       Antigravity
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

  const customCSS = `
    .cx-tm-btn {
      position: fixed;
      right: 24px;
      bottom: 80px;
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #1890ff, #2f54eb);
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(24, 144, 255, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      z-index: 2147483640;
      user-select: none;
      transition: transform 0.2s;
    }
    .cx-tm-btn:hover { transform: scale(1.08); }
    .cx-tm-btn svg { width: 24px; height: 24px; fill: #fff; pointer-events: none; }
    .cx-tm-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: #ff4d4f;
      color: #fff;
      font-size: 11px;
      font-weight: bold;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cx-tm-panel {
      position: fixed;
      right: 24px;
      bottom: 140px;
      width: 350px;
      max-height: 480px;
      background: #ffffff;
      border: 1px solid #e8eef7;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      z-index: 2147483640;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #262626;
      overflow: hidden;
    }
    .cx-tm-header {
      padding: 10px 14px;
      background: #f7f9fc;
      border-bottom: 1px solid #e8eef7;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
    .cx-tm-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      margin: 0;
      list-style: none;
      max-height: 320px;
    }
    .cx-tm-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      margin-bottom: 6px;
      background: #fbfcfe;
      border: 1px solid #edf2f9;
      border-radius: 6px;
    }
    .cx-tm-item-title {
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }
    .cx-tm-actions { display: flex; gap: 4px; }
    .cx-tm-action-btn {
      padding: 3px 8px;
      font-size: 11px;
      border-radius: 4px;
      border: 1px solid #d9d9d9;
      background: #fff;
      cursor: pointer;
    }
    .cx-tm-action-btn.primary {
      background: #1890ff;
      color: #fff;
      border-color: #1890ff;
    }
    .cx-tm-batch-btn {
      background: #1890ff;
      color: #fff;
      border: none;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .cx-inline-dl-btn {
      margin-left: 10px !important;
      padding: 2px 8px !important;
      background: #1890ff !important;
      color: #fff !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      cursor: pointer !important;
      border: none !important;
      display: inline-block !important;
    }
    .cx-tm-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.85);
      color: #fff;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 12px;
      z-index: 2147483647;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = customCSS;
  (document.head || document.documentElement).appendChild(styleEl);

  function showToast(msg) {
    if (!isTop) {
      try { window.top.postMessage({ type: 'CX_TM_TOAST', msg }, '*'); } catch (e) {}
      return;
    }
    const t = document.createElement('div');
    t.className = 'cx-tm-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function getFileKey(item) {
    return item.objectid ? 'oid_' + item.objectid : (item.dataId ? 'did_' + item.dataId : 'url_' + item.url);
  }

  function addFile(item) {
    if (!item || (!item.objectid && !item.url && !item.dataId)) return;
    const key = getFileKey(item);
    if (!discoveredMap.has(key)) {
      discoveredMap.set(key, item);
      onFilesUpdate();
    }
  }

  function onFilesUpdate() {
    const list = Array.from(discoveredMap.values());
    if (isTop) {
      renderUI(list, discoveredFolders);
    } else {
      try {
        window.top.postMessage({ type: 'CX_TM_DISCOVERY', items: list, folders: discoveredFolders }, '*');
      } catch (e) {}
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
    showToast(`正在获取下载凭证: ${item.name}...`);
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
      btn.addEventListener('click', () => {
        panelVisible = !panelVisible;
        panel.style.display = panelVisible ? 'flex' : 'none';
      });
      document.body.appendChild(btn);

      panel = document.createElement('div');
      panel.id = 'cx-tm-floating-panel';
      panel.className = 'cx-tm-panel';
      panel.style.display = 'none';
      panel.innerHTML = `
        <div class="cx-tm-header">
          <span>超星课件下载助手</span>
          <button id="cx-tm-close" style="border:none;background:none;cursor:pointer;font-size:16px;">×</button>
        </div>
        <div style="padding:6px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f0;">
          <span id="cx-tm-count" style="font-size:12px;color:#888;">已发现 0 个文件</span>
          <button class="cx-tm-batch-btn" id="cx-tm-batch">全部下载</button>
        </div>
        <ul class="cx-tm-list" id="cx-tm-items"></ul>
      `;
      document.body.appendChild(panel);

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
      if (files.length === 0) {
        if (folders && folders.length > 0) {
          listEl.innerHTML = `
            <div style="padding:12px;background:#fffbe6;color:#d46b08;font-size:12px;border-radius:6px;line-height:1.5;">
              <strong>📁 当前目录下有 ${folders.length} 个文件夹：</strong><br>
              请在网页中<strong>点击进入具体的文件夹</strong>（如某位同学的作业），助手将自动嗅探并下载内部文件！
            </div>
          `;
        } else {
          listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#999;">正在嗅探中...</div>`;
        }
      } else {
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
