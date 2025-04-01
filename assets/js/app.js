import DOMPurify from './purifier.js';

class FeedManager {
  constructor() {
    this.journalContainer = document.querySelector('.journal-list');
    this.tagContainer = document.querySelector('.tag-filters');
    this.allTags = new Set();
    
    this.init();
  }

  async init() {
    await this.loadData();
    this.renderTags();
    this.renderJournals();
    this.addEventListeners();
  }

  async loadData() {
    const response = await fetch('./data/entries.json');
    this.data = await response.json();
    this.collectTags();
  }

  collectTags() {
    this.data.forEach(journal => {
      journal.tags.forEach(tag => this.allTags.add(tag));
    });
  }

  renderTags() {
    this.tagContainer.innerHTML = [...this.allTags].map(tag => `
      <button class="tag-filter" data-tag="${tag}">${tag}</button>
    `).join('');
  }

  renderJournals() {
    this.journalContainer.innerHTML = this.data.map(journal => `
      <article class="journal-card" data-tags="${journal.tags.join(' ')}">
        <h2><a href="${journal.url}" target="_blank">${journal.title}</a></h2>
        <div class="articles">
          ${journal.articles.map(article => `
            <div class="article">
              <h3><a href="${article.link}">${article.title}</a></h3>
              <time>${article.date}</time>
              <div class="content">${DOMPurify.sanitize(article.content)}</div>
            </div>
          `).join('')}
        </div>
      </article>
    `).join('');
  }

  addEventListeners() {
    this.tagContainer.addEventListener('click', e => {
      if (e.target.classList.contains('tag-filter')) {
        this.filterByTag(e.target.dataset.tag);
      }
    });

    document.querySelector('.refresh-button').addEventListener('click', () => {
      location.reload();
    });
  }

  filterByTag(tag) {
    document.querySelectorAll('.journal-card').forEach(card => {
      card.style.display = card.dataset.tags.includes(tag) ? 'block' : 'none';
    });
  }
}

new FeedManager();