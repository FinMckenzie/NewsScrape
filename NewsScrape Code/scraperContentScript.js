// scraperContentScript.js - ENHANCED WITH SCROLL FEATURE
console.log('ScraperContentScript: injected on', window.location.href);

// At the top of scraperContentScript.js, replace the existing message listener:
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'scrape') {
    const { source, keywords, url } = msg;
    
    console.log('=== SCRAPER DEBUG ===');
    console.log('Current URL:', window.location.href);
    console.log('Source name:', source);
    console.log('Keywords:', keywords);
    console.log('Domain:', window.location.hostname);
    console.log('===================');
    
    const currentUrl = window.location.href;
    
    // ENHANCED: Better article detection
    const articleSelectors = [
      'article',
      '.article-body',
      '.story-body',
      '.post-content',
      '.entry-content',
      '[role="article"]',
      '.content-body',
      '.main-content'
    ];
    
    let foundArticleElement = null;
    for (const selector of articleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        foundArticleElement = element;
        console.log(`Found article element with selector: ${selector}`);
        break;
      }
    }
    
    const isNewsArticle = !!foundArticleElement;
    console.log('Scraper: Is news article:', isNewsArticle);
    console.log('Scraper: Article element found:', foundArticleElement ? foundArticleElement.tagName : 'none');
    
    if (isNewsArticle) {
      // We're on a news article page - scrape the actual content
      console.log('Scraper: Attempting to scrape article content...');
      const content = scrapeNewsArticle();
      const title = document.querySelector('h1')?.innerText || document.title;
      
      console.log('Scraper: Found news article content, length:', content.length);
      console.log('Scraper: Article title:', title);
      console.log('Scraper: Content preview:', content.substring(0, 200) + '...');
      
      if (content && content.length > 100) {
        const results = [{
          source,
          title: title || 'News Article',
          url: currentUrl,
          content,
          timestamp: Date.now(),
        }];
        console.log('Scraper: Returning article results:', results.length);
        sendResponse({ articles: results });
      } else {
        console.log('Scraper: Content too short or empty, treating as listing page');
        // Fallback to link finding
        (async () => {
          try {
            const links = await findMatchingLinksWithScroll(keywords);
            sendResponse({ articles: [], linksToScrape: links });
          } catch (error) {
            console.error('Scraper: Error during scroll search:', error);
            const links = findMatchingLinks(keywords);
            sendResponse({ articles: [], linksToScrape: links });
          }
        })();
        return true;
      }
    } else {
      // We're on a listing page - find links with scroll enhancement
      console.log('Scraper: On listing page, finding links with scroll...');
      
      (async () => {
        try {
          const links = await findMatchingLinksWithScroll(keywords);
          console.log('Scraper: Found', links.length, 'matching links after scroll');
          sendResponse({ articles: [], linksToScrape: links });
        } catch (error) {
          console.error('Scraper: Error during scroll search:', error);
          const links = findMatchingLinks(keywords);
          sendResponse({ articles: [], linksToScrape: links });
        }
      })();
      
      return true;
    }
  }
});

// ENHANCED: Scroll-enabled link finding
async function findMatchingLinksWithScroll(keywords) {
  console.log('Starting scroll-enhanced link discovery...');
  
  const allLinks = new Map(); // Use Map to avoid duplicates
  const maxScrollAttempts = 5;
  const scrollDelay = 1500; // Wait for content to load
  
  // Function to collect links from current viewport
  function collectCurrentLinks() {
    const currentLinks = findMatchingLinks(keywords);
    currentLinks.forEach(link => {
      if (!allLinks.has(link.url)) {
        allLinks.set(link.url, link);
      }
    });
    console.log(`Collected ${currentLinks.length} new links, total unique: ${allLinks.size}`);
  }
  
  // Collect initial links
  collectCurrentLinks();
  const initialCount = allLinks.size;
  
  // Get page dimensions for scrolling
  const getScrollHeight = () => Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  
  const getCurrentScrollPosition = () => window.pageYOffset || document.documentElement.scrollTop;
  
  let previousScrollHeight = getScrollHeight();
  let noNewContentCount = 0;
  
  // Scroll and collect links
  for (let attempt = 1; attempt <= maxScrollAttempts; attempt++) {
    console.log(`Scroll attempt ${attempt}/${maxScrollAttempts}`);
    
    const currentPosition = getCurrentScrollPosition();
    const scrollHeight = getScrollHeight();
    
    // Calculate scroll position (scroll 80% of viewport height each time)
    const viewportHeight = window.innerHeight;
    const scrollAmount = viewportHeight * 0.8;
    const targetPosition = currentPosition + scrollAmount;
    
    // Smooth scroll to new position
    window.scrollTo({
      top: Math.min(targetPosition, scrollHeight - viewportHeight),
      behavior: 'smooth'
    });
    
    // Wait for scroll and content loading
    await new Promise(resolve => setTimeout(resolve, scrollDelay));
    
    // Check if we've reached the bottom
    const newScrollHeight = getScrollHeight();
    const newPosition = getCurrentScrollPosition();
    
    if (newPosition + viewportHeight >= newScrollHeight - 100) {
      console.log('Reached bottom of page');
      
      // Try to trigger "Load More" buttons if they exist
      await triggerLoadMoreButtons();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if new content loaded
      const finalScrollHeight = getScrollHeight();
      if (finalScrollHeight <= newScrollHeight) {
        noNewContentCount++;
        if (noNewContentCount >= 2) {
          console.log('No new content loading, stopping scroll');
          break;
        }
      } else {
        noNewContentCount = 0; // Reset counter if new content appeared
      }
    }
    
    // Collect links from new viewport
    const linksBeforeCollection = allLinks.size;
    collectCurrentLinks();
    const newLinksFound = allLinks.size - linksBeforeCollection;
    
    console.log(`Found ${newLinksFound} new links in this scroll`);
    
    // If no new links found in last 2 attempts, consider stopping
    if (newLinksFound === 0) {
      noNewContentCount++;
      if (noNewContentCount >= 2) {
        console.log('No new links found in recent scrolls, stopping');
        break;
      }
    } else {
      noNewContentCount = 0;
    }
    
    previousScrollHeight = newScrollHeight;
  }
  
  // Final collection after all scrolling
  collectCurrentLinks();
  
  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  const finalLinks = Array.from(allLinks.values());
  console.log(`Scroll complete: Found ${finalLinks.length} total links (${finalLinks.length - initialCount} new from scrolling)`);
  
  return finalLinks.slice(0, 50); // Increased limit due to scrolling
}

// Helper function to trigger "Load More" buttons
async function triggerLoadMoreButtons() {
  const loadMoreSelectors = [
    'button[data-testid="load-more"]',
    '.load-more',
    '.show-more',
    '.load-more-button',
    'button:contains("Load More")',
    'button:contains("Show More")',
    'button:contains("More Stories")',
    '[data-load-more]',
    '.pagination-next',
    '.next-page',
    '.load-more-posts',
    '.load-more-articles'
  ];
  
  for (const selector of loadMoreSelectors) {
    try {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        if (button.offsetParent !== null && !button.disabled) {
          console.log('Clicking load more button:', selector);
          button.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          break; // Only click one button per selector
        }
      }
    } catch (error) {
      console.log('Error clicking load more button:', error);
    }
  }
  
  // Also try to trigger infinite scroll by scrolling to bottom
  const event = new Event('scroll');
  window.dispatchEvent(event);
}

// ENHANCED: Original link finding function with better selectors
function findMatchingLinks(keywords) {
  const links = [];
  const seenUrls = new Set();
  
  console.log('Finding links on:', window.location.hostname);
  
  // Enhanced selectors for better article detection
  const articleLinkSelectors = [
    'article a[href]',
    '.article a[href]',
    '.story a[href]',
    '.post a[href]',
    '.news-item a[href]',
    '.headline a[href]',
    '.entry a[href]',
    '.content-item a[href]',
    '[data-testid="article"] a[href]',
    '[data-testid="story"] a[href]',
    '.wp-block-latest-posts a[href]',
    '.post-title a[href]',
    'h1 a[href], h2 a[href], h3 a[href]', // Headlines
    '.title a[href]',
    '.headline a[href]'
  ];
  
  // First try specific article selectors
  let foundWithSelectors = false;
  for (const selector of articleLinkSelectors) {
    const specificLinks = document.querySelectorAll(selector);
    if (specificLinks.length > 5) { // Good indication we found the right selector
      console.log(`Found ${specificLinks.length} links with selector: ${selector}`);
      foundWithSelectors = true;
      
      specificLinks.forEach(a => {
        processLink(a, keywords, links, seenUrls);
      });
      
      if (links.length > 10) break; // Stop if we have enough good links
    }
  }
  
  // Fallback to all links if specific selectors didn't work well
  if (!foundWithSelectors || links.length < 5) {
    console.log('Using fallback: all links approach');
    const allLinks = document.querySelectorAll('a[href]');
    console.log(`Found ${allLinks.length} total links`);
    
    allLinks.forEach(a => {
      processLink(a, keywords, links, seenUrls);
    });
  }
  
  console.log(`Total matching links found: ${links.length}`);
  return links.slice(0, 30);
}

// Helper function to process individual links
function processLink(a, keywords, links, seenUrls) {
  const title = a.innerText.trim();
  const url = a.href;
  
  // Skip if no title or URL
  if (!title || !url || seenUrls.has(url)) return;
  
  // Skip if title is too short or too long
  if (title.length < 15 || title.length > 300) return;
  
  // Skip navigation and UI links
  const skipWords = ['home', 'about', 'contact', 'subscribe', 'login', 'menu', 'search', 'more', 'sign in', 'register', 'newsletter', 'follow us', 'privacy policy', 'terms of service'];
  const titleLower = title.toLowerCase();
  if (skipWords.some(word => titleLower === word || titleLower.startsWith(word + ' '))) return;
  
  // Check if it matches keywords (empty keywords = match all)
  const matchesKeywords = keywords.length === 0 || keywords.includes('') || 
                         keywords.some(k => k === '' || titleLower.includes(k.toLowerCase()));
  
  if (matchesKeywords) {
    // Enhanced checks to ensure it's likely an article
    const isLikelyArticle =
      url.includes('/article/') ||
      url.includes('/news/') ||
      url.includes('/story/') ||
      url.includes('/blog/') ||
      url.includes('/post/') ||
      url.includes('/opinion/') ||
      url.includes('/politics/') ||
      url.includes('/business/') ||
      url.includes('/world/') ||
      url.includes('/sports/') ||
      url.includes('/technology/') ||
      url.includes('/health/') ||
      url.includes('/entertainment/') ||
      url.includes('/breaking/') ||
      url.includes('/latest/') ||
      url.includes('/featured/') ||
      url.includes('/trending/') ||
      a.closest('article') ||
      a.closest('.article') ||
      a.closest('.story') ||
      a.closest('.post') ||
      a.closest('.news-item') ||
      a.closest('.content-item') ||
      a.querySelector('h1,h2,h3,h4') ||
      title.split(' ').length >= 4 || // At least 4 words
      // Check if parent has article-like classes
      a.parentElement?.className.match(/(article|story|post|news|headline|title)/i);
    
    if (isLikelyArticle) {
      console.log(`Found article: "${title.substring(0, 60)}..."`);
      links.push({ title, url });
      seenUrls.add(url);
    }
  }
}

// Rest of your existing functions remain the same...
function scrapeNewsArticle() {
  console.log('Scraping news article content...');
  
  // Get domain for site-specific handling first
  const domain = window.location.hostname.toLowerCase();
  
  // Site-specific extractors with enhanced detection
  if (domain.includes('washingtonpost.com')) {
    return scrapeWashingtonPostContent();
  } else if (domain.includes('foxnews.com')) {
    return scrapeFoxNewsContent();
  } else if (domain.includes('wsj.com') || domain.includes('wallstreetjournal.com')) {
    return scrapeWSJContent();
  } else if (domain.includes('bloomberg.com')) {
    return scrapeBloombergContent();
  } else if (domain.includes('npr.org')) {
    return scrapeNPRContent();
  } else if (domain.includes('aljazeera.com')) {
    return scrapeAlJazeeraContent();
  } else if (domain.includes('cnn.com')) {
    return scrapeCNNContent();
  } else if (domain.includes('reuters.com')) {
    return scrapeReutersContent();
  } else if (domain.includes('bbc.com') || domain.includes('bbc.co.uk')) {
    return scrapeBBCContent();
  } else if (domain.includes('nytimes.com')) {
    return scrapeNYTimesContent();
  } else if (domain.includes('theguardian.com')) {
    return scrapeGuardianContent();
  }
  
  // Use old code's simple but effective general extraction
  return scrapeGeneralNewsContent();
}

// [Keep all your existing site-specific scraper functions unchanged...]

// Enhanced Washington Post extractor
function scrapeWashingtonPostContent() {
  console.log('Scraper: Using enhanced Washington Post extractor...');
  
  const wapoSelectors = [
    '.article-body',
    '[data-qa="article-body"]',
    '.content-wrap .article-body',
    '.story-body',
    '.paywall',
    '.article-content',
    '.pb-f-article-body',
    'article .content',
    'main article div p',
    '.font-copy p',
    '.gray-darkest p'
  ];
  
  for (const selector of wapoSelectors) {
    console.log(`Scraper: Trying WaPo selector: ${selector}`);
    
    if (selector.includes('p')) {
      const paragraphs = Array.from(document.querySelectorAll(selector))
        .map(p => p.textContent.trim())
        .filter(text => 
          text.length > 30 && 
          !text.includes('Subscribe') &&
          !text.includes('Sign in') &&
          !text.includes('$1 for') &&
          !text.includes('washingtonpost.com') &&
          !text.toLowerCase().includes('advertisement')
        );
      
      if (paragraphs.length >= 2) {
        console.log(`Scraper: WaPo - Found ${paragraphs.length} paragraphs with direct selector`);
                return paragraphs.join('\n\n');
      }
    } else {
      const container = document.querySelector(selector);
      if (container) {
        console.log(`Scraper: WaPo - Found container with ${selector}`);
        
        const paragraphs = Array.from(container.querySelectorAll('p'))
          .map(p => p.textContent.trim())
          .filter(text => 
            text.length > 30 && 
            !text.includes('Subscribe') &&
            !text.includes('Sign in') &&
            !text.includes('$1 for') &&
            !text.includes('washingtonpost.com') &&
            !text.toLowerCase().includes('advertisement')
          );
        
        if (paragraphs.length >= 1) {
          console.log(`Scraper: WaPo - Found ${paragraphs.length} paragraphs in container`);
          return paragraphs.join('\n\n');
        }
        
        const divs = Array.from(container.querySelectorAll('div'))
          .map(d => d.textContent.trim())
          .filter(text => 
            text.length > 50 && 
            text.split(' ').length > 10 &&
            !text.includes('Subscribe') &&
            !text.includes('Sign in')
          );
        
        if (divs.length > 0) {
          console.log(`Scraper: WaPo - Found ${divs.length} content divs`);
          return divs.slice(0, 3).join('\n\n');
        }
      }
    }
  }
  
  // Last resort for WaPo
  console.log('Scraper: WaPo - Trying fallback extraction');
  const allText = document.body.textContent;
  if (allText && allText.length > 1000) {
    const sentences = allText.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 50 && s.length < 500)
      .filter(s => 
        !s.includes('Subscribe') &&
        !s.includes('Sign in') &&
        !s.includes('Advertisement') &&
        !s.includes('Cookie')
      )
      .slice(0, 10);
    
    if (sentences.length > 0) {
      console.log('Scraper: WaPo - Using fallback text extraction');
      return sentences.join('. ') + '.';
    }
  }
  
  return 'Washington Post article detected but content may be behind paywall or require subscription.';
}

// Other site-specific extractors
function scrapeFoxNewsContent() {
  console.log('Scraper: Using Fox News extractor...');
  
  const foxSelectors = [
    '.article-body',
    '.article-content',
    '.article-text',
    '.content-body',
    '.speakable'
  ];
  
  for (const selector of foxSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => 
          text.length > 50 && 
          !text.includes('window.foxstrike') &&
          !text.includes('console.error') &&
          !text.includes('OutKick')
        );
      
      if (paragraphs.length >= 2) {
        console.log(`Scraper: Fox - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'Fox News article found but content extraction failed.';
}

function scrapeWSJContent() {
  console.log('Scraper: Using WSJ extractor...');
  
  const wsjSelectors = [
    '[name="articleBody"]',
    '.article-content',
    '.wsj-article-body',
    '[data-module="ArticleBody"]',
    '.paywall'
  ];
  
  for (const selector of wsjSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => 
          text.length > 30 && 
          !text.includes('Subscribe') &&
          !text.includes('Sign In')
        );
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: WSJ - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'WSJ article found but may require subscription.';
}

function scrapeBloombergContent() {
  console.log('Scraper: Using Bloomberg extractor...');
  
  const bloombergSelectors = [
    '.body-content',
    '[data-module="BodyText"]',
    '.fence-body',
    '.article-body'
  ];
  
  for (const selector of bloombergSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => 
          text.length > 30 &&
          !text.includes('Bloomberg Terminal') &&
          !text.includes('Subscribe')
        );
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: Bloomberg - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'Bloomberg article found but may require subscription.';
}

function scrapeNPRContent() {
  console.log('Scraper: Using NPR extractor...');
  
  const nprSelectors = [
    '#storytext',
    '.storytext',
    '[data-testid="transcript"]',
    '.story-text'
  ];
  
  for (const selector of nprSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30);
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: NPR - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'NPR content found but extraction failed.';
}

function scrapeAlJazeeraContent() {
  console.log('Scraper: Using Al Jazeera extractor...');
  
  const ajSelectors = [
    '.wysiwyg',
    '.article-body',
    '[data-article-body]',
    '.main-article-body'
  ];
  
  for (const selector of ajSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30);
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: Al Jazeera - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'Al Jazeera article found but extraction failed.';
}

function scrapeCNNContent() {
  console.log('Scraper: Using CNN extractor...');
  
  const cnnSelectors = [
    '.zn-body__paragraph',
    '.zn-body-text',
    '.article-body'
  ];
  
  for (const selector of cnnSelectors) {
    const paragraphs = Array.from(document.querySelectorAll(selector))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 30);
    
    if (paragraphs.length >= 1) {
      console.log(`Scraper: CNN - Found ${paragraphs.length} paragraphs`);
      return paragraphs.join('\n\n');
    }
  }
  
  return 'CNN article found but extraction failed.';
}

function scrapeReutersContent() {
  console.log('Scraper: Using Reuters extractor...');
  
  const reutersSelectors = [
    '[data-testid="paragraph"]',
    '.ArticleBodyWrapper',
    '.StandardArticleBody_body'
  ];
  
  for (const selector of reutersSelectors) {
    const container = document.querySelector(selector);
    if (container) {
      const paragraphs = Array.from(container.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30);
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: Reuters - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'Reuters article found but extraction failed.';
}

function scrapeBBCContent() {
  console.log('Scraper: Using BBC extractor...');
  
  const bbcSelectors = [
    '[data-component="text-block"]',
    '.story-body__inner p',
    '.gel-body-copy',
    'article p'
  ];
  
  for (const selector of bbcSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      const paragraphs = Array.from(elements)
        .map(p => p.textContent.trim())
        .filter(text => text.length > 30);
      
      if (paragraphs.length >= 1) {
        console.log(`Scraper: BBC - Found ${paragraphs.length} paragraphs`);
        return paragraphs.join('\n\n');
      }
    }
  }
  
  return 'BBC article found but extraction failed.';
}

function scrapeNYTimesContent() {
  console.log('Scraper: Using NY Times extractor...');
  
  const nytSelectors = [
    '.StoryBodyCompanionColumn p',
    '[name="articleBody"] p',
    'section[name="articleBody"] p',
    'article p'
  ];
  
  for (const selector of nytSelectors) {
    const paragraphs = Array.from(document.querySelectorAll(selector))
      .map(p => p.textContent.trim())
      .filter(text => 
        text.length > 30 && 
        !text.includes('Subscribe') &&
        !text.includes('Times subscription')
      );
    
    if (paragraphs.length >= 1) {
      console.log(`Scraper: NYT - Found ${paragraphs.length} paragraphs`);
      return paragraphs.join('\n\n');
    }
  }
  
  return 'NY Times article found but may require subscription.';
}

function scrapeGuardianContent() {
  console.log('Scraper: Using Guardian extractor...');
  
  const guardianSelectors = [
    '[data-gu-name="body"] p',
    '.content__article-body p',
    '#maincontent p',
    'article p'
  ];
  
  for (const selector of guardianSelectors) {
    const paragraphs = Array.from(document.querySelectorAll(selector))
      .map(p => p.textContent.trim())
      .filter(text => text.length > 30);
    
    if (paragraphs.length >= 1) {
      console.log(`Scraper: Guardian - Found ${paragraphs.length} paragraphs`);
      return paragraphs.join('\n\n');
    }
  }
  
  return 'Guardian article found but extraction failed.';
}

// ENHANCED: General content extractor with scroll awareness
function scrapeGeneralNewsContent() {
  console.log('Scraping news article content with enhanced general extractor...');
  
  // Enhanced selectors based on old code logic but with more coverage
  const selectors = [
    'article .article-body',
    'article .story-body',
    '.article-content',
    '[data-module="ArticleBody"]',
    '.entry-content',
    'article',
    '.post-content',
    '.content',
    'main .content',
    '.story-content',
    '.article-text',
    '.body-content',
    '.main-content',
    '.content-body',
    '.post-body',
    '.entry-body',
    '.single-content',
    '.wp-content',
    '.post-wrap',
    '.article-wrap',
    '.article-text-content',
    '.article-body-text',
    '.article-body-content',
    '.story-body',
    '.live-blog-body',
    // Enhanced selectors for modern sites
    '[data-testid="article-body"]',
    '[data-testid="content"]',
    '[role="article"]',
    '.prose', // Tailwind CSS common class
    '.rich-text',
    '.editorial-content',
    '.story-text',
    '.article-container',
    '.content-container'
  ];
  
  for (const selector of selectors) {
    const container = document.querySelector(selector);
    console.log(`Trying selector: ${selector}, found:`, !!container);
    
    if (container) {
      // Enhanced paragraph extraction
      const paragraphs = Array.from(container.querySelectorAll('p, .paragraph, [data-paragraph]'))
        .map(p => p.textContent.trim())
        .filter(t => t &&
                     t.length > 50 &&
                     !t.includes('Subscribe') &&
                     !t.includes('Sign up') &&
                     !t.includes('Newsletter') &&
                     !t.includes('Follow us') &&
                     !t.includes('Advertisement') &&
                     !t.includes('Related:') &&
                     !t.includes('Read more:') &&
                     !t.includes('Share this') &&
                     !t.includes('Copyright') &&
                     !t.match(/^\d+\s*(minute|min|hour|hr|day)\s*ago/i) &&
                     !t.match(/^By\s+[A-Z]/) &&
                     !t.toLowerCase().includes('click here') &&
                     !t.toLowerCase().includes('download') &&
                     !t.toLowerCase().includes('app store'));
      
      if (paragraphs.length > 2) {
        console.log(`Found ${paragraphs.length} paragraphs with ${selector}`);
        return paragraphs.join('\n\n');
      }
      
      // If not enough paragraphs, try other text containers
      if (paragraphs.length === 0) {
        const textContainers = Array.from(container.querySelectorAll('div, span'))
          .map(el => el.textContent.trim())
          .filter(text => 
            text.length > 100 && 
            text.length < 3000 &&
            text.split(' ').length > 20 &&
            !text.includes('Subscribe') &&
            !text.includes('Advertisement')
          );
        
        if (textContainers.length > 0) {
          console.log(`Using text containers from ${selector}, found: ${textContainers.length}`);
          return textContainers.slice(0, 5).join('\n\n');
        }
        
        // Last resort for this container
        const allText = container.textContent.trim();
        if (allText && allText.length > 200 && allText.split(' ').length > 30) {
          console.log(`Using container text content, length: ${allText.length}`);
                      
          // Clean up the text by splitting into sentences
          const sentences = allText.split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => 
              s.length > 50 && 
              s.length < 800 &&
              !s.includes('Subscribe') &&
              !s.includes('Advertisement') &&
              !s.includes('Cookie') &&
              !s.includes('Sign in') &&
              !s.toLowerCase().includes('newsletter') &&
              !s.match(/^\d+\s*(minute|min|hour|hr|day)\s*ago/i)
            )
            .slice(0, 15);
          
          if (sentences.length > 0) {
            return sentences.join('. ') + '.';
          }
        }
      }
    }
  }
  
  // ENHANCED: Universal fallback with better filtering
  console.log('Using enhanced universal fallback approach...');
  const allParagraphs = Array.from(document.querySelectorAll('p'))
    .map(p => p.textContent.trim())
    .filter(text => 
      text.length > 50 && 
      text.length < 2000 &&
      text.split(' ').length > 8 &&
      !text.toLowerCase().includes('subscribe') &&
      !text.toLowerCase().includes('newsletter') &&
      !text.toLowerCase().includes('advertisement') &&
      !text.toLowerCase().includes('follow us') &&
      !text.toLowerCase().includes('sign in') &&
      !text.toLowerCase().includes('menu') &&
      !text.toLowerCase().includes('search') &&
      !text.toLowerCase().includes('home') &&
      !text.toLowerCase().includes('contact') &&
      !text.toLowerCase().includes('privacy policy') &&
      !text.toLowerCase().includes('terms of service') &&
      !text.toLowerCase().includes('cookie policy') &&
      !text.toLowerCase().includes('click here') &&
      !text.toLowerCase().includes('download our app') &&
      !text.match(/^\d+\s*(minute|min|hour|hr|day)\s*ago/i) &&
      !text.match(/^By\s+[A-Z]/) &&
      !text.match(/^Updated\s+/i) &&
      !text.match(/^Published\s+/i) &&
      // Filter out social media and sharing text
      !text.match(/^(Share|Tweet|Post|Like|Follow)/i) &&
      // Filter out navigation elements
      !text.match(/^(Next|Previous|Back to|More from)/i)
    );
  
  if (allParagraphs.length >= 3) {
    console.log(`Enhanced universal fallback: Found ${allParagraphs.length} paragraphs`);
    return allParagraphs.slice(0, 20).join('\n\n');
  }
  
  // ENHANCED: Try looking for article content in common modern patterns
  console.log('Trying modern content patterns...');
  const modernSelectors = [
    '[class*="article"][class*="content"]',
    '[class*="story"][class*="body"]',
    '[class*="post"][class*="content"]',
    '[id*="article"]',
    '[id*="story"]',
    '[id*="content"]'
  ];
  
  for (const selector of modernSelectors) {
    const containers = document.querySelectorAll(selector);
    for (const container of containers) {
      const text = container.textContent.trim();
      if (text.length > 500 && text.split(' ').length > 50) {
        const sentences = text.split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => 
            s.length > 40 && 
            s.length < 600 &&
            !s.toLowerCase().includes('subscribe') &&
            !s.toLowerCase().includes('advertisement')
          )
          .slice(0, 12);
        
        if (sentences.length > 3) {
          console.log(`Found content with modern pattern: ${selector}`);
          return sentences.join('. ') + '.';
        }
      }
    }
  }
  
  // ENHANCED: Try JSON-LD structured data
  console.log('Trying JSON-LD structured data...');
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      const article = Array.isArray(data) ? data.find(item => item['@type'] === 'Article') : 
                     (data['@type'] === 'Article' ? data : null);
      
      if (article && article.articleBody) {
        console.log('Found article content in JSON-LD');
        return article.articleBody.substring(0, 5000); // Limit length
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }
  
  // ENHANCED: Look for content in data attributes
  console.log('Trying data attributes...');
  const dataElements = document.querySelectorAll('[data-content], [data-article], [data-text], [data-body]');
  for (const element of dataElements) {
    const content = element.dataset.content || element.dataset.article || 
                   element.dataset.text || element.dataset.body || element.textContent;
    
    if (content && content.length > 200) {
      console.log('Found content in data attributes');
      return content.substring(0, 5000);
    }
  }
  
  // ENHANCED: Final fallback - get substantial divs with better scoring
  console.log('Using enhanced div fallback with content scoring...');
  const allDivs = Array.from(document.querySelectorAll('div'))
    .map(d => ({
      element: d,
      text: d.textContent.trim(),
      wordCount: d.textContent.trim().split(' ').length,
      paragraphCount: d.querySelectorAll('p').length,
      hasNewsKeywords: /\b(said|according|reported|sources|statement|interview|press|news|today|yesterday|breaking)\b/i.test(d.textContent)
    }))
    .filter(item => 
      item.text.length > 100 && 
      item.text.length < 5000 &&
      item.wordCount > 20 &&
      item.wordCount < 800 &&
      !item.text.toLowerCase().includes('subscribe') &&
      !item.text.toLowerCase().includes('advertisement') &&
      !item.text.toLowerCase().includes('cookie') &&
      !item.element.querySelector('nav, header, footer, aside')
    )
    .sort((a, b) => {
      // Score based on length, paragraph count, and news keywords
      const scoreA = a.wordCount + (a.paragraphCount * 10) + (a.hasNewsKeywords ? 50 : 0);
      const scoreB = b.wordCount + (b.paragraphCount * 10) + (b.hasNewsKeywords ? 50 : 0);
      return scoreB - scoreA;
    });
  
  if (allDivs.length > 0) {
    console.log(`Enhanced div fallback: Found ${allDivs.length} scored content divs`);
    const bestDivs = allDivs.slice(0, 3).map(item => item.text);
    return bestDivs.join('\n\n');
  }
  
  // ABSOLUTE LAST RESORT: Try to find any substantial text
  console.log('Absolute last resort: scanning all text nodes...');
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const text = node.textContent.trim();
        if (text.length > 100 && 
            !text.toLowerCase().includes('script') &&
            !text.toLowerCase().includes('style') &&
            node.parentElement &&
            !node.parentElement.matches('script, style, nav, header, footer, aside')) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node.textContent.trim());
  }
  
  if (textNodes.length > 0) {
    const combinedText = textNodes.join(' ').substring(0, 3000);
    if (combinedText.length > 200) {
      console.log('Using text nodes fallback');
      return combinedText;
    }
  }
  
  console.log('No article content found with any method');
  return 'Article content could not be extracted. This might be due to dynamic loading, paywall, or unsupported site structure.';
}
