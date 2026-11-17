import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const buildSha = document.querySelector('[data-testid="build-sha"]');

const acked = new Map(); // id -> ackedAt

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

function render(incidents) {
  if (!incidents.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.innerHTML = incidents
    .map((i) => {
      const ackedAt = acked.get(i.id);
      return `<li data-testid="incident-row" data-id="${i.id}" class="row ${i.severity}${ackedAt ? ' acked' : ''}">
        <span class="id">${i.id}</span>
        <span class="sev">${i.severity}</span>
        <span class="what">${i.service} · ${i.region} · ${i.summary}</span>
        <time datetime="${i.openedAt}">${formatTime(i.openedAt)}</time>
        ${
          ackedAt
            ? `<span data-testid="acked" class="acked-mark">acked ${formatTime(ackedAt)}</span>`
            : `<button data-testid="ack" class="ack-btn" data-id="${i.id}">Ack</button>`
        }
      </li>`;
    })
    .join('');
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
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  btn.disabled = true;
  try {
    const reply = await ack(btn.dataset.id);
    acked.set(reply.id, reply.ackedAt);
    await refresh();
  } catch (err) {
    btn.disabled = false;
    console.error(err);
  }
});

buildSha.textContent = document.querySelector('meta[name="build"]').content;

await refresh();
setInterval(refresh, 2000);
