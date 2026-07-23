const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const store = require('./store');
const google = require('./google');

const POLL_INTERVAL_MS = 60 * 1000;
const SNOOZE_MS = 5 * 60 * 1000;
const STALE_EVENT_GRACE_MS = 60 * 1000; // don't fire alerts for events that started over a minute ago

let mainWindow = null;
let data = null;
let currentEvents = [];
const alertTimers = new Map(); // eventId -> Timeout
const dismissedEventIds = new Set();
let lastFiredEventId = null;
let pollTimer = null;

function isConnected() {
  return Boolean(data.google && data.google.refreshToken);
}

function getClientCreds() {
  return {
    clientId: data.google.clientId,
    clientSecret: store.decrypt(data.google.clientSecret),
  };
}

async function getValidAccessToken() {
  const { clientId, clientSecret } = getClientCreds();
  const expiresAt = data.google.accessTokenExpiresAt || 0;
  if (expiresAt > Date.now() + 60 * 1000) {
    return store.decrypt(data.google.accessToken);
  }
  const refreshToken = store.decrypt(data.google.refreshToken);
  const refreshed = await google.refreshAccessToken({ refreshToken, clientId, clientSecret });
  data.google.accessToken = store.encrypt(refreshed.accessToken);
  data.google.accessTokenExpiresAt = refreshed.expiresAt;
  store.save(data);
  return refreshed.accessToken;
}

function sendEvents() {
  if (mainWindow) mainWindow.webContents.send('blip:events-updated', currentEvents);
}

function fireAlert(ev) {
  alertTimers.delete(ev.id);
  lastFiredEventId = ev.id;
  if (mainWindow) mainWindow.webContents.send('blip:show-alert', ev);
  if (Notification.isSupported()) {
    new Notification({ title: ev.title, body: 'Starting now' + (ev.detail ? ` · ${ev.detail}` : '') }).show();
  }
}

function scheduleAlerts(events) {
  for (const timer of alertTimers.values()) clearTimeout(timer);
  alertTimers.clear();

  for (const ev of events) {
    if (dismissedEventIds.has(ev.id)) continue;
    const alertAt = ev.time - data.leadMinutes * 60 * 1000;
    const delay = alertAt - Date.now();
    if (delay <= 0) {
      if (ev.time > Date.now() - STALE_EVENT_GRACE_MS) fireAlert(ev);
      continue;
    }
    alertTimers.set(ev.id, setTimeout(() => fireAlert(ev), delay));
  }
}

async function pollEvents() {
  try {
    const accessToken = await getValidAccessToken();
    currentEvents = await google.fetchUpcomingEvents(accessToken);
    sendEvents();
    scheduleAlerts(currentEvents);
  } catch (e) {
    console.error('Failed to poll Google Calendar:', e.message);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollEvents();
  pollTimer = setInterval(pollEvents, POLL_INTERVAL_MS);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 760,
    backgroundColor: '#FFF8EA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('blip:get-initial-state', () => ({
  connected: isConnected(),
  leadMinutes: data.leadMinutes,
  events: currentEvents,
}));

ipcMain.handle('blip:connect-google', async (_event, { clientId, clientSecret }) => {
  const tokens = await google.runOAuthLoopback({ clientId, clientSecret });
  data.google = {
    clientId,
    clientSecret: store.encrypt(clientSecret),
    refreshToken: store.encrypt(tokens.refreshToken),
    accessToken: store.encrypt(tokens.accessToken),
    accessTokenExpiresAt: tokens.expiresAt,
  };
  store.save(data);
  startPolling();
  return { ok: true };
});

ipcMain.on('blip:set-lead-minutes', (_event, minutes) => {
  data.leadMinutes = minutes;
  store.save(data);
  scheduleAlerts(currentEvents);
});

ipcMain.on('blip:dismiss-alert', () => {
  if (lastFiredEventId) dismissedEventIds.add(lastFiredEventId);
});

ipcMain.on('blip:snooze-alert', (_event, eventId) => {
  if (!eventId) return;
  dismissedEventIds.delete(eventId);
  const timer = setTimeout(() => {
    const ev = currentEvents.find((e) => e.id === eventId);
    if (ev) fireAlert(ev);
  }, SNOOZE_MS);
  alertTimers.set(eventId, timer);
});

app.whenReady().then(() => {
  data = store.load();
  createWindow();
  if (isConnected()) startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
