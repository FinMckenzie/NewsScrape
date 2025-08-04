# News Scraper Chrome Extension

A powerful Chrome extension that scrapes news articles from multiple sources and automatically creates organized Google Docs reports with the collected content.

## 🚀 Features

- **Multi-Source Scraping**: Supports 17+ major news sources including NYT, CNN, BBC, Reuters, Bloomberg, and more
- **Custom Sources**: Add your own news websites to scrape
- **Keyword Filtering**: Filter articles by specific keywords or scrape all content
- **Smart Scrolling**: Advanced scroll detection to find articles below the fold
- **Auto Google Docs**: Automatically creates formatted Google Docs with scraped content
- **Site-Specific Extractors**: Optimized content extraction for different news sites
- **Batch Processing**: Efficiently handles multiple sources simultaneously
- **Progress Tracking**: Real-time progress updates during scraping

## 📥 Installation

### From Chrome Web Store
1. Visit the [Soon to be published]
2. Click "Add to Chrome"
3. Confirm installation

### Manual Installation (Development)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder

## 🔧 Setup

1. **Install the extension**
2. **Authenticate with Google**:
   - Click the extension icon
   - Click "Google Auth" button
   - Sign in to your Google account
   - Grant permissions for Google Docs creation

## 📖 Usage

### Quick Start
1. Click the News Scraper extension icon
2. Select news sources from the list
3. (Optional) Add keywords to filter articles
4. Click "Launch Scraper"
5. Wait for scraping to complete
6. Your Google Doc will open automatically

### Adding Custom Sources
1. Click "+ Add Site" in the Sources section
2. Enter the source name (e.g., "TechCrunch")
3. Enter the URL (e.g., "https://techcrunch.com")
4. Click "Save"

### Using Keywords
1. Type keywords in the keyword input field
2. Click "+ Add" or press Enter
3. Keywords filter articles containing those terms
4. Leave empty to scrape all articles

## 🌐 Supported News Sources

### Default Sources
- **Bloomberg** - Financial and business news
- **CNBC** - Business and technology news
- **New York Times** - General news and politics
- **Reuters** - International news
- **BBC** - World news
- **CNN** - Breaking news and politics
- **NBC News** - National news
- **Fox News** - Political news
- **Wall Street Journal** - Business news
- **Washington Post** - Political news
- **The Guardian** - International news
- **Associated Press** - Wire news
- **NPR** - Public radio news
- **Al Jazeera** - Middle East news
- **The Economist** - Economic analysis
- **Forbes** - Business and finance
- **USA Today** - General news

### Custom Sources
Add any news website by providing:
- Source name
- Website URL
- Not due to formatting anomalies, some custom sites won't work

## 🔒 Privacy & Permissions

### Required Permissions
- `tabs` - Create temporary tabs for news website access
- `scripting` - Extract article content from web pages
- `identity` - Authenticate with Google for document creation
- `activeTab` - Interact with extension popup
- `host_permissions` - Access news websites for content extraction

### Data Handling
- **No personal data collection**
- **Local storage only** for preferences
- **Direct Google Docs integration** via official API
- **No external servers** - all processing in your browser

**Full Privacy Policy**: [https://yourusername.github.io/news-scraper-privacy/](https://yourusername.github.io/news-scraper-privacy/)

## 🛠️ Technical Details

### Architecture
- **Popup Interface**: HTML/CSS/JavaScript user interface
- **Background Script**: Service worker handling scraping logic
- **Content Scripts**: Injected scripts for article extraction
- **Google APIs**: OAuth 2.0 and Google Docs API integration

### Site-Specific Extractors
Optimized content extraction for:
- Paywalled sites (NYT, WSJ, Washington Post)
- Complex layouts (CNN, Fox News, Bloomberg)
- Dynamic content (Reuters, Guardian)
- Tech sites (Electrek, InsideEVs)

### Performance Features
- **Concurrent processing** of multiple sources
- **Rate limiting** to avoid overwhelming servers
- **Smart retry logic** for failed requests
- **Content deduplication**
- **Automatic scroll detection** for infinite scroll sites

## 📊 Output Format

Generated Google Docs include:
- **Header** with date/time and total article count
- **Organized by source** with article counts
- **Formatted articles** with titles, URLs, and content
- **Clickable links** to original articles
- **Clean formatting** optimized for reading

## ⚡ Troubleshooting

### Common Issues

**"No articles scraped" error:**
- Check internet connection
- Verify news sites are accessible
- Try with fewer sources
- Clear browser cache

**Google authentication fails:**
- Enable third-party cookies
- Check popup blockers
- Try incognito mode
- Re-authenticate from extension

**Content extraction issues:**
- Some sites may block automated access
- Paywalled content may be limited
- Dynamic sites may need longer load times

### Debug Mode
1. Open Chrome DevTools
2. Go to Extensions tab
3. Find "News Scraper" and click "Inspect views: background page"
4. Check console for detailed logs

## 🔄 Updates

### Version History
- **v1.0.0** - Initial release with basic scraping
- **v1.1.0** - Added scroll detection and custom sources
- **v1.2.0** - Enhanced site-specific extractors

### Automatic Updates
The extension automatically updates through the Chrome Web Store.

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome:
- Report bugs through GitHub Issues
- Suggest new features
- Share problematic news sites

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

- **Respect robots.txt**: Use responsibly and respect website terms of service
- **Rate limiting**: Built-in delays prevent overwhelming news servers  
- **Educational use**: Intended for personal news aggregation
- **No warranty**: Use at your own risk

## 🔗 Links

- **Chrome Web Store**: [Soon to come]
- **Privacy Policy**: [Soon to come]
- **Support**: [Contact Email](finjmckenzie@gmail.com)

## 📞 Support

For questions, issues, or feature requests:
- **Email**: finjmckenzie@gmail.com
- **Response Time**: Within 2-3 business days
- **GitHub Issues**: For bug reports and feature requests

---
Fin McKenzie
Aug 4, 2025
