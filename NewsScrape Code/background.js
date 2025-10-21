// background.js - COMPLETE VERSION
console.log('Background script loaded');

class NewsScrapingManager {
  constructor() {
    this.rateLimitTracker = new Map();
    this.failureTracker = new Map(); 
    this.maxConcurrentSources = 4;
    this.maxConcurrentTabs = 6;
    this.baseDelay = 1500;
    this.maxRetries = 3;
    this.progressCallback = null;
  }

  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  updateProgress(current, total, message) {
    if (this.progressCallback) {
      const percentage = Math.round((current / total) * 100);
      this.progressCallback(percentage, message);
    }
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  shouldSkipDomain(domain) {
    const skipDomains = ['apnews.com'];
    return skipDomains.some(skipDomain => domain.includes(skipDomain));
  }

  async scrapeAllSources(sources, keywords) {
    console.log(`BG: Starting scrape for ${sources.length} sources`);
    
    const sourceChunks = this.chunkArray(sources, this.maxConcurrentSources);
    const allResults = [];
    let completedSources = 0;
    const totalSources = sources.length;
    
    this.updateProgress(0, totalSources, 'Starting scrape...');
    
    for (let chunkIndex = 0; chunkIndex < sourceChunks.length; chunkIndex++) {
      const chunk = sourceChunks[chunkIndex];
      console.log(`BG: Processing source chunk ${chunkIndex + 1}/${sourceChunks.length}`);
      
      const chunkPromises = chunk.map(async (src) => {
        this.updateProgress(completedSources, totalSources, `Scraping ${src.name}...`);
        console.log('BG: Scraping source:', src.name);
        const sourceArticles = [];
        
        const urlBatches = this.chunkArray(src.urls, this.maxConcurrentTabs);
        
        for (const urlBatch of urlBatches) {
          const urlPromises = urlBatch.map(async (url) => {
            const domain = this.getDomain(url);
            console.log(`BG: Processing URL: ${url} (domain: ${domain})`);
            
            if (this.shouldSkipDomain(domain)) {
              console.log(`BG: Skipping ${domain} due to known issues`);
              return [];
            }
            
            try {
              return await this.scrapeUrl(url, src.name, keywords);
            } catch (error) {
              console.error('BG: Error processing source:', src.name, url, error);
              return [];
            }
          });
          
          const batchResults = await Promise.all(urlPromises);
          batchResults.forEach(articles => sourceArticles.push(...articles));
          
          if (urlBatches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        completedSources++;
        this.updateProgress(completedSources, totalSources, `Completed ${src.name} - Found ${sourceArticles.length} articles`);
        console.log(`BG: Found ${sourceArticles.length} articles from ${src.name}`);
        return sourceArticles;
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach(articles => {
        if (articles.length > 0) {
          allResults.push(...articles);
        }
      });
      
      if (chunkIndex < sourceChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    this.updateProgress(100, 100, 'Processing complete - Creating document...');
    console.log(`BG: Total articles found: ${allResults.length}`);
    return allResults;
  }

  async scrapeUrl(url, sourceName, keywords) {
    let tabId = null;
    
    try {
      console.log(`BG: Opening tab for ${url}`);
      const { id } = await chrome.tabs.create({ url, active: false });
      tabId = id;
      
      await this.waitForTabLoad(tabId, 35000);
      
      const domain = this.getDomain(url);
      const isLikelyListingPage = !url.match(/\/(article|story|post|news)\//) && 
                                 !url.match(/\/\d{4}\/\d{2}\/\d{2}\//);
      
      if (isLikelyListingPage) {
        console.log(`BG: Detected listing page, waiting longer for dynamic content: ${url}`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log(`BG: Trying to inject scraper into ${url}`);
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['scraperContentScript.js']
      });
      
      const timeout = isLikelyListingPage ? 15000 : 5000;
      
      const resp = await new Promise(res => {
        let didRespond = false;
        chrome.tabs.sendMessage(tabId, {
          action: 'scrape',
          source: sourceName,
          keywords,
          url: url
        }, r => {
          didRespond = true;
          if (chrome.runtime.lastError) {
            console.warn('BG: Message error:', chrome.runtime.lastError);
            res({ articles: [], linksToScrape: [] });
          } else {
            res(r || { articles: [], linksToScrape: [] });
          }
        });
        
        setTimeout(() => {
          if (!didRespond) {
            console.warn(`BG: No scraper response from ${url} after ${timeout/1000}s`);
            res({ articles: [], linksToScrape: [] });
          }
        }, timeout);
      });
      
      console.log(`BG: Response from ${url}:`, resp);
      
      await chrome.tabs.remove(tabId);
      tabId = null;
      
      const articles = [];
      
      if (resp.articles && resp.articles.length > 0) {
        console.log(`BG: Found ${resp.articles.length} direct articles`);
        articles.push(...resp.articles);
      }
      
      if (resp.linksToScrape && resp.linksToScrape.length > 0) {
        console.log(`BG: Found ${resp.linksToScrape.length} links to scrape for ${sourceName}`);
        
        const batchSize = 3;
        for (let i = 0; i < resp.linksToScrape.length; i += batchSize) {
          const batch = resp.linksToScrape.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (link) => {
            return this.scrapeArticleLinkWithRetry(link, sourceName, keywords);
          });
          
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(article => {
            if (article) articles.push(article);
          });
          
          if (i + batchSize < resp.linksToScrape.length) {
            console.log(`BG: Completed batch ${Math.floor(i/batchSize) + 1}, waiting before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      return articles;
      
    } catch (error) {
      console.error(`BG: Error in scrapeUrl for ${url}:`, error.message);
      
      if (tabId) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (cleanupError) {
          console.error('BG: Error cleaning up tab:', cleanupError);
        }
      }
      
      return [];
    }
  }

  async scrapeArticleLinkWithRetry(link, sourceName, keywords, retryCount = 0) {
    try {
      return await this.scrapeArticleLink(link, sourceName, keywords);
    } catch (error) {
      console.error(`BG: Error scraping article ${link.url} (attempt ${retryCount + 1}):`, error.message);
      
      if (error.message.includes('Extension manifest must request permission')) {
        console.log(`BG: Skipping ${link.url} due to permission error`);
        return null;
      }
      
      if (retryCount < this.maxRetries) {
        const retryDelay = 3000 * Math.pow(2, retryCount);
        console.log(`BG: Retrying ${link.url} in ${retryDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.scrapeArticleLinkWithRetry(link, sourceName, keywords, retryCount + 1);
      }
      
      console.log(`BG: Failed to scrape ${link.url} after ${this.maxRetries + 1} attempts`);
      return null;
    }
  }

  async scrapeArticleLink(link, sourceName, keywords) {
    let articleTabId = null;
    
    try {
      console.log(`BG: Scraping article: ${link.url}`);
      const tabResult = await chrome.tabs.create({ url: link.url, active: false });
      articleTabId = tabResult.id;
      
      await this.waitForTabLoad(articleTabId, 30000);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await chrome.scripting.executeScript({
        target: { tabId: articleTabId },
        files: ['scraperContentScript.js']
      });
      
      const articleResp = await new Promise(res => {
        chrome.tabs.sendMessage(articleTabId, { 
          action: 'scrape', 
          source: sourceName, 
          keywords,
          url: link.url
        }, r => {
          if (chrome.runtime.lastError) {
            console.log('BG: Article message error:', chrome.runtime.lastError);
            res({ articles: [] });
          } else {
            res(r || { articles: [] });
          }
        });
      });
      
      await chrome.tabs.remove(articleTabId);
      articleTabId = null;
      
      if (articleResp.articles && articleResp.articles.length > 0) {
        console.log(`BG: Successfully scraped content from ${link.url}`);
        console.log(`BG: Content preview for ${link.url}:`, articleResp.articles[0].content.substring(0, 300) + '...');
        console.log(`BG: Title:`, articleResp.articles[0].title);
        return articleResp.articles[0];
      } else {
        console.log(`BG: No content found at ${link.url}`);
        return null;
      }
      
    } catch (error) {
      console.error('BG: Error scraping article:', link.url, error);
      
      if (articleTabId) {
        try {
          await chrome.tabs.remove(articleTabId);
        } catch (closeError) {
          console.error('BG: Error closing tab:', closeError);
        }
      }
      
      throw error;
    }
  }

  waitForTabLoad(tabId, timeout = 35000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        reject(new Error('Tab load timeout'));
      }, timeout);
      
      const onUpdated = (id, info) => {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          clearTimeout(timeoutId);
          resolve();
        }
      };
      
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

const scrapingManager = new NewsScrapingManager();

function sanitizeTextForGoogleDocs(text) {
  if (!text) return '';
  
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .replace(/—/g, '--')
    .replace(/–/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('BG: Received message:', msg);
  
  if (msg.action === 'startScrape') {
    console.log('BG: startScrape received', msg);
    
// In background.js, modify the progress callback:
scrapingManager.setProgressCallback((percentage, message) => {
  // Send message to popup specifically
  chrome.runtime.sendMessage({
    action: 'progressUpdate',
    percentage,
    message
  }).catch(() => {
    // Ignore errors if popup is closed
  });
});
    
    scrapingManager.scrapeAllSources(msg.sources, msg.keywords)
      .then(articles => {
        console.log('BG: scraped articles count =', articles.length);
        if (!articles.length) throw new Error('No articles scraped');
        
        const limitedArticles = articles.slice(0, 150);
        console.log('BG: Limited to', limitedArticles.length, 'articles for document');
        
        return limitedArticles;
      })
      .then(articles => new Promise((resolve, reject) => {
        console.log('BG: Getting OAuth token...');
        chrome.identity.getAuthToken({ interactive: true }, token => {
          if (chrome.runtime.lastError) {
            console.error('BG: OAuth error:', chrome.runtime.lastError);
            reject(new Error('Auth token error: ' + chrome.runtime.lastError.message));
          } else if (!token) {
            console.error('BG: No token received');
            reject(new Error('No auth token received'));
          } else {
            console.log('BG: OAuth token received, length:', token.length);
            resolve({ articles, token });
          }
        });
      }))
      .then(({ articles, token }) => createGoogleDoc(articles, token))
      .then(docId => {
        const url = `https://docs.google.com/document/d/${docId}/edit`;
        console.log('BG: opening new doc:', url);
        chrome.tabs.create({ url, active: true });
        sendResponse({ success: true, documentId: docId });
      })
      .catch(err => {
        console.error('BG: pipeline error', err);
        sendResponse({ success: false, error: err.message });
      });
    
    return true;
  }
});

async function createGoogleDoc(articles, accessToken) {
  try {
    console.log('BG: Creating doc with', articles.length, 'articles');
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const fullTitle = `News Scrape Report - ${dateStr} • ${timeStr}`;
    
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: fullTitle })
    });
    
    const docJson = await createRes.json();
    
    if (!createRes.ok) {
            console.error('BG: Doc creation failed:', createRes.status, docJson);
      throw new Error(`Doc create failed (${createRes.status}): ${JSON.stringify(docJson)}`);
    }
    
    if (!docJson.documentId) {
      throw new Error('No documentId in response: ' + JSON.stringify(docJson));
    }
    
    let report = `News Scraper Report\nDate: ${dateStr} ${timeStr}\n\n`;
    report += `Total Articles: ${articles.length}\n\n`;
    
    const bySource = {};
    articles.forEach(a => {
      (bySource[a.source] = bySource[a.source] || []).push(a);
    });
    
    const boldRanges = [];
    const linkRanges = [];
    let currentIndex = 1;
    currentIndex += report.length;
    
    for (const [src, list] of Object.entries(bySource)) {
      const sectionHeader = `--- ${src} (${list.length}) ---\n\n`;
      report += sectionHeader;
      currentIndex += sectionHeader.length;
      
      list.forEach((a, index) => {
        const sanitizedTitle = sanitizeTextForGoogleDocs(a.title);
        const sanitizedContent = sanitizeTextForGoogleDocs(a.content);
        const sanitizedUrl = a.url;
        
        const titleText = `${index + 1}. ${sanitizedTitle}\n`;
        const urlText = `URL: ${sanitizedUrl}\n\n`;
        const contentText = `Content:\n${sanitizedContent}\n\n`;
        const separator = `${'='.repeat(72)}\n\n`;
        
        const titleStart = currentIndex;
        const titleEnd = titleStart + titleText.length - 1;
        
        boldRanges.push({
          startIndex: titleStart,
          endIndex: titleEnd
        });
        
        const urlStart = currentIndex + titleText.length + 5;
        const urlEnd = urlStart + sanitizedUrl.length;
        
        linkRanges.push({
          startIndex: urlStart,
          endIndex: urlEnd,
          url: sanitizedUrl
        });
        
        report += titleText + urlText + contentText + separator;
        currentIndex += titleText.length + urlText.length + contentText.length + separator.length;
      });
    }
    
    const requests = [
      {
        insertText: {
          location: { index: 1 },
          text: report
        }
      }
    ];
    
    boldRanges.forEach(range => {
      requests.push({
        updateTextStyle: {
          range: range,
          textStyle: {
            bold: true
          },
          fields: 'bold'
        }
      });
    });
    
    linkRanges.forEach(range => {
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: range.startIndex,
            endIndex: range.endIndex
          },
          textStyle: {
            link: {
              url: range.url
            }
          },
          fields: 'link'
        }
      });
    });
    
    console.log('BG: Sending batch update with', requests.length, 'requests');
    
    const batchRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${docJson.documentId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      }
    );
    
    const batchJson = await batchRes.json();
    
    if (!batchRes.ok) {
      console.error('BG: BatchUpdate failed:', batchRes.status, batchJson);
      throw new Error(`BatchUpdate failed (${batchRes.status}): ${JSON.stringify(batchJson)}`);
    }
    
    if (batchJson.error) {
      throw new Error('BatchUpdate failed: ' + JSON.stringify(batchJson.error));
    }
    
    console.log('BG: Document created successfully:', docJson.documentId);
    return docJson.documentId;
    
  } catch (error) {
    console.error('BG: createGoogleDoc error:', error);
    throw error;
  }
}
