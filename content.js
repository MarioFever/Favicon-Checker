(async function() {
  const links = Array.from(document.querySelectorAll('link'));
  const metas = Array.from(document.querySelectorAll('meta'));

  // --- Helpers ---
  function resolveUrl(url) {
    try {
      return new URL(url, document.baseURI).href;
    } catch(e) {
      return url;
    }
  }

  async function checkImage(url) {
    if (!url) return false;
    try {
      // Use no-cors mode if needed, but HEAD with no-cache is standard
      // In content script, we are subject to CORS unless we use the background/extension perms
      // Since 'activeTab' or host permissions are granted, fetch should work if the site allows it.
      // However, some resources might be blocked. For simplicity, we assume OK if we can fetch.
      // NOTE: Checking image dimensions requires loading it. 
      // For basic availability, HEAD is fine. For 'Real Size', we'd need to load the Image object.
      // We will assume HEAD is enough for existence check.
      const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  async function getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(`${img.naturalWidth}x${img.naturalHeight}`);
      img.onerror = () => resolve('error');
      img.src = url;
    });
  }

  // --- Logic 1: Fever Validation (Existing Logic) ---
  async function runFeverCheck() {
    const report = [];
    
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
      const png32 = links.find(l => {
        const rel = l.getAttribute('rel') || '';
        const type = l.getAttribute('type');
        const sizes = l.getAttribute('sizes');
        return rel.includes('icon') && type === 'image/png' && sizes === '32x32';
      });
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
      const png16 = links.find(l => {
        const rel = l.getAttribute('rel') || '';
        const type = l.getAttribute('type');
        const sizes = l.getAttribute('sizes');
        return rel.includes('icon') && type === 'image/png' && sizes === '16x16';
      });
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
                       if (item.status === 'ok') item.status = 'warning'; 
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

    // 6. Manifest
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
  }

  // --- Logic 2: Raw Detection (Scan All) ---
  async function scanAllAssets() {
    const assets = [];
    const processedUrls = new Set();

    // 1. Scan Link Tags
    const selectors = [
      "link[rel='icon']",
      "link[rel='shortcut icon']",
      "link[rel='apple-touch-icon']",
      "link[rel='apple-touch-icon-precomposed']",
      "link[rel='mask-icon']",
      "link[rel='fluid-icon']"
    ];
    
    // Gather from HTML
    document.querySelectorAll(selectors.join(',')).forEach(el => {
      const href = el.getAttribute('href');
      if (!href) return;
      const url = resolveUrl(href);
      if (processedUrls.has(url)) return;
      
      assets.push({
        source: 'HTML',
        rel: el.getAttribute('rel'),
        sizes: el.getAttribute('sizes') || 'any',
        type: el.getAttribute('type') || 'unknown',
        url: url
      });
      processedUrls.add(url);
    });

    // 2. Scan Metas
    const metaSelectors = [
      "meta[name='msapplication-TileImage']"
    ];
    document.querySelectorAll(metaSelectors.join(',')).forEach(el => {
      const content = el.getAttribute('content');
      if (!content) return;
      const url = resolveUrl(content);
      if (processedUrls.has(url)) return;

      let key = el.getAttribute('name') || el.getAttribute('property');
      assets.push({
        source: 'Meta',
        rel: key,
        sizes: 'unknown',
        type: 'unknown',
        url: url
      });
      processedUrls.add(url);
    });

    // 3. Implicit Root /favicon.ico Check
    const rootIco = resolveUrl('/favicon.ico');
    if (!processedUrls.has(rootIco)) {
      const exists = await checkImage(rootIco);
      if (exists) {
        assets.push({
          source: 'Root',
          rel: 'favicon.ico',
          sizes: '48x48 (implied)', // standard
          type: 'image/x-icon',
          url: rootIco
        });
        processedUrls.add(rootIco);
      }
    }

    // 4. Manifest Assets
    try {
        const manifestLink = document.querySelector("link[rel='manifest']");
        if (manifestLink) {
            const manifestUrl = resolveUrl(manifestLink.getAttribute('href'));
            // Fetch manifest if we haven't already in the other check, or just re-fetch for simplicity/independence
            const response = await fetch(manifestUrl);
            if (response.ok) {
                const json = await response.json();
                if (json.icons && Array.isArray(json.icons)) {
                    json.icons.forEach(icon => {
                        const iconUrl = new URL(icon.src, manifestUrl).href;
                        // Avoid duplicates if same URL is used in HTML
                        if (processedUrls.has(iconUrl)) return;
                        
                        assets.push({
                            source: 'manifest',
                            rel: 'icon', // Generic rel for manifest items
                            sizes: icon.sizes || 'unknown',
                            type: icon.type || 'unknown',
                            url: iconUrl
                        });
                        processedUrls.add(iconUrl);
                    });
                }
            }
        }
    } catch(e) {
        // Silent fail for manifest scan
    }

    // 5. MS Application Config
    try {
        const msConfig = document.querySelector("meta[name='msapplication-config']");
        if (msConfig) {
            const configUrl = resolveUrl(msConfig.getAttribute('content'));
            // We'll add the config file itself as an asset, 
            // but ideally we should parse it. For now, let's just show it's declared.
            // Or better, fetch and parse it if possible.
            // Let's at least show the config file exists in the list.
             if (!processedUrls.has(configUrl)) {
                 assets.push({
                     source: 'Meta',
                     rel: 'msapplication-config',
                     sizes: 'xml', // It's an XML file
                     type: 'application/xml',
                     url: configUrl
                 });
                 processedUrls.add(configUrl);
             }
             
             // Try to fetch to find TileImage inside? 
             // Common pattern is browserconfig.xml having tile images.
             // Parsing XML in content script is possible with DOMParser.
             try {
                const resp = await fetch(configUrl);
                if (resp.ok) {
                    const xmlText = await resp.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                    const tiles = xmlDoc.querySelectorAll('TileImage');
                    tiles.forEach(tile => {
                        const src = tile.getAttribute('src');
                        if (src) {
                            const tileUrl = new URL(src, configUrl).href;
                            if (!processedUrls.has(tileUrl)) {
                                assets.push({
                                    source: 'browserconfig.xml',
                                    rel: 'TileImage',
                                    sizes: 'unknown', // Often 150x150 but depends
                                    type: 'image/png', // Assumption
                                    url: tileUrl
                                });
                                processedUrls.add(tileUrl);
                            }
                        }
                    });
                     const square150 = xmlDoc.querySelector('square150x150logo');
                     if (square150) {
                         const src = square150.getAttribute('src');
                         if(src) {
                             const tileUrl = new URL(src, configUrl).href;
                             if (!processedUrls.has(tileUrl)) {
                                 assets.push({
                                     source: 'browserconfig.xml',
                                     rel: 'square150x150logo',
                                     sizes: '150x150',
                                     type: 'image/png',
                                     url: tileUrl
                                 });
                                 processedUrls.add(tileUrl);
                             }
                         }
                     }
                }
             } catch(err) {
                 console.log("Could not parse browserconfig", err);
             }
        }
    } catch(e) {}

    // Enrich with Real Dimensions
    for (let asset of assets) {
      // Special case: If it's the msconfig xml itself, skip image dimension check
      if (asset.rel === 'msapplication-config') {
          asset.realSize = 'xml';
          continue;
      }

      const dim = await getImageDimensions(asset.url);
      
      // Override for SVG
      if ((asset.type && asset.type.includes('svg')) || asset.url.endsWith('.svg')) {
          asset.realSize = '1:1';
      } else {
          asset.realSize = dim;
      }
    }

    return assets;
  }

  // --- Logic 3: Recommendations ---
  function generateRecommendations(assets, feverReport) {
    const recs = [];
    
    // Rule 1: Google Mobile First
    // Check if we have any multiple of 48px
    const hasMultiple48 = assets.some(a => {
      if (a.realSize === 'error' || !a.realSize) return false;
      const [w, h] = a.realSize.split('x').map(Number);
      return w >= 48 && w % 48 === 0 && h === w;
    });
    if (!hasMultiple48) {
      recs.push({
        type: 'warning',
        text: 'Google recommends favicons that are multiples of 48px (48x48, 96x96, 144x144...).'
      });
    }

    // Rule 2: Apple Touch Icon
    const hasAppleIcon = assets.some(a => a.rel && a.rel.includes('apple-touch-icon'));
    if (!hasAppleIcon) {
      recs.push({
        type: 'error',
        text: 'Missing <code>apple-touch-icon</code>. iOS devices will use a screenshot of the page instead.'
      });
    } else {
        // Check size
        const validApple = assets.some(a => a.rel && a.rel.includes('apple-touch-icon') && a.realSize !== 'error' && parseInt(a.realSize.split('x')[0]) >= 180);
        if (!validApple) {
            recs.push({
                type: 'warning',
                text: 'Your <code>apple-touch-icon</code> should be at least 180x180px for optimal quality on Retine screens.'
            });
        }
    }

    // Rule 3: SVG
    const hasSVG = assets.some(a => a.url.endsWith('.svg') || a.type === 'image/svg+xml');
    if (!hasSVG) {
      recs.push({
        type: 'info',
        text: 'Consider adding an SVG favicon for modern browsers. It supports dark mode and scales perfectly.'
      });
    }

    // Rule 4: Root Favicon
    const hasRootIco = assets.some(a => a.url.endsWith('/favicon.ico'));
    if (!hasRootIco) {
      recs.push({
        type: 'warning',
        text: 'Missing <code>favicon.ico</code> at the root. Legacy browsers and tools often look for it there implicitly.'
      });
    }

    return recs;
  }

  // --- Execution ---
  const feverReport = await runFeverCheck();
  const allAssets = await scanAllAssets();
  const recommendations = generateRecommendations(allAssets, feverReport);

  return { feverReport, allAssets, recommendations };
})();
