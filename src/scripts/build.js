import fs from 'fs';
import yaml from 'js-yaml';
import { JSDOM } from 'jsdom';
import rssToJson from 'rss-to-json';

const { parse } = rssToJson;

const config = yaml.load(fs.readFileSync('./src/config/journals.yaml', 'utf8'));
const dom = new JSDOM();

async function processFeeds() {
  const entries = [];

  for (const journal of config.journals) {
    try {
      const rss = await parse(journal.url);
      entries.push({
        title: journal.title,
        articles: rss.items.map(item => ({
          title: item.title,
          url: item.url,
          date: item.published
        })),
      });
    } catch (error) {
      console.error(`Failed to process ${journal.title}:`, error);
    }
  }

  fs.mkdirSync('./public/data', { recursive: true });
  fs.writeFileSync('./public/data/entries.json', JSON.stringify(entries));
}

processFeeds();
