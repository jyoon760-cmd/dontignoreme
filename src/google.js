const http = require('http');
const crypto = require('crypto');
const { shell } = require('electron');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

const CALLBACK_PAGE = (message) => `<!DOCTYPE html>
<html><head><title>Blip</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:80px;color:#2B2640;">
<h2>${message}</h2>
<p>You can close this tab and go back to Blip.</p>
</body></html>`;

// Google's OAuth "Desktop app" client type accepts any http://127.0.0.1:<port> redirect
// without pre-registering the port, so we can spin up a one-off local server per login.
function runOAuthLoopback({ clientId, clientSecret }) {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString('hex');
    let settled = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/') {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(CALLBACK_PAGE('Sign-in was cancelled.'));
        finish(() => reject(new Error(`Google sign-in was cancelled (${error}).`)));
        return;
      }
      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(CALLBACK_PAGE('Something went wrong.'));
        finish(() => reject(new Error('Invalid OAuth callback.')));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' }).end(CALLBACK_PAGE('Connected! 🎉'));

      try {
        const port = server.address().port;
        const redirectUri = `http://127.0.0.1:${port}`;
        const tokens = await exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri });
        finish(() => resolve(tokens));
      } catch (e) {
        finish(() => reject(e));
      }
    });

    let timeoutHandle;
    function finish(action) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      server.close();
      action();
    }

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const authUrl = `${AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
      })}`;
      shell.openExternal(authUrl);
    });

    timeoutHandle = setTimeout(() => {
      finish(() => reject(new Error('Timed out waiting for Google sign-in.')));
    }, 5 * 60 * 1000);

    server.on('error', (e) => finish(() => reject(e)));
  });
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const json = await postForm(body);
  if (!json.refresh_token) {
    throw new Error('Google did not return a refresh token. Try again and make sure to approve access.');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const json = await postForm(body);
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function postForm(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || json.error || `Google token request failed (${res.status}).`);
  }
  return json;
}

async function fetchUpcomingEvents(accessToken, { maxResults = 15 } = {}) {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const res = await fetch(`${EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Google Calendar request failed (${res.status}).`);
  }
  return (json.items || [])
    .filter((item) => item.status !== 'cancelled' && (item.start?.dateTime || item.start?.date))
    .map((item) => {
      const startIso = item.start.dateTime || item.start.date;
      return {
        id: item.id,
        title: item.summary || '(No title)',
        time: new Date(startIso).getTime(),
        detail: item.location || '',
        allDay: !item.start.dateTime,
      };
    })
    .sort((a, b) => a.time - b.time);
}

module.exports = { runOAuthLoopback, refreshAccessToken, fetchUpcomingEvents };
