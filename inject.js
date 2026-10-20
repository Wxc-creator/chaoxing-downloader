/**
 * inject.js - 注入到宿主页面主环境(Main World)
 * 能够直接读取宿主页面的 window 全局变量，如 window.mArg, window.unitConfig 等
 */
(function () {
  'use strict';

  // 防止重复注入
  if (window.__CX_DOWNLOADER_INJECTED__) return;
  window.__CX_DOWNLOADER_INJECTED__ = true;

  function extractPageVariables() {
    const results = [];

    // 1. 检查 window.mArg (学习通章节任务点最标准的数据结构)
    try {
      if (window.mArg && window.mArg.attachments && Array.isArray(window.mArg.attachments)) {
        window.mArg.attachments.forEach((item, index) => {
          const prop = item.property || {};
          const objectid = prop.objectid || item.objectid || prop.objectId || item.objectId;
          const name = prop.name || item.name || (prop.type ? `课件_${index + 1}${prop.type}` : `课件_${index + 1}`);
          const size = prop.size || item.size || 0;
          const type = prop.type || item.type || (name.includes('.') ? '.' + name.split('.').pop() : '');
          const isVideo = item.type === 'video' || (item.mid && !objectid);

          if (objectid || item.mid) {
            results.push({
              source: 'window.mArg',
              objectid: objectid || item.mid,
              name: name,
              size: size,
              fileType: type,
              type: isVideo ? 'video' : 'document',
              jobid: item.jobid || ''
            });
          }
        });
      }
    } catch (e) {
      console.warn('[超星下载助手] 解析 window.mArg 失败:', e);
    }

    // 2. 检查 window.unitConfig
    try {
      if (window.unitConfig && window.unitConfig.knowledgeList) {
        // unitConfig 中可能包含课件节点
        const list = window.unitConfig.knowledgeList;
        if (Array.isArray(list)) {
          list.forEach(k => {
            if (k.attachments && Array.isArray(k.attachments)) {
              k.attachments.forEach(att => {
                const prop = att.property || {};
                const oid = prop.objectid || att.objectid;
                if (oid) {
                  results.push({
                    source: 'window.unitConfig',
                    objectid: oid,
                    name: prop.name || att.name || '课件附件',
                    size: prop.size || 0,
                    fileType: prop.type || '',
                    type: 'document'
                  });
                }
              });
            }
          });
        }
      }
    } catch (e) {
      // ignore
    }

    // 3. 检查 PDFViewerApplication
    try {
      if (window.PDFViewerApplication && window.PDFViewerApplication.url) {
        results.push({
          source: 'PDFViewerApplication',
          url: window.PDFViewerApplication.url,
          name: document.title ? `${document.title.replace(/[\s\-_].*$/, '')}.pdf` : '文档预览.pdf',
          fileType: '.pdf',
          type: 'pdf'
        });
      }
    } catch (e) {
      // ignore
    }

    // 4. 检查超星 videojs 实例或 flashProperties
    try {
      if (window.videojs && window.videojs.players) {
        Object.keys(window.videojs.players).forEach(id => {
          const player = window.videojs.players[id];
          if (player && typeof player.currentSrc === 'function') {
            const src = player.currentSrc();
            if (src && !src.startsWith('blob:')) {
              results.push({
                source: 'videojs',
                url: src,
                name: (document.title || '课程视频') + '.mp4',
                fileType: '.mp4',
                type: 'video'
              });
            }
          }
        });
      }
    } catch (e) {
      // ignore
    }

    return results;
  }

  function report() {
    const list = extractPageVariables();
    if (list && list.length > 0) {
      window.postMessage({
        type: 'CX_INJECT_DISCOVERY',
        items: list
      }, '*');
    }
  }

  // 监听来自 content.js 的主动触发信号
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'CX_INJECT_QUERY') {
      report();
    }
  });

  // 初次加载和延时探测（部分变量在页面 onload 之后才初始化）
  report();
  setTimeout(report, 800);
  setTimeout(report, 2500);
  setTimeout(report, 5000);
})();
