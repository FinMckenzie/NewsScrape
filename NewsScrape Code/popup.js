// popup.js - UNCHANGED (keeping your existing popup code)
class EVContentScraper {
  constructor() {
    this.keywords = [];
    this.customSources = [];
    this.cacheDom();
    this.bindEvents();
    this.loadCustomSources();
    this.renderKeywords();
    this.updateStatus('Ready', 'ready');
    this.checkAuth();
  }

  cacheDom() {
    this.btnScrape = document.getElementById('scrape-btn');
    this.btnAuth = document.getElementById('auth-btn');
    this.btnClearAuth = document.getElementById('clear-auth');
    this.btnSelectAll = document.getElementById('select-all');
    this.btnAddKeyword = document.getElementById('add-keyword');
    this.btnAddSource = document.getElementById('add-source-btn');
    this.btnSaveSource = document.getElementById('save-source-btn');
    this.btnCancelSource = document.getElementById('cancel-source-btn');
    
    this.inputKeyword = document.getElementById('keyword-input');
    this.inputSourceName = document.getElementById('source-name-input');
    this.inputSourceUrl = document.getElementById('source-url-input');
    
    this.divKeywordTags = document.getElementById('keyword-tags');
    this.divCustomSources = document.getElementById('custom-sources');
    this.divAddSourceForm = document.getElementById('add-source-form');
    this.divKeywordEmptyState = document.getElementById('keyword-empty-state');
    this.divResults = document.getElementById('results');
    
    this.spanStatus = document.getElementById('status');
    this.fillProgress = document.getElementById('progress-fill');
    this.textProgress = document.getElementById('progress-text');
    this.spanArticles = document.getElementById('articles-count');
    this.spanSources = document.getElementById('sources-count');
  }

  bindEvents() {
    this.btnScrape.addEventListener('click', () => this.onLaunchScraper());
    this.btnAuth.addEventListener('click', () => this.authenticate());
    this.btnClearAuth.addEventListener('click', () => this.clearAuth());
    this.btnSelectAll.addEventListener('click', () => this.toggleSelectAll());
    this.btnAddKeyword.addEventListener('click', () => this.addKeyword());
    this.btnAddSource.addEventListener('click', () => this.showAddSourceForm());
    this.btnSaveSource.addEventListener('click', () => this.saveCustomSource());
    this.btnCancelSource.addEventListener('click', () => this.hideAddSourceForm());
    
    this.inputKeyword.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.addKeyword();
        e.preventDefault();
      }
    });
    
    this.inputSourceUrl.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.saveCustomSource();
        e.preventDefault();
      }
    });
  }

  checkAuth() {
    chrome.storage.local.get('googleToken', res => {
      if (res.googleToken) {
        this.accessToken = res.googleToken;
        this.btnAuth.classList.add('connected');
        this.btnAuth.querySelector('.btn-icon').textContent = '✅';
        this.btnAuth.querySelector('span:last-child').textContent = 'Connected';
        this.updateStatus('Ready (authenticated)', 'success');
      }
    });
  }

  authenticate() {
    this.updateStatus('…Authenticating…', 'scraping');
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError || !token) {
        console.error('Auth failed:', chrome.runtime.lastError);
        this.updateStatus('❌ Auth failed', 'error');
        return;
      }
      console.log('Got token:', token);
      this.accessToken = token;
      chrome.storage.local.set({ googleToken: token }, () => {
        console.log('Token saved');
      });
      this.btnAuth.classList.add('connected');
      this.btnAuth.querySelector('.btn-icon').textContent = '✅';
      this.btnAuth.querySelector('span:last-child').textContent = 'Connected';
      this.updateStatus('🎉 Authenticated', 'success');
    });
  }

  clearAuth() {
    console.log('Clearing stored token…');
    chrome.identity.getAuthToken({ interactive: false }, currentToken => {
      if (!currentToken) {
        console.log('No token to remove');
        return;
      }
      chrome.identity.removeCachedAuthToken({ token: currentToken }, () => {
        console.log('Removed from Chrome cache:', currentToken);
        chrome.storage.local.remove('googleToken', () => {
          console.log('Removed from local storage');
          this.btnAuth.classList.remove('connected');
          this.btnAuth.querySelector('.btn-icon').textContent = '🔐';
          this.btnAuth.querySelector('span:last-child').textContent = 'Google Auth';
          this.updateStatus('Logged out', 'ready');
        });
      });
    });
  }

  loadCustomSources() {
    chrome.storage.local.get('customSources', res => {
      this.customSources = res.customSources || [];
      this.renderCustomSources();
    });
  }

  saveCustomSources() {
    chrome.storage.local.set({ customSources: this.customSources });
  }

  showAddSourceForm() {
    this.divAddSourceForm.style.display = 'block';
    this.inputSourceName.focus();
  }

  hideAddSourceForm() {
    this.divAddSourceForm.style.display = 'none';
    this.inputSourceName.value = '';
    this.inputSourceUrl.value = '';
  }

  saveCustomSource() {
    const name = this.inputSourceName.value.trim();
    const url = this.inputSourceUrl.value.trim();
    
    if (!name || !url) {
      this.updateStatus('Please enter both name and URL', 'error');
      return;
    }
    
    try {
      new URL(url);
    } catch {
      this.updateStatus('Please enter a valid URL', 'error');
      return;
    }
    
    if (this.customSources.some(source => source.url === url)) {
      this.updateStatus('This URL is already added', 'error');
      return;
    }
    
    const newSource = {
      id: `custom-${Date.now()}`,
      name: name,
      url: url,
      checked: true
    };
    
    this.customSources.push(newSource);
    this.saveCustomSources();
    this.renderCustomSources();
    this.hideAddSourceForm();
    this.updateStatus(`Added ${name}`, 'success');
  }

  removeCustomSource(id) {
    this.customSources = this.customSources.filter(source => source.id !== id);
    this.saveCustomSources();
    this.renderCustomSources();
    this.updateStatus('Source removed', 'ready');
  }

  renderCustomSources() {
    this.divCustomSources.innerHTML = '';
    this.customSources.forEach(source => {
      const div = document.createElement('div');
      div.className = 'custom-source';
      div.innerHTML = `
        <div class="custom-source-header">
          <label>
            <input type="checkbox" id="${source.id}" ${source.checked ? 'checked' : ''}>
            <span class="custom-source-name">${source.name}</span>
          </label>
          <button class="remove-source" data-id="${source.id}">Remove</button>
        </div>
        <div class="custom-source-url">${source.url}</div>
      `;
      
      const checkbox = div.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        source.checked = checkbox.checked;
        this.saveCustomSources();
      });
      
      const removeBtn = div.querySelector('.remove-source');
      removeBtn.addEventListener('click', () => {
        if (confirm(`Remove ${source.name}?`)) {
          this.removeCustomSource(source.id);
        }
      });
      
      this.divCustomSources.appendChild(div);
    });
  }

  renderKeywords() {
    this.divKeywordTags.innerHTML = '';
    
    if (this.keywords.length === 0) {
      this.divKeywordEmptyState.style.display = 'block';
      return;
    }
    
    this.divKeywordEmptyState.style.display = 'none';
    
    this.keywords.forEach((kw, idx) => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = kw;
      
      const rm = document.createElement('span');
      rm.className = 'remove-keyword';
      rm.textContent = '×';
      rm.title = 'Remove';
      rm.addEventListener('click', () => {
        this.keywords.splice(idx, 1);
        this.renderKeywords();
      });
      
      tag.appendChild(rm);
      this.divKeywordTags.appendChild(tag);
    });
  }

  addKeyword() {
    const val = this.inputKeyword.value.trim().toLowerCase();
    if (val && !this.keywords.includes(val)) {
      this.keywords.push(val);
      this.renderKeywords();
    }
    this.inputKeyword.value = '';
    this.inputKeyword.focus();
  }

  toggleSelectAll() {
    const defaultBoxes = document.querySelectorAll('#default-sources input[type=checkbox]');
    const customBoxes = document.querySelectorAll('#custom-sources input[type=checkbox]');
    const allBoxes = [...defaultBoxes, ...customBoxes];
    
    const allChecked = allBoxes.every(cb => cb.checked);
    
    defaultBoxes.forEach(cb => (cb.checked = !allChecked));
    
    customBoxes.forEach(cb => {
      cb.checked = !allChecked;
      const sourceId = cb.id;
      const customSource = this.customSources.find(s => s.id === sourceId);
      if (customSource) {
        customSource.checked = !allChecked;
      }
    });
    
    this.saveCustomSources();
    this.btnSelectAll.textContent = allChecked ? 'Select All' : 'Deselect All';
  }

  collectSources() {
    const defaultSourceMap = {
      'bloomberg-check': { 
        name: 'Bloomberg', 
        urls: ['https://www.bloomberg.com/'] 
      },
      'cnbc-check': { 
        name: 'CNBC', 
        urls: ['https://www.cnbc.com/technology/'] 
      },
      'nytimes-check': { 
        name: 'New York Times', 
        urls: ['https://www.nytimes.com/'] 
      },
      'reuters-check': { 
        name: 'Reuters', 
        urls: ['https://www.reuters.com/'] 
      },
      'bbc-check': { 
        name: 'BBC', 
        urls: ['https://www.bbc.com/news'] 
      },
      'cnn-check': { 
        name: 'CNN', 
        urls: ['https://www.cnn.com/'] 
      },
      'nbcnews-check': { 
        name: 'NBC News', 
        urls: ['https://www.nbcnews.com/'] 
      },
      'foxnews-check': { 
        name: 'Fox News', 
        urls: ['https://www.foxnews.com/'] 
      },
      'wsj-check': { 
        name: 'Wall Street Journal', 
        urls: ['https://www.wsj.com/news/business'] 
      },
      'washingtonpost-check': { 
        name: 'Washington Post', 
        urls: ['https://www.washingtonpost.com/'] 
      },
      'guardian-check': { 
        name: 'The Guardian', 
        urls: ['https://www.theguardian.com/'] 
      },
      'apnews-check': { 
        name: 'Associated Press', 
        urls: ['https://www.apnews.com/'] 
      },
      'npr-check': { 
        name: 'NPR', 
        urls: ['https://www.npr.org/'] 
      },
      'aljazeera-check': { 
        name: 'Al Jazeera', 
        urls: ['https://www.aljazeera.com/'] 
      },
      'economist-check': { 
        name: 'The Economist', 
        urls: ['https://www.economist.com/'] 
      },
      'forbes-check': { 
        name: 'Forbes', 
        urls: ['https://www.forbes.com/'] 
      },
      'usatoday-check': { 
        name: 'USA Today', 
        urls: ['https://www.usatoday.com/'] 
      }
    };
    
    const sources = [];
    
    Object.entries(defaultSourceMap).forEach(([id, src]) => {
      const checkbox = document.getElementById(id);
      if (checkbox && checkbox.checked) {
        sources.push(src);
      }
    });
    
    this.customSources.forEach(source => {
      const checkbox = document.getElementById(source.id);
      if (checkbox && checkbox.checked) {
        sources.push({
          name: source.name,
          urls: [source.url]
        });
      }
    });
    
    return sources;
  }

  onLaunchScraper() {
    const sources = this.collectSources();
    
    if (!sources.length) {
      this.updateStatus('Select at least 1 source', 'error');
      return;
    }
    
    let keywordsToUse = this.keywords;
    if (this.keywords.length === 0) {
      if (!confirm('No keywords added. This will scrape ALL articles from selected sources. Continue?')) {
        return;
      }
      keywordsToUse = [''];
    }
    
    this.btnScrape.disabled = true;
    this.updateStatus('🔍 Scraping articles...', 'scraping');
    this.setProgress(10);
    
    const progressInterval = setInterval(() => {
      const currentProgress = parseInt(this.fillProgress.style.width) || 10;
      if (currentProgress < 90) {
        this.setProgress(currentProgress + 5);
      }
    }, 2000);
    
    chrome.runtime.sendMessage(
      { action: 'startScrape', sources, keywords: keywordsToUse },
      response => {
        clearInterval(progressInterval);
        console.log('Popup got response:', response);
        this.btnScrape.disabled = false;
        this.setProgress(100);
        
        if (!response || !response.success) {
          this.updateStatus(`❌ ${response?.error || 'Scrape failed'}`, 'error');
          return;
        }
        
        this.updateStatus('📄 Document created!', 'success');
        this.divResults.innerHTML = '';
        
        const link = document.createElement('a');
        link.href = `https://docs.google.com/document/d/${response.documentId}/edit`;
        link.target = '_blank';
        link.textContent = 'Open News Report';
        link.className = 'doc-link';
        
        this.divResults.appendChild(link);
      }
    );
  }

  updateStatus(msg, type) {
    this.spanStatus.textContent = msg;
    this.spanStatus.className = `status ${type}`;
  }

  setProgress(pct) {
    this.fillProgress.style.width = `${pct}%`;
    this.textProgress.textContent = `${Math.round(pct)}%`;
  }
}

document.addEventListener('DOMContentLoaded', () => new EVContentScraper());