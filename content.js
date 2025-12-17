(async function() {
  const report = [];
  const links = Array.from(document.querySelectorAll('link'));
  const metas = Array.from(document.querySelectorAll('meta'));

  // Helper to find link
  function findLink(rel, type, sizes, hrefSuffix) {
    return links.find(link => {
      const lRel = link.getAttribute('rel') || '';
      const lType = link.getAttribute('type');
      const lSizes = link.getAttribute('sizes');
      const lHref = link.getAttribute('href') || '';

      if (rel && !lRel.includes(rel)) return false;
      if (type && lType !== type) return false;
      if (sizes && lSizes !== sizes) return false;
      if (hrefSuffix && !lHref.endsWith(hrefSuffix)) return false;
      return true;
    });
  }

  // Helper to resolve URL
  function resolveUrl(url) {
    try {
      return new URL(url, document.baseURI).href;
    } catch(e) {
      return url;
    }
  }

  // Helper to check if image is accessible
  async function checkImage(url) {
    if (!url) return false;
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  // 1. ICO 48x48
  {
    const item = { format: 'ico', size: '48x48', type: 'image/x-icon', status: 'error', message: 'Not found', foundUrl: '' };
    const ico = links.find(l => {
      const rel = (l.getAttribute('rel') || '').toLowerCase();
      const type = l.getAttribute('type');
      const href = l.getAttribute('href') || '';
      return (rel.includes('icon')) && (type === 'image/x-icon' || href.endsWith('.ico'));
    });

    if (ico) {
      item.foundUrl = resolveUrl(ico.getAttribute('href'));
      item.status = 'ok';
      item.message = 'Found';
      
      const isAccessible = await checkImage(item.foundUrl);
      if (!isAccessible) {
        item.status = 'error';
        item.message = 'Broken link';
      } else {
        try {
          const urlObj = new URL(item.foundUrl);
          if (urlObj.pathname !== '/favicon.ico') {
             if (urlObj.pathname.split('/').length > 2) {
               item.status = 'warning';
               item.message = 'Not at root';
             }
          }
        } catch(e) {}
      }
    } else {
       item.message = 'Tag missing';
    }
    report.push(item);
  }

  // 2. PNG 32x32
  {
    const item = { format: 'png', size: '32x32', type: 'image/png', status: 'error', message: 'Not found', foundUrl: '' };
    const png32 = findLink('icon', 'image/png', '32x32');
    if (png32) {
      item.foundUrl = resolveUrl(png32.getAttribute('href'));
      const isAccessible = await checkImage(item.foundUrl);
      if (isAccessible) {
        item.status = 'ok';
        item.message = 'Found';
      } else {
        item.status = 'error';
        item.message = 'Broken link';
      }
    }
    report.push(item);
  }

  // 3. PNG 16x16
  {
    const item = { format: 'png', size: '16x16', type: 'image/png', status: 'error', message: 'Not found', foundUrl: '' };
    const png16 = findLink('icon', 'image/png', '16x16');
    if (png16) {
      item.foundUrl = resolveUrl(png16.getAttribute('href'));
      const isAccessible = await checkImage(item.foundUrl);
      if (isAccessible) {
        item.status = 'ok';
        item.message = 'Found';
      } else {
        item.status = 'error';
        item.message = 'Broken link';
      }
    }
    report.push(item);
  }

  // 4. Apple Touch Icon 180x180
  {
    const item = { format: 'png', size: '180x180', type: '-', status: 'error', message: 'Not found', foundUrl: '' };
    const apple = links.find(l => (l.getAttribute('rel') || '') === 'apple-touch-icon');
    
    if (apple) {
        item.foundUrl = resolveUrl(apple.getAttribute('href'));
        const sizes = apple.getAttribute('sizes');
        
        const isAccessible = await checkImage(item.foundUrl);
        if (!isAccessible) {
            item.status = 'error';
            item.message = 'Broken link';
        } else {
            if (sizes === '180x180') {
                item.status = 'ok';
                item.message = 'Found';
            } else {
                item.status = 'warning';
                item.message = `Found sizes="${sizes || 'unknown'}"`;
            }
            try {
                const urlObj = new URL(item.foundUrl);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                if (pathParts.length > 1) {
                     if (item.status === 'ok') item.status = 'warning'; // Downgrade if ok
                     item.message += ' (Not at root)';
                }
            } catch(e) {}
        }
    }
    report.push(item);
  }

  // 5. Browser Config (IE/Edge) - 150x150
  {
    const item = { format: 'png', size: '150x150', type: '-', status: 'error', message: 'Not found', foundUrl: '' };
    const msConfig = metas.find(m => m.getAttribute('name') === 'msapplication-config');
    
    if (msConfig) {
      const content = msConfig.getAttribute('content');
      item.foundUrl = resolveUrl(content);
      const isAccessible = await checkImage(item.foundUrl);
      
      if (isAccessible) {
        item.status = 'ok';
        item.message = 'Config file declared';
      } else {
        item.status = 'error';
        item.message = 'Config file broken';
      }
    } else {
      item.message = 'Meta tag missing';
    }
    report.push(item);
  }

  // 6. Manifest 192x192 & 512x512
  {
      const manifestLink = links.find(l => l.getAttribute('rel') === 'manifest');
      
      const item192 = { format: 'png', size: '192x192', type: 'image/png', status: 'error', message: 'Manifest missing', foundUrl: '' };
      const item512 = { format: 'png', size: '512x512', type: 'image/png', status: 'error', message: 'Manifest missing', foundUrl: '' };

      if (manifestLink) {
          const manifestUrl = resolveUrl(manifestLink.getAttribute('href'));
          item192.message = 'Manifest found (checking...)';
          item512.message = 'Manifest found (checking...)';
          
          try {
              const response = await fetch(manifestUrl);
              if (response.ok) {
                  const json = await response.json();
                  const icons = json.icons || [];
                  
                  // Check 192
                  const icon192 = icons.find(i => (i.sizes === '192x192' || i.sizes?.includes('192x192')) && i.type === 'image/png');
                  if (icon192) {
                      item192.foundUrl = new URL(icon192.src, manifestUrl).href;
                      const isAccessible = await checkImage(item192.foundUrl);
                      if (isAccessible) {
                        item192.status = 'ok';
                        item192.message = `<a href="${manifestUrl}" target="_blank" style="color:inherit;text-decoration:underline;">Found in manifest</a>`;
                      } else {
                        item192.status = 'error';
                        item192.message = 'Broken link in manifest';
                      }
                  } else {
                      item192.message = 'Missing in manifest';
                  }

                  // Check 512
                  const icon512 = icons.find(i => (i.sizes === '512x512' || i.sizes?.includes('512x512')) && i.type === 'image/png');
                  if (icon512) {
                      item512.foundUrl = new URL(icon512.src, manifestUrl).href;
                      const isAccessible = await checkImage(item512.foundUrl);
                      if (isAccessible) {
                        item512.status = 'ok';
                        item512.message = `<a href="${manifestUrl}" target="_blank" style="color:inherit;text-decoration:underline;">Found in manifest</a>`;
                      } else {
                        item512.status = 'error';
                        item512.message = 'Broken link in manifest';
                      }
                  } else {
                      item512.message = 'Missing in manifest';
                  }

              } else {
                  item192.message = 'Manifest unreachable';
                  item512.message = 'Manifest unreachable';
              }
          } catch (e) {
              item192.message = 'Error loading manifest';
              item512.message = 'Error loading manifest';
          }
      }
      
      report.push(item192);
      report.push(item512);
  }

  // 7. SVG Mask Icon / Main SVG
  {
      const item = { format: 'svg', size: '1:1', type: 'image/svg+xml', status: 'error', message: 'Not found', foundUrl: '' };
      // Check for mask-icon OR regular icon with svg type
      const svgIcon = links.find(l => {
          const rel = l.getAttribute('rel') || '';
          const type = l.getAttribute('type');
          return (rel.includes('icon') || rel === 'mask-icon') && type === 'image/svg+xml';
      });

      if (svgIcon) {
          item.foundUrl = resolveUrl(svgIcon.getAttribute('href'));
          const isAccessible = await checkImage(item.foundUrl);
          if (isAccessible) {
            item.status = 'ok';
            item.message = 'Found';
          } else {
            item.status = 'error';
            item.message = 'Broken link';
          }
      }
      report.push(item);
  }

  return report;
})();
