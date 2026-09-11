import fs from 'fs';
import RSSParser from 'rss-parser';
import yaml from 'js-yaml';
import { readFile } from 'fs/promises';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};
const FEED_TIMEOUT_MS = 30_000;

const parser = new RSSParser();

// ScienceDirect feeds have no <pubDate>; derive one from "Publication date: <Month> <Year>"
// in the description (set to the 1st of that month).
function addPubDatesToRSS(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const items = doc.getElementsByTagName('item');

  Array.from(items).forEach(item => {
    const descriptionNode = item.getElementsByTagName('description')[0];
    if (!descriptionNode) return;
    const match = descriptionNode.textContent.match(/Publication date:.*?(\w+)\s+(\d{4})/i);

    if (match) {
      const [, month, year] = match;
      const pubDateNode = doc.createElement('pubDate');
      pubDateNode.textContent = `01 ${month.slice(0, 3)} ${year} 00:00:00 GMT`;
      item.appendChild(pubDateNode);
    }
  });

  return new XMLSerializer().serializeToString(doc);
}

async function processFeeds() {
  const allArticles = [];
  const failed = [];
  const config = yaml.load(await readFile(new URL('../config/journals.yaml', import.meta.url), 'utf8'));

  for (const journal of config.journals) {
    try {
      const response = await fetch(journal.link, {
        headers: REQUEST_HEADERS,
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let xmlString = await response.text();

      if (xmlString.includes('ScienceDirect RSS')) {
        xmlString = addPubDatesToRSS(xmlString);
      }

      const feed = await parser.parseString(xmlString);

      const articles = feed.items.map(item => {
        let parsedDate = null;
        if (item.isoDate) {
          parsedDate = new Date(item.isoDate);
        } else if (item.pubDate) {
          parsedDate = new Date(item.pubDate);
        }

        if (!parsedDate || isNaN(parsedDate)) {
          console.warn(`Invalid or missing date for article "${item.title}" in journal "${journal.title}". Using current date.`);
          parsedDate = new Date();
        }

        return {
          title: item.title || 'Untitled',
          link: item.link || '#',
          date: parsedDate.toISOString(),
          journal: journal.title,
        };
      });

      console.log(`${journal.title}: ${articles.length} articles`);
      allArticles.push(...articles);
    } catch (error) {
      failed.push(journal.title);
      console.error(`Failed to process ${journal.title}: ${error.message}`);
    }
  }

  // If nothing came back (network trouble etc.), stop here so the deploy step is
  // skipped and yesterday's version of the site stays online instead of an empty page.
  if (allArticles.length === 0) {
    throw new Error('No articles fetched from any feed - not publishing.');
  }

  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.mkdirSync('./public/data', { recursive: true });
  fs.writeFileSync('./public/data/entries.json', JSON.stringify(allArticles, null, 2));

  const buildDate = new Date().toISOString();
  fs.writeFileSync('./public/data/build-date.json', JSON.stringify({ buildDate }, null, 2));

  console.log(`\n${allArticles.length} articles from ${config.journals.length - failed.length}/${config.journals.length} journals.`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
  console.log(`Build date saved: ${buildDate}`);
}

processFeeds().catch(error => {
  console.error(error);
  process.exit(1);
});
