import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const buildSha = document.querySelector('[data-testid="build-sha"]');

const acked = new Map(); // id -> ackedAt
let selectedId = null;

function formatTime(iso) {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return fmt.format(date);
}

function rowHtml(i) {
  const ackedAt = acked.get(i.id);
  return `<li data-testid="incident-row" data-id="${i.id}" class="row ${i.severity}${ackedAt ? ' acked' : ''}${i.id === selectedId ? ' selected' : ''}" tabindex="0">
    <span class="id">${i.id}</span>
    <span class="sev">${i.severity}</span>
    <span class="what">${i.service} · ${i.region} · ${i.summary}</span>
    <time datetime="${i.openedAt}">${formatTime(i.openedAt)}</time>
    ${ackedAt ? `<span data-testid="acked" class="acked-mark">acked ${formatTime(ackedAt)}</span>` : ''}
  </li>`;
}

function panelHtml(i) {
  const ackedAt = acked.get(i.id);
  return `<aside data-testid="incident-panel" data-id="${i.id}" class="panel">
    <h2>${i.id} <span class="sev sev-${i.severity}">${i.severity}</span></h2>
    <p class="what">${i.service} · ${i.region}</p>
    <p>${i.summary}</p>
    <p class="opened">opened <time datetime="${i.openedAt}">${formatTime(i.openedAt)}</time></p>
    ${
      ackedAt
        ? `<p data-testid="acked" class="acked-mark">acked ${formatTime(ackedAt)}</p>`
        : `<button data-testid="panel-ack" data-id="${i.id}" class="ack-btn">Ack</button>`
    }
  </aside>`;
}

function render(incidents) {
  if (!incidents.length) {
    list.innerHTML = '';
    empty.hidden = false;
    renderPanel(incidents);
    return;
  }
  empty.hidden = true;
  list.innerHTML = incidents.map(rowHtml).join('');
  renderPanel(incidents);
}

function renderPanel(incidents) {
  const existing = board.querySelector('[data-testid="incident-panel"]');
  const current = selectedId && incidents.find((i) => i.id === selectedId);
  if (!current) {
    existing?.remove();
    selectedId = null;
    return;
  }
  const html = panelHtml(current);
  if (existing) existing.outerHTML = html;
  else board.insertAdjacentHTML('beforeend', html);
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
  } finally {
    loader.hidden = true;
  }
}

board.addEventListener('click', async (e) => {
  const panelAck = e.target.closest('[data-testid="panel-ack"]');
  if (panelAck) {
    panelAck.disabled = true;
    try {
      const reply = await ack(panelAck.dataset.id);
      acked.set(reply.id, reply.ackedAt);
      await refresh();
    } catch (err) {
      panelAck.disabled = false;
      console.error(err);
    }
    return;
  }
  const row = e.target.closest('[data-testid="incident-row"]');
  if (row) {
    selectedId = row.dataset.id === selectedId ? null : row.dataset.id;
    fetchIncidents().then((page) => render(page.incidents)).catch(() => {});
  }
});

buildSha.textContent = document.querySelector('meta[name="build"]').content;

await refresh();
setInterval(refresh, 2000);
