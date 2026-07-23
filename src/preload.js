const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dim', {
  getInitialState: () => ipcRenderer.invoke('dim:get-initial-state'),
  connectGoogle: (creds) => ipcRenderer.invoke('dim:connect-google', creds),
  setLeadMinutes: (minutes) => ipcRenderer.send('dim:set-lead-minutes', minutes),
  dismissAlert: () => ipcRenderer.send('dim:dismiss-alert'),
  snoozeAlert: (eventId) => ipcRenderer.send('dim:snooze-alert', eventId),
  onEventsUpdated: (callback) => {
    ipcRenderer.on('dim:events-updated', (_event, events) => callback(events));
  },
  onShowAlert: (callback) => {
    ipcRenderer.on('dim:show-alert', (_event, ev) => callback(ev));
  },
});
