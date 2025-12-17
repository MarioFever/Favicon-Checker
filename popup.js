document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const tableBody = document.getElementById('results-body');
  const refreshBtn = document.getElementById('refresh-btn');
  const generateBtn = document.getElementById('generate-btn');
  const svgUpload = document.getElementById('svg-upload');
  
  // New Sections
  const recContainer = document.getElementById('recommendations-container');
  const recList = document.getElementById('recommendations-list');
  const rawContainer = document.getElementById('raw-assets-container');
  const rawBody = document.getElementById('raw-body');

  refreshBtn.addEventListener('click', scan);
  
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      svgUpload.click();
    });
  }

  if (svgUpload) {
    svgUpload.addEventListener('change', handleSvgUpload);
  }

  async function scan() {
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    recList.innerHTML = '';
    rawBody.innerHTML = '';
    recContainer.classList.add('hidden');
    rawContainer.classList.add('hidden');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Handle the new object structure
      const data = results[0].result;
      
      if (data && data.feverReport) {
        renderFeverResults(data.feverReport);
        renderRecommendations(data.recommendations);
        renderRawAssets(data.allAssets);
      } else {
        // Fallback for old content.js version just in case (shouldn't happen)
        if (Array.isArray(data)) {
           renderFeverResults(data);
        }
      }

    } catch (e) {
      console.error(e);
      tableBody.innerHTML = `<tr><td colspan="5" style="color: #e74c3c; text-align: center; padding: 20px;">
        Error: Cannot access this page. <br>
        <span style="font-size: 11px; opacity: 0.7;">(Try refreshing the page or checking a valid URL)</span>
      </td></tr>`;
    } finally {
      loading.classList.add('hidden');
    }
  }

  function renderFeverResults(report) {
    if (!report || report.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No results found.</td></tr>';
      return;
    }

    report.forEach(item => {
      const row = document.createElement('tr');
      
      let statusHtml = '';
      if (item.status === 'ok') {
        statusHtml = '<span class="status-icon status-ok">✓</span>';
      } else if (item.status === 'warning') {
        statusHtml = '<span class="status-icon status-warning">⚠</span>';
      } else {
        statusHtml = '<span class="status-icon status-error">✕</span>';
      }

      let previewHtml = '-';
      if (item.foundUrl) {
        previewHtml = `<a href="${item.foundUrl}" target="_blank"><img src="${item.foundUrl}" class="preview-img" onerror="this.style.display='none'"></a>`;
      }

      let detailsHtml = item.message || '';
      if (item.found && item.status !== 'ok') {
         detailsHtml += ` <span style="font-size:10px; opacity:0.7">(${item.foundDetails})</span>`;
      }

      // Action button for SVG
      let actionHtml = '';
      if (item.format === 'svg' && item.status === 'ok' && item.foundUrl) {
        const btnId = 'gen-all-' + Math.random().toString(36).substr(2, 9);
        actionHtml = `<button id="${btnId}" class="gen-mini-btn" title="Generate all formats">Gen All</button>`;
        setTimeout(() => {
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.addEventListener('click', () => generateFromUrl(item.foundUrl));
          }
        }, 0);
      }

      row.innerHTML = `
        <td>${item.format}</td>
        <td>${item.size}</td>
        <td>${item.type || '-'}</td>
        <td style="text-align: center;">${statusHtml} ${previewHtml}</td>
        <td style="vertical-align: middle;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span>${detailsHtml}</span>
            ${actionHtml}
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  function renderRecommendations(recs) {
    if (!recs || recs.length === 0) return;
    
    recContainer.classList.remove('hidden');
    recs.forEach(rec => {
      const div = document.createElement('div');
      div.className = `recommendation-item rec-${rec.type}`;
      div.innerHTML = `
        <span class="rec-icon">${rec.type === 'error' ? '✕' : rec.type === 'warning' ? '⚠' : 'ℹ'}</span>
        <span class="rec-text">${rec.text}</span>
      `;
      recList.appendChild(div);
    });
  }

  function renderRawAssets(assets) {
    if (!assets || assets.length === 0) return;

    rawContainer.classList.remove('hidden');
    assets.forEach(asset => {
      const row = document.createElement('tr');
      const preview = `<a href="${asset.url}" target="_blank"><img src="${asset.url}" class="preview-img" style="width:24px;height:24px;object-fit:contain;"></a>`;
      const downloadLink = `<a href="${asset.url}" download target="_blank" class="raw-link">Download</a>`;
      
      row.innerHTML = `
        <td style="text-align:center;">${preview}</td>
        <td><span style="display:block;font-weight:600;font-size:11px;">${asset.rel}</span><span style="font-size:10px;opacity:0.7;">${asset.source}</span></td>
        <td>${asset.sizes}</td>
        <td>${asset.realSize}</td>
        <td>${downloadLink}</td>
      `;
      rawBody.appendChild(row);
    });
  }

  // --- SVG Logic ---
  async function generateFromUrl(svgUrl) {
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Fetching SVG...';
    generateBtn.disabled = true;

    try {
        const response = await fetch(svgUrl);
        if (!response.ok) throw new Error('Failed to fetch SVG');
        const svgContent = await response.text();
        await processSvgAndDownload(svgContent);
    } catch (err) {
        console.error(err);
        alert('Error: ' + err.message);
    } finally {
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    }
  }
  
  async function handleSvgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'image/svg+xml') {
      alert('Please select a valid SVG file.');
      return;
    }
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    try {
      const svgContent = await file.text();
      await processSvgAndDownload(svgContent);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      generateBtn.textContent = originalText;
      generateBtn.disabled = false;
      svgUpload.value = '';
    }
  }

  async function processSvgAndDownload(svgContent) {
      const zip = new MinZip();
      zip.add('favicon.svg', new TextEncoder().encode(svgContent));
      const img = new Image();
      const svgBlob = new Blob([svgContent], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(svgBlob);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const sizes = [
        { name: 'favicon.ico', w: 48, h: 48 },
        { name: 'favicon-32x32.png', w: 32, h: 32 },
        { name: 'favicon-16x16.png', w: 16, h: 16 },
        { name: 'apple-touch-icon.png', w: 180, h: 180 },
        { name: 'mstile-150x150.png', w: 150, h: 150 },
        { name: 'android-chrome-192x192.png', w: 192, h: 192 },
        { name: 'android-chrome-512x512.png', w: 512, h: 512 }
      ];
      for (const size of sizes) {
        const canvas = document.createElement('canvas');
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size.w, size.h);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const arrayBuffer = await blob.arrayBuffer();
        zip.add(size.name, new Uint8Array(arrayBuffer));
      }
      const zipBlob = zip.generate();
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'favicons.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      URL.revokeObjectURL(url);
  }
  
  scan();
});

// Minimal ZIP Implementation
class MinZip {
  constructor() {
    this.files = [];
  }
  add(name, data) {
    this.files.push({ name, data });
  }
  generate() {
    const parts = [];
    let offset = 0;
    const centralDir = [];
    // CRC32 Table
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      crcTable[n] = c;
    }
    const crc32 = (buf) => {
      let crc = -1;
      for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
      return (crc ^ -1) >>> 0;
    };
    for (const file of this.files) {
      const nameBuf = new TextEncoder().encode(file.name);
      const crc = crc32(file.data);
      const size = file.data.length;
      const header = new Uint8Array(30 + nameBuf.length);
      const v = new DataView(header.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 0x000A, true);
      v.setUint16(6, 0x0000, true);
      v.setUint16(8, 0x0000, true);
      v.setUint16(10, 0x0000, true); 
      v.setUint16(12, 0x0000, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, size, true);
      v.setUint32(22, size, true);
      v.setUint16(26, nameBuf.length, true);
      v.setUint16(28, 0, true);
      header.set(nameBuf, 30);
      parts.push(header);
      parts.push(file.data);
      const cdir = new Uint8Array(46 + nameBuf.length);
      const cv = new DataView(cdir.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 0x000A, true);
      cv.setUint16(6, 0x000A, true);
      cv.setUint16(8, 0x0000, true);
      cv.setUint16(10, 0x0000, true);
      cv.setUint16(12, 0x0000, true);
      cv.setUint16(14, 0x0000, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBuf.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cdir.set(nameBuf, 46);
      centralDir.push(cdir);
      offset += header.length + size;
    }
    const cdirSize = centralDir.reduce((acc, curr) => acc + curr.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, this.files.length, true);
    ev.setUint16(10, this.files.length, true);
    ev.setUint32(12, cdirSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob([...parts, ...centralDir, eocd], { type: 'application/zip' });
  }
}
