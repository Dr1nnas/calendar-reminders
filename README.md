# Calendar & Reminders

A simple, fast calendar and reminders web app. Plain HTML, CSS and JavaScript: no build step, no backend, no account.

**Live:** https://dr1nnas.github.io/calendar-reminders/

## Features

- **Month and week views** with previous/next/today navigation; today is highlighted, and week view shows a "now" line.
- **Events**: add, edit and delete in a modal. Fields: title, date, start/end time or all-day, description, color, and an optional reminder (5/10/15/30/60 min or 1 day before). Click a day (month view) or a time slot (week view) to create one, and click an event to edit it. Overlapping events sit side by side.
- **Reminders panel**: title, due date and time, note, a done checkbox, edit and delete. Sorted by due time, with overdue items marked in red and counted on a badge.
- **Notifications**: "Enable notifications" (in the ⋮ menu or the panel) asks for browser permission. The app checks for due reminders and event reminders on load and every 30 seconds. Each one fires only once, and that is saved, so a reload won't repeat it. It uses the service worker (`registration.showNotification`) when it can and falls back to `new Notification`. Alerts also show as pop-ups inside the page, so you still see them if permission is denied.
- **Saved data**: everything is stored in your browser's `localStorage`. Use **Export JSON** / **Import JSON** (⋮ menu) to back up your data or move it to another device; import can replace or merge.
- **Installable**: web app manifest + service worker (works offline after the first visit). Use "Add to Home Screen" on your phone.
- Responsive layout for desktop and phone, follows the system light/dark mode.
- **PIN lock screen**: the app stays hidden until the PIN is entered. After 3 wrong tries this browser is locked out for 15 minutes, with a countdown. Once unlocked, reloads in the same tab don't ask again, and **Lock** in the ⋮ menu locks it again. The repo stores only a salted SHA-256 hash, never the PIN itself. This is *not* real security: it all runs in the browser, so anyone technical can get past it. It only keeps casual visitors out.
- Keyboard shortcuts: `←`/`→` previous/next, `t` today, `m` month, `w` week, `n` new event.

> Note: browsers only run the reminder check while the page (or installed app) is open. Data stays in the browser you use, so export a backup to move it.

## Run locally

Any static file server works. For example:

```sh
git clone https://github.com/Dr1nnas/calendar-reminders.git
cd calendar-reminders
python3 -m http.server 8000
# open http://localhost:8000
```

(Notifications and the service worker need `http://localhost` or HTTPS, not `file://`.)

## Files

- `index.html`: markup and modals
- `style.css`: styles (light/dark, responsive)
- `app.js`: calendar, reminders, storage, notifications
- `lock.js`: PIN lock screen
- `sw.js`: service worker (offline cache, notification clicks)
- `manifest.json`, `icon.svg`: install metadata

## Deploy

Hosted on GitHub Pages from the `main` branch root. Every push to `main` redeploys.
