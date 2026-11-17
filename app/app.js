import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const buildSha = document.querySelector('[data-testid="build-sha"]');

const acked = new Map(); // id -> ackedAt
let selectedId = null;
const rowEls = new Map(); // id -> <li>

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

function rowContent(i) {
  const ackedAt = acked.get(i.id);
  return {
    className: `row ${i.severity}${ackedAt ? ' acked' : ''}${i.id === selectedId ? ' selected' : ''}`,
    innerHTML: `<span class="id">${i.id}</span>
        <span class="sev">${i.severity}</span>
        <span class="what">${i.service} · ${i.region} · ${i.summary}</span>
        <time datetime="${i.openedAt}">${formatTime(i.openedAt)}</time>
        ${ackedAt ? `<span data-testid="acked" class="acked-mark">acked ${formatTime(ackedAt)}</span>` : ''}`,
  };
}

function rowHtml(i) {
  const li = document.createElement('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = i.id;
  li.tabIndex = 0;
  const { className, innerHTML } = rowContent(i);
  li.className = className;
  li.innerHTML = innerHTML;
  return li;
}

// Keyed render: new rows are inserted where they belong, existing rows are patched in
// place, and a row is removed only when its incident is no longer in the answer.
function render(incidents) {
  empty.hidden = incidents.length > 0;
  const seen = new Set();
  let anchor = list.firstElementChild;
  for (const i of incidents) {
    seen.add(i.id);
    let li = rowEls.get(i.id);
    if (!li) {
      li = rowHtml(i);
      rowEls.set(i.id, li);
      list.insertBefore(li, anchor);
      anchor = li;
      continue;
    }
    const want = rowContent(i);
    if (li.className !== want.className || li.innerHTML !== want.innerHTML) {
      li.className = want.className;
      li.innerHTML = want.innerHTML;
    }
    if (anchor !== li && li.previousElementSibling !== anchor) {
      list.insertBefore(li, anchor);
    }
    anchor = li;
  }
  for (const [id, li] of rowEls) {
    if (!seen.has(id)) {
      li.remove();
      rowEls.delete(id);
    }
  }
  renderPanel(incidents);
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
