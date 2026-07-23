const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blip', {
  getInitialState: () => ipcRenderer.invoke('blip:get-initial-state'),
  connectGoogle: (creds) => ipcRenderer.invoke('blip:connect-google', creds),
  setLeadMinutes: (minutes) => ipcRenderer.send('blip:set-lead-minutes', minutes),
  dismissAlert: () => ipcRenderer.send('blip:dismiss-alert'),
  snoozeAlert: (eventId) => ipcRenderer.send('blip:snooze-alert', eventId),
  onEventsUpdated: (callback) => {
    ipcRenderer.on('blip:events-updated', (_event, events) => callback(events));
  },
  onShowAlert: (callback) => {
    ipcRenderer.on('blip:show-alert', (_event, ev) => callback(ev));
  },
});
