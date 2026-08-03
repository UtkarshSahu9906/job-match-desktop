let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	storeGet: (key) => electron.ipcRenderer.invoke("store:get", key),
	storeSet: (key, val) => electron.ipcRenderer.invoke("store:set", key, val),
	uploadResume: () => electron.ipcRenderer.invoke("resume:upload"),
	searchJobs: (searchParams) => electron.ipcRenderer.invoke("jobs:search", searchParams),
	openBrowser: (url) => electron.ipcRenderer.invoke("browser:open", url)
});
//#endregion
