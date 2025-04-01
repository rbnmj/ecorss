import fs from 'fs';
import yaml from 'js-yaml';
import { JSDOM } from 'jsdom';
import { parse } from 'rss-to-json';

const config = yaml.load(fs.readFileSync('././src/config/journals.yaml', 'utf8'));
const dom = new JSDOM();

async function processFeeds() {
  const entries = [];
  
  for (const journal of config.journals) {
    try {
      const rss = await parse(journal.url);
      entries.push({
        ...journal,
        articles: rss.items.map(item => ({
          title: item.title,
          link: item.link,
          date: new Date(item.published).toLocaleDateString(),
          content: dom.window.document.createElement('div').innerHTML = item.content
        })),
      });
    } catch (error) {
      console.error(`Failed to process ${journal.title}:`, error);
    }
  }
  
  fs.mkdirSync('././public/data', { recursive: true });
  fs.writeFileSync('././public/data/entries.json', JSON.stringify(entries));
}

processFeeds();