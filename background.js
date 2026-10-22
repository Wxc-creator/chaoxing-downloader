/**
 * background.js - Chrome Extension Service Worker (v1.2.1 云盘直链穿透与真实文件保障版)
 * 1. 后台特权拉取官方动态鉴权直链与 Pan/cldisk 穿透直链，彻底突破禁止下载与 403
 * 2. 注册 onDeterminingFilename 确保 Chrome/Edge 下载器 100% 识别原始 PDF/RAR 扩展名与完整中文名
 * 3. 拦截防御小于100字节的“无效的参数/无权限”纯文本错误，确保下载的均为有效完整文件
 */

const tabFilesMap = new Map();
const downloadFilenameMap = new Map();

const DEFAULT_SETTINGS = {
  showFloatingButton: true,
  autoUnlockRestrictions: true,
  batchDelayMs: 1200
};

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items || DEFAULT_SETTINGS);
    });
  });
}

function sanitizeFilename(filename) {
  if (!filename) return '超星课件.pdf';
  return filename
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .trim()
    .replace(/\.+$/, '');
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 32768; // 32KB
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// 关键：监听 Chromium 下载重命名事件，强制覆盖系统默认的“下载”无后缀命名
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const customName = downloadFilenameMap.get(item.id) || downloadFilenameMap.get(item.url);
  if (customName) {
    suggest({ filename: customName, conflictAction: 'uniquify' });
    downloadFilenameMap.delete(item.id);
  } else {
    suggest();
  }
});

// 异步解析 objectid 获取官方带有动态鉴权签名的真实高速直链与文件名
async function fetchObjectStatus(objectid) {
  if (!objectid) return null;
  const hosts = [
    'https://mooc2-ans.chaoxing.com',
    'https://mooc1.chaoxing.com',
    'https://mooc1-1.chaoxing.com'
  ];

  for (const host of hosts) {
    try {
      const response = await fetch(`${host}/ananas/status/${objectid}?k=&_dc=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': `${host}/`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && (data.download || data.pdf || data.http || data.httphd)) {
          return data;
        }
      }
    } catch (e) {}
  }
  return null;
}

// 核心突破：解析超星泛雅/学习通课程资料库(Pan/cldisk)动态预览直链，彻底突破禁止下载与权限校验
async function resolveCourseDataDownloadUrl(item) {
  let previewUrl = item.previewUrl;

  // 1. 如果没有 previewUrl 且有 dataId，请求 get-preview-url
  if (!previewUrl && item.dataId) {
    const courseid = item.courseid || '';
    const clazzid = item.clazzid || '';
    const cpi = item.cpi || '';
    const endpoint = `https://mooc2-ans.chaoxing.com/mooc2-ans/coursedata/get-preview-url?dataId=${item.dataId}&cpi=${cpi}&clazzid=${clazzid}&ut=s&courseid=${courseid}`;
    try {
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Referer': 'https://mooc2-ans.chaoxing.com/'
        },
        credentials: 'include'
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.status && json.url) {
          previewUrl = json.url;
        }
      }
    } catch (e) {
      console.warn('[超星下载助手] fetch get-preview-url failed:', e);
    }
  }

  // 2. 如果成功拿到 previewUrl (pan-yz.chaoxing.com/screen/v2/file_...)
  if (previewUrl) {
    try {
      const screenResp = await fetch(previewUrl, {
        method: 'GET',
        headers: {
          'Referer': 'https://mooc2-ans.chaoxing.com/'
        }
      });
      if (screenResp.ok) {
        const screenHtml = await screenResp.text();
        const match = screenHtml.match(/https?:\/\/d0\.cldisk\.com\/download\/[a-zA-Z0-9]+[^\s"']+/i);
        if (match) {
          return match[0].replace(/&amp;/g, '&');
        }
      }
    } catch (e) {
      console.warn('[超星下载助手] fetch preview screen failed:', e);
    }
  }

  return null;
}

// 拉取文件并获取 Base64 数据（供前台直接生成 Blob 保证 100% 正确扩展名）
async function fetchFileDataBase64(item) {
  let targetUrl = item.url;
  let finalFilename = item.name;

  // 1. 优先尝试云盘资料穿透直链解析 (针对课程资料库、禁止下载的课件等)
  if (item.dataId || item.previewUrl) {
    try {
      const cldiskUrl = await resolveCourseDataDownloadUrl(item);
      if (cldiskUrl) {
        targetUrl = cldiskUrl;
      }
    } catch (e) {
      console.warn('[超星下载助手] resolveCourseDataDownloadUrl error:', e);
    }
  }

  // 2. 若未解析到，尝试传统章节 ananas/status 动态直链
  if (!targetUrl && item.objectid) {
    const statusData = await fetchObjectStatus(item.objectid);
    if (statusData) {
      targetUrl = statusData.download || statusData.httphd || statusData.http || statusData.pdf;
      if (statusData.filename) {
        finalFilename = statusData.filename;
      }
    }
  }

  // 3. 降级使用传统 coursedata 下载接口
  if (!targetUrl && item.dataId) {
    const cid = item.courseid ? `&courseId=${item.courseid}` : '';
    const clid = item.clazzid ? `&classId=${item.clazzid}` : '';
    const cpi = item.cpi ? `&cpi=${item.cpi}` : '';
    targetUrl = `https://mooc1.chaoxing.com/coursedata/downloadData?dataId=${item.dataId}&ut=s${cid}${clid}${cpi}`;
  }

  if (!targetUrl) {
    throw new Error('未能解析到有效的下载地址');
  }

  targetUrl = targetUrl.replace('http://', 'https://');
  finalFilename = sanitizeFilename(finalFilename || '超星课件');

  if (!/\.[a-zA-Z0-9]{2,5}$/.test(finalFilename)) {
    if (item.fileType) {
      finalFilename += item.fileType.startsWith('.') ? item.fileType : '.' + item.fileType;
    } else {
      finalFilename += '.pdf';
    }
  }

  const reqHeaders = {};
  if (targetUrl.includes('cldisk.com')) {
    reqHeaders['Referer'] = 'https://pan-yz.chaoxing.com/';
  } else {
    reqHeaders['Referer'] = 'https://mooc2-ans.chaoxing.com/';
  }

  const fileRes = await fetch(targetUrl, {
    method: 'GET',
    headers: reqHeaders
  });

  if (!fileRes.ok) {
    throw new Error('文件下载响应状态异常: ' + fileRes.status);
  }

  const buffer = await fileRes.arrayBuffer();

  // 关键防护：严防将“无效的参数”、“无权限下载”等 15 字节纯文本错误当作正常课件保存
  if (buffer.byteLength < 100) {
    const errorText = new TextDecoder('utf-8').decode(buffer);
    if (
      errorText.includes('无效') ||
      errorText.includes('权限') ||
      errorText.includes('403') ||
      errorText.includes('Forbidden') ||
      errorText.includes('错误') ||
      errorText.includes('error')
    ) {
      throw new Error(`平台拦截提示: [${errorText.trim()}]`);
    }
  }

  const base64Data = bufferToBase64(buffer);

  return {
    filename: finalFilename,
    base64: base64Data,
    size: buffer.byteLength
  };
}

// 后台直接下载执行器
async function executeDownload(item) {
  const result = await fetchFileDataBase64(item);
  const dataUrl = `data:application/octet-stream;base64,${result.base64}`;

  return new Promise((resolve, reject) => {
    // 提前在 map 中登记该 URL 对应的真实文件名
    downloadFilenameMap.set(dataUrl, result.filename);

    chrome.downloads.download({
      url: dataUrl,
      filename: result.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        if (downloadId) {
          downloadFilenameMap.set(downloadId, result.filename);
        }
        resolve(downloadId);
      }
    });
  });
}

// 批量下载
async function executeBatchDownload(items) {
  const settings = await getSettings();
  const delay = settings.batchDelayMs || 1500;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await executeDownload(item);
      successCount++;
    } catch (err) {
      console.error(`[超星下载助手] 下载失败: ${item.name}`, err);
      failCount++;
    }
    if (i < items.length - 1) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { successCount, failCount, total: items.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  switch (message.type) {
    case 'REPORT_TAB_FILES': {
      if (tabId) {
        tabFilesMap.set(tabId, message.files || []);
        const count = (message.files || []).length;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '', tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#1890ff', tabId: tabId });
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'GET_TAB_FILES': {
      const targetTabId = message.tabId || tabId;
      const files = tabFilesMap.get(targetTabId) || [];
      sendResponse({ files });
      break;
    }

    // 前台请求后台拉取数据并返回给前台生成原生扩展名文件
    case 'FETCH_FILE_DATA': {
      fetchFileDataBase64(message.item)
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'DOWNLOAD_SINGLE': {
      executeDownload(message.item)
        .then((downloadId) => sendResponse({ success: true, downloadId }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'DOWNLOAD_BATCH': {
      executeBatchDownload(message.items)
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'RESOLVE_OBJECT_INFO': {
      (async () => {
        let dlUrl = null;
        let filename = message.item ? message.item.name : '';
        if (message.item) {
          dlUrl = await resolveCourseDataDownloadUrl(message.item);
        }
        if (!dlUrl && message.objectid) {
          const data = await fetchObjectStatus(message.objectid);
          if (data) {
            dlUrl = data.download || data.httphd || data.http || data.pdf;
            filename = data.filename || filename;
          }
        }
        if (dlUrl) {
          return { download: dlUrl, filename: filename };
        }
        return null;
      })()
        .then((data) => sendResponse({ success: !!data, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'GET_SETTINGS': {
      getSettings().then(settings => sendResponse(settings));
      return true;
    }

    case 'SAVE_SETTINGS': {
      chrome.storage.sync.set(message.settings, () => {
        sendResponse({ success: true });
      });
      return true;
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabFilesMap.delete(tabId);
});

console.log('[超星学习通下载助手] Background Service Worker (v1.2.1) 已就绪');
