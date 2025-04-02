import fs from 'fs';
import yaml from 'js-yaml';
import { readFile } from 'fs/promises';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import RSSParserPkg from 'rss-parser'; // Corrected import
const Parser = RSSParserPkg.default ? RSSParserPkg.default : RSSParserPkg; // Handle ESM wrapper
import fetch from 'node-fetch';

// Configure XML processors
const xmlParser = new XMLParser({ /* ... */ });
const xmlBuilder = new XMLBuilder({ /* ... */ });

// Initialize RSS parser correctly
const rssParser = new Parser({ // Use Parser directly
  customHeaders: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 [...]',
    'Accept': 'application/rss+xml'
  }
});

async function preprocessScienceDirectFeed(url) {
  try {
    const response = await fetch(url);
    const xml = await response.text();
    const parsed = xmlParser.parse(xml);

    if (parsed.rss?.channel?.item) {
      parsed.rss.channel.item = parsed.rss.channel.item.map(item => {
        const dateMatch = item.description?.match(
          /Publication date:\s*([A-Za-z]+)\s+(\d{4})/i
        );

        if (dateMatch) {
          const [_, month, year] = dateMatch;
          const date = new Date(`${month} 1, ${year}`);
          item.pubDate = date.toUTCString();
        } else {
          item.pubDate = new Date().toUTCString();
        }
        return item;
      });
    }

    return xmlBuilder.build(parsed);
  } catch (error) {
    console.error('Feed preprocessing failed:', error);
    return null;
  }
}

async function processFeeds() {
  const allArticles = [];
  const config = yaml.load(await readFile(new URL('../config/journals.yaml', import.meta.url), 'utf8'));

  for (const journal of config.journals) {
    try {
      let feed;
      
      if (journal.link.startsWith('https://rss.sciencedirect.com/')) {
        const modifiedXml = await preprocessScienceDirectFeed(journal.link);
        if (!modifiedXml) continue;
        feed = await rssParser.parseString(modifiedXml);
      } else {
        feed = await rssParser.parseURL(journal.link);
      }

      const articles = feed.items.map(item => ({
        title: item.title?.trim() || 'Untitled',
        link: item.link || '#',
        date: new Date(item.pubDate || item.isoDate).toISOString(),
        journal: journal.title
      })).filter(article => article.title !== 'Untitled');

      allArticles.push(...articles);
    } catch (error) {
      console.error(`Failed to process ${journal.title}:`, error.message);
    }
  }

  // Final processing
  allArticles.sort((a, b) => b.date.localeCompare(a.date));
  fs.mkdirSync('./public/data', { recursive: true });
  fs.writeFileSync('./public/data/entries.json', JSON.stringify(allArticles, null, 2));
}

processFeeds();
