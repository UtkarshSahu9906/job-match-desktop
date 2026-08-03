import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, val: any) => ipcRenderer.invoke('store:set', key, val),
  uploadResume: () => ipcRenderer.invoke('resume:upload'),
  searchJobs: (searchParams: any) => ipcRenderer.invoke('jobs:search', searchParams),
  openBrowser: (url: string) => ipcRenderer.invoke('browser:open', url)
});
