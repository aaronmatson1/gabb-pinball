const themeKey = 'lgl-vibe-theme';

const DATA = {
  meta: {
    title: 'LGL Vibecoding',
    subtitle: 'Things the old Little Giant marketing crew is building on the side',
    updated: '2026-05-15'
  },
  sites: [
    {
      id: 'llpa-pinball',
      title: 'Shark Tunnel Pinball',
      url: 'https://llpa-pinball.netlify.app/',
      tag: 'Game',
      by: 'James',
      audience: 'Loveland Living Planet Aquarium',
      description: "Pinball adventure themed around the aquarium's Shark Tunnel — progress through ocean modes."
    },
    {
      id: 'build-a-beast',
      title: 'Build-A-Beast',
      url: 'https://build-a-beast.netlify.app/',
      tag: 'Interactive',
      by: 'James',
      audience: 'Loveland Living Planet Aquarium',
      description: 'Configurator that lets visitors build and customize aquatic creatures.'
    },
    {
      id: 'coloraquarium',
      title: 'Color Aquarium',
      url: 'https://coloraquarium.netlify.app/',
      tag: 'Interactive',
      by: 'James',
      audience: 'Loveland Living Planet Aquarium',
      description: 'Pick a fish, color it, set it free in a virtual aquarium.'
    },
    {
      id: 'yes-yeti-pinball',
      title: 'YES Yeti Pinball',
      url: 'https://yes-yeti-pinball-v9bz.onrender.com',
      tag: 'Game',
      by: 'Marc',
      audience: 'YES Staffing',
      description: '3D React + Three.js Yeti pinball with a Retro-Tech Terminal aesthetic.'
    },
    {
      id: 'nps-display',
      title: 'NPS Display',
      url: 'https://nps-display.netlify.app/',
      tag: 'Dashboard',
      by: 'James',
      audience: 'NPS reporting',
      description: 'Net Promoter Score visualization.'
    },
    {
      id: 'heartfelt-swan',
      title: 'Marketing Calendar',
      url: 'https://heartfelt-swan-8265e2.netlify.app/',
      tag: 'Tool',
      by: 'James',
      audience: 'Marketing team',
      description: 'Calendar for planning campaigns and marketing activities.'
    },
    {
      id: 'cmo-command-center',
      title: 'CMO Command Center',
      url: 'https://cmo-command-center.onrender.com/',
      tag: 'Dashboard',
      by: 'Marc',
      audience: 'YES Staffing CMO',
      description: "Marc's executive marketing command center — daily brief, KPIs, and approvals.",
      credentials: { username: 'YES', password: 'christina' }
    },
    {
      id: 'yes-design-system',
      title: 'YES Design System',
      url: 'https://yes-design-system.onrender.com/',
      tag: 'Reference',
      by: 'Marc',
      audience: 'YES Staffing',
      description: 'Brand tokens, components, and standards for YES — fonts, colors, six surfaces.'
    },
    {
      id: 'csp-study',
      title: 'CSP Study',
      url: 'https://csp-study.onrender.com/dashboard.html',
      tag: 'Personal',
      by: 'Marc',
      audience: 'CSP exam prep',
      description: "Marc's 28-day Certified Staffing Professional exam prep system."
    }
  ]
};

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

function main() {
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  document.getElementById('subtitle').textContent = DATA.meta.subtitle;
  document.getElementById('updated').textContent = `Updated ${DATA.meta.updated}`;
  document.title = DATA.meta.title;

  let current = 'All';
  const onChange = (tag) => {
    current = tag;
    renderFilters(DATA.sites, current, onChange);
    renderCards(DATA.sites, current);
  };
  renderFilters(DATA.sites, current, onChange);
  renderCards(DATA.sites, current);
}

/* ---------- Gate ---------- */
const GATE_HASH = '8a3573aca0b76d5df0ec3be2be9b9d6c10228d8e2be554b43f864fd01fc734b7';
const UNLOCK_KEY = 'lgl-vibe-unlocked';

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function reveal() {
  document.getElementById('gate').hidden = true;
  document.getElementById('shell').hidden = false;
  main();
}

async function boot() {
  if (localStorage.getItem(UNLOCK_KEY) === '1') {
    reveal();
    return;
  }
  const gate = document.getElementById('gate');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-input');
  const err = document.getElementById('gate-error');

  gate.hidden = false;
  setTimeout(() => input.focus(), 50);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const h = await sha256(input.value.trim().toLowerCase());
    if (h === GATE_HASH) {
      localStorage.setItem(UNLOCK_KEY, '1');
      reveal();
    } else {
      err.hidden = false;
      input.classList.add('shake');
      input.select();
      setTimeout(() => input.classList.remove('shake'), 400);
    }
  });
}

boot();
