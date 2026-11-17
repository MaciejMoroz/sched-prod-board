## What you checked

I deployed the board to its public address and used it as on-call would. Opening it showed the loader, then tonight's incidents, newest first, each with its time in my local zone and an Ack button. I left the board open and watched it refresh itself every 2 seconds — the list stayed current with 8 incidents without a reload. Then I picked INC-2363 (sev1, prod-api, eu-central) and clicked Ack: the row turned acked with the ack time, and the API returned a sealed receipt for that moment (logged to the console by `api.js`). The build is named in the page head and the footer: 441c7f2a8141.

## When

- 0:01 — board opens; loader, then the incident list is on screen.
- 0:03–0:10 — board left open; it refreshes itself every 2 seconds (watch-board).
- 0:10 — INC-2363 is acked; the acked mark appears and the receipt is issued (ack-incident). This is the moment the evidence receipt covers.

## Where

- Live list, ack button and acked mark: app/app.js:57 (click handler calls `api.ack(id)`), app/app.js:62 (stores the ack), app/app.js:39 (render of the `acked` testid), app/app.js:31 (`ack` button per row).
- Loader: app/app.js:52 (hidden once incidents load), element in app/index.html:15.
- 2-second refresh: app/app.js:73.
- Local times with dd/mm for EU locales: app/app.js:13 (viewer's own locale, day before month), full UTC kept in the `datetime` attribute at app/app.js:36.
- Build name: app/index.html:6 (meta) and the footer at app/index.html:21.

## Options for product

1. **Acked state across viewers** — an ack currently lives in the viewer's own tab only; a second on-call viewer still sees an Ack button on an incident someone else took. Product could decide to surface acked state to everyone (needs the API to return it), or keep ack as a personal "I've got this one" marker.
2. **Acked rows in the list** — acked rows stay in place, dimmed. Product could decide to move them to the bottom, filter them out after a delay, or add an "only unacked" toggle.
3. **Refresh interval** — the board polls every 2 seconds (R4). Product could decide to slow it to save the API, or move to a push channel later.
4. **Time detail** — times show day, month, hour and minute in the viewer's locale. Product could decide to add seconds for sev1, or a relative form ("4 min ago").

```evidence
{
  "flow": "ack-incident",
  "at": "0:10",
  "receipt": "a1.2v8AToVC3H-7bZ85.GoIgAr7gnrX88nXT0xObZp_y4iWm7PxOUt5TITkHfqqARjQSel7lC_Y2OJrhd-mWec3Gj_wo9s9DohMLl0n06s4036hKrPTNZt21-PLS-QrGiM9E0-O4iQXwAPD-cW92ciAkXmFwy2KhEfd4ILUM-0pwgxikqwV-yw9NIMtj5DMpN-ZsgEDOhwKYKO10cJ5omGE",
  "sha": "441c7f2a8141",
  "videoLink": "https://maciejmoroz.github.io/sched-prod-board/board-ack.webm"
}
```
