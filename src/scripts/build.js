import fs from 'fs';
import RSSParser from 'rss-parser';
import yaml from 'js-yaml';
import { readFile } from 'fs/promises';

// Configure rss-parser with custom headers
const parser = new RSSParser({
  customHeaders: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
  },
});

async function processFeeds() {
  const allArticles = [];

  // Load the YAML configuration file
  const config = yaml.load(await readFile(new URL('../config/journals.yaml', import.meta.url), 'utf8'));

  for (const journal of config.journals) {
    try {
      const feed = await parser.parseURL(journal.link);

      // Check if the feed contains valid items
      if (!feed || !feed.items || feed.items.length === 0) {
        console.warn(`No valid items found for ${journal.title}`);
        continue;
      }

      // Process articles and add them to the global list
      const articles = feed.items.map(item => {
        let parsedDate = null;

        // Attempt to use isoDate or pubDate
        if (item.isoDate) {
          parsedDate = new Date(item.isoDate);
        } else if (item.pubDate) {
          parsedDate = new Date(item.pubDate);
        }

        // Fallback to current date if no valid date is found
        if (!parsedDate || isNaN(parsedDate)) {
          console.warn(`Invalid or missing date for article "${item.title}" in journal "${journal.title}". Using current date.`);
          parsedDate = new Date(Date.now());
        }

        return {
          title: item.title || 'Untitled', // Fallback for missing titles
          link: item.link || '#',         // Fallback for missing links
          date: parsedDate.toISOString(), // Use parsed or fallback date
          journal: journal.title,         // Include journal title for context
        };
      });

      allArticles.push(...articles); // Add articles to the global list
    } catch (error) {
      console.error(`Failed to process ${journal.title}:`, error);
    }
  }

  // Sort all articles by date in descending order
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Write the sorted articles to entries.json
  fs.mkdirSync('./public/data', { recursive: true });
  fs.writeFileSync('./public/data/entries.json', JSON.stringify(allArticles, null, 2)); // Pretty-print JSON
}

processFeeds();