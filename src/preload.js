const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('involveMe', {
  getInitialState: () => ipcRenderer.invoke('involveme:get-initial-state'),
  connectGoogle: (creds) => ipcRenderer.invoke('involveme:connect-google', creds),
  setLeadMinutes: (minutes) => ipcRenderer.send('involveme:set-lead-minutes', minutes),
  dismissAlert: () => ipcRenderer.send('involveme:dismiss-alert'),
  snoozeAlert: (eventId) => ipcRenderer.send('involveme:snooze-alert', eventId),
  onEventsUpdated: (callback) => {
    ipcRenderer.on('involveme:events-updated', (_event, events) => callback(events));
  },
  onShowAlert: (callback) => {
    ipcRenderer.on('involveme:show-alert', (_event, ev) => callback(ev));
  },
});
