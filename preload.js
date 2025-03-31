const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    verificarSesion: () => ipcRenderer.invoke('verificar-sesion'),
    obtenerContactos: () => ipcRenderer.invoke('obtener-contactos'),
    onSessionActive: (callback) => ipcRenderer.on('session-active', callback),
    onQrCode: (callback) => ipcRenderer.on('qr-code', callback),
    onSessionError: (callback) => ipcRenderer.on('session-error', callback),
    onSessionDisconnected: (callback) => ipcRenderer.on('session-disconnected', callback),
    onAuthenticated: (callback) => ipcRenderer.on('authenticated', callback),
    onContactosListos: (callback) => ipcRenderer.on('contactos-listos', callback),
    enviarMensaje: (numero, mensaje) => ipcRenderer.invoke('enviar-mensaje', numero, mensaje),
    enviarMultiplesMensajes: (numero, mensaje, cantidad) =>
        ipcRenderer.invoke('enviar-multiples-mensajes', numero, mensaje, cantidad),    
});