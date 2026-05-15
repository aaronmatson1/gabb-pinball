const themeKey = 'lgl-vibe-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function initTheme() {
  const saved = localStorage.getItem(themeKey);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(themeKey, next);
  applyTheme(next);
}

function renderCards(sites, filter) {
  const grid = document.getElementById('grid');
  const visible = filter === 'All' ? sites : sites.filter(s => s.tag === filter);

  grid.innerHTML = visible.map(s => `
    <article class="card">
      <a class="card-link-overlay" href="${s.url}" target="_blank" rel="noopener" aria-label="Open ${s.title}"></a>
      <span class="card-tag">${s.tag}</span>
      <h2 class="card-title">${s.title}</h2>
      <p class="card-desc">${s.description}</p>
      ${s.credentials ? `<div class="creds">Login: <code>${s.credentials.username}</code> / <code>${s.credentials.password}</code></div>` : ''}
      <div class="card-meta">
        <span class="card-audience">By ${s.by} · ${s.audience}</span>
        <span class="card-open">Open</span>
      </div>
    </article>
  `).join('');
}

function renderFilters(sites, current, onChange) {
  const tags = ['All', ...new Set(sites.map(s => s.tag))];
  const bar = document.getElementById('filters');
  bar.innerHTML = tags.map(t =>
    `<button class="filter-chip ${t === current ? 'active' : ''}" data-tag="${t}">${t}</button>`
  ).join('');
  bar.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => onChange(btn.dataset.tag));
  });
}

async function main() {
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  const res = await fetch('sites.json');
  const data = await res.json();
  document.getElementById('subtitle').textContent = data.meta.subtitle;
  document.getElementById('updated').textContent = `Updated ${data.meta.updated}`;
  document.title = data.meta.title;

  let current = 'All';
  const onChange = (tag) => {
    current = tag;
    renderFilters(data.sites, current, onChange);
    renderCards(data.sites, current);
  };
  renderFilters(data.sites, current, onChange);
  renderCards(data.sites, current);
}

main();
