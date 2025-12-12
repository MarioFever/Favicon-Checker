document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const tableBody = document.getElementById('results-body');
  const refreshBtn = document.getElementById('refresh-btn');

  refreshBtn.addEventListener('click', scan);

  async function scan() {
    loading.classList.remove('hidden');
    tableBody.innerHTML = '';
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    try {
      // Inject the content script logic
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      const data = results[0].result;
      renderResults(data);
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

  function renderResults(report) {
    if (!report || report.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No results found.</td></tr>';
      return;
    }

    report.forEach(item => {
      const row = document.createElement('tr');
      
      // Status Icon
      let statusHtml = '';
      if (item.status === 'ok') {
        statusHtml = '<span class="status-icon status-ok">✓</span>';
      } else if (item.status === 'warning') {
        statusHtml = '<span class="status-icon status-warning">⚠</span>';
      } else {
        statusHtml = '<span class="status-icon status-error">✕</span>';
      }

      // Preview Image
      let previewHtml = '-';
      if (item.foundUrl) {
        previewHtml = `<a href="${item.foundUrl}" target="_blank"><img src="${item.foundUrl}" class="preview-img" onerror="this.style.display='none'"></a>`;
      }

      // Details construction
      let detailsHtml = item.message || '';
      if (item.found && item.status !== 'ok') {
         detailsHtml += ` <span style="font-size:10px; opacity:0.7">(${item.foundDetails})</span>`;
      }

      row.innerHTML = `
        <td>${item.format}</td>
        <td>${item.size}</td>
        <td>${item.type || '-'}</td>
        <td style="text-align: center;">${statusHtml} ${previewHtml}</td>
        <td>${detailsHtml}</td>
      `;
      
      tableBody.appendChild(row);
    });
  }
  
  scan();
});

