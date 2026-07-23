# dim

A tiny desktop app that watches your Google Calendar and pops up a friendly,
hard-to-miss alert before your events start.

## 1. Install and run

```bash
npm install
npm start
```

This opens the dim window. The first time, you'll see a "Connect your
Google Calendar" screen asking for a **Client ID** and **Client secret**.
Get those from Google Cloud Console — one-time setup below.

## 2. One-time Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create
   a new project (or pick an existing one).
2. Go to **APIs & Services → Library**, search for **Google Calendar API**,
   and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**.
   - User type: **External** (unless you have a Google Workspace org).
   - Fill in the required app name/support email fields.
   - Under **Test users**, add your own Google account email
     (`jyoon760@gmail.com`) — while the app is in "Testing" status, only
     test users can sign in.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Desktop app**.
   - Give it any name (e.g. "dim").
   - Click **Create**. Google will show you a **Client ID** and **Client secret**.
5. Copy both values into the dim app's setup screen and click
   **Connect Google Calendar**. Your default browser opens, you sign in and
   approve access, then the tab confirms you're connected — switch back to
   the app.

dim only requests **read-only** access to your calendar
(`calendar.readonly`) — it can see events but can't create, edit, or delete
anything.

## 3. Using it

- The card at the top shows your next event and a live countdown.
- "Alert me before events" controls how many minutes ahead of an event dim
  interrupts you with a full-screen alert (with sound).
- From the alert, **Snooze 5 min** re-shows it in five minutes;
  **Got it!** dismisses it for that event.
- dim re-syncs with Google Calendar once a minute.

## Where your data lives

Your OAuth client secret and tokens are encrypted at rest (via Electron's
`safeStorage`, backed by your OS keychain) and stored locally in dim's
app-data folder — nothing is sent anywhere except directly to Google's APIs.

## Notes

- The OAuth flow uses a local loopback redirect
  (`http://127.0.0.1:<random-port>`), which Google's "Desktop app" client
  type allows without pre-registering a specific port.
- If your OAuth consent screen stays in "Testing" mode, Google will revoke
  the refresh token after ~7 days and you'll need to reconnect. Publishing
  the consent screen (even without Google's verification, for personal use)
  avoids that.
