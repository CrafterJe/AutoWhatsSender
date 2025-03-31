const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

let mainWindow;
let client;
let isClientReady = false;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.webContents.openDevTools();
}

// 🔄 Obtener contactos
async function obtenerContactos() {
    const maxWaitTime = 15000;
    const checkInterval = 500;

    return new Promise((resolve) => {
        if (isClientReady && client && client.isReady) {
            return fetchContacts();
        }

        const startTime = Date.now();
        const intervalId = setInterval(() => {
            if (isClientReady && client && client.isReady) {
                clearInterval(intervalId);
                fetchContacts();
            } else if (Date.now() - startTime > maxWaitTime) {
                clearInterval(intervalId);
                console.error('Tiempo de espera agotado para obtener contactos');
                resolve([]);
            }
        }, checkInterval);

        async function fetchContacts() {
            try {
                let contacts = await client.getContacts();
                if (contacts.length === 0) {
                    await new Promise(res => setTimeout(res, 1000));
                    contacts = await client.getContacts();
                }
                const processedContacts = contacts.map(contact => ({
                    id: contact.id.user,
                    name: contact.name || contact.pushname || 'Sin nombre',
                    number: contact.id.user,
                    isMe: contact.isMe,
                    isBlocked: contact.isBlocked,
                    isBusiness: contact.isBusiness
                }));
                resolve(processedContacts);
            } catch (error) {
                console.error('Error al obtener contactos:', error);
                resolve([]);
            }
        }
    });
}

// 🔐 Verificar sesión
async function verificarSesionWhatsApp() {
    return new Promise((resolve, reject) => {
        try {
            console.log('🔄 Iniciando verificación de sesión...');
            isClientReady = false;

            client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: path.resolve(__dirname, 'sesion1')
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ],
                    ignoreDefaultArgs: ['--enable-automation'],
                    defaultViewport: null
                }
            });

            let resultSent = false;

            client.on('ready', async () => {
                if (!resultSent) {
                    console.log('✅✅✅ CLIENTE LISTO - Enviando señal session-active');
                    resultSent = true;
                    isClientReady = true;
                    console.log('✅ Sesión iniciada');
                    mainWindow.webContents.send('session-active');
                    resolve({
                        sesionActiva: true,
                        mensaje: 'Sesión de WhatsApp Web ya iniciada'
                    });
                }
            
                try {
                    const contactos = await client.getContacts();
            
                    const numerosVistos = new Set();
                    const contactosFormateados = contactos
                    .filter(c => {
                        const num = c?.id?.user;
                        const serial = c?.id?._serialized || '';
                        const esValido = /^[0-9]{10,15}$/.test(num) &&
                                         !num.startsWith('100') &&
                                         serial.endsWith('@c.us');
                        return esValido && !numerosVistos.has(num) && numerosVistos.add(num);
                    })
                    .map(c => ({
                        id: c.id._serialized, // ✅ Incluirlo para que renderer.js pueda validarlo
                        name: c.name || c.pushname || '(Sin nombre)',
                        number: c.id.user,
                        isMe: c.isMe || false,
                        isBlocked: c.isBlocked || false,
                        isBusiness: c.isBusiness || false
                    }));
                
            
                    console.log(`📲 Enviando ${contactosFormateados.length} contactos filtrados`);
                    mainWindow.webContents.send('contactos-listos', contactosFormateados);
                } catch (error) {
                    console.error('❌ Error al obtener contactos:', error);
                    mainWindow.webContents.send('contactos-listos', []);
                }
            });            

            client.on('qr', (qr) => {
                isClientReady = false;
                console.log('🔐 Generando QR para iniciar sesión');
                if (qr) {
                    mainWindow.webContents.send('qr-code', qr);
                }
                if (!resultSent) {
                    resultSent = true;
                    resolve({
                        sesionActiva: false,
                        mensaje: 'Escanea el código QR para iniciar sesión'
                    });
                }
            });

            client.on('authenticated', () => {
                console.log('👍 Autenticación exitosa');
                mainWindow.webContents.send('authenticated', {
                    timestamp: new Date().toISOString(),
                });
            });

            client.on('auth_failure', (msg) => {
                isClientReady = false;
                console.error('❌ Error de autenticación:', msg);
                if (!resultSent) {
                    resultSent = true;
                    mainWindow.webContents.send('session-error', msg);
                    reject({
                        sesionActiva: false,
                        mensaje: 'Error de autenticación: ' + msg
                    });
                }
            });

            client.on('disconnected', (reason) => {
                isClientReady = false;
                console.log('🔌 Cliente desconectado:', reason);
                mainWindow.webContents.send('session-disconnected', reason);
            });

            client.on('error', (err) => {
                isClientReady = false;
                console.error('❌ Error general:', err);
                if (!resultSent) {
                    resultSent = true;
                    mainWindow.webContents.send('session-error', err.message);
                    reject({
                        sesionActiva: false,
                        mensaje: 'Error al conectar con WhatsApp Web: ' + err.message
                    });
                }
            });

            const initTimeout = setTimeout(() => {
                if (!resultSent) {
                    resultSent = true;
                    client.destroy();
                    reject({
                        sesionActiva: false,
                        mensaje: 'Tiempo de espera agotado al iniciar sesión'
                    });
                }
            }, 60000);

            client.initialize();

            client.on('ready', () => clearTimeout(initTimeout));
            client.on('qr', () => clearTimeout(initTimeout));
        } catch (error) {
            console.error('⚠️ Error crítico:', error);
            reject({
                sesionActiva: false,
                mensaje: 'Error crítico al iniciar: ' + error.message
            });
        }
    });
}

// 🟢 Cuando esté listo
app.whenReady().then(() => {
    createWindow();

    ipcMain.removeHandler('verificar-sesion');
    ipcMain.removeHandler('obtener-contactos');

    ipcMain.handle('verificar-sesion', async () => {
        try {
            return await verificarSesionWhatsApp();
        } catch (error) {
            console.error('Error en verificar-sesion:', error);
            return {
                sesionActiva: false,
                mensaje: 'Error al verificar sesión: ' + error.message
            };
        }
    });

    ipcMain.handle('obtener-contactos', async () => {
        return await obtenerContactos();
    });
    
});

// ✉️ Handler para enviar mensajes (FUERA de verificarSesionWhatsApp)

ipcMain.handle('enviar-mensaje', async (event, numero, mensaje) => {
    console.log('🔍 Intentando enviar mensaje...');
    
    // Verbose client state logging
    console.log('Estado completo del cliente:', {
        clientExists: !!client,
        isClientReady: isClientReady,
        clientReadyState: client?.isReady,
        clientState: client?.state,
        instanceOfClient: client instanceof Client
    });

    try {
        if (!client) {
            throw new Error('Cliente WhatsApp no inicializado');
        }

        // Enhanced readiness check
        const checkClientReady = () => {
            return new Promise((resolve, reject) => {
                // Check multiple readiness indicators
                if (client.isReady === true) {
                    return resolve(true);
                }

                // Alternative readiness checks
                const checks = [
                    () => client.getContacts().then(() => true).catch(() => false),
                    () => client.pupBrowser && client.pupBrowser.isConnected()
                ];

                Promise.any(checks)
                    .then(result => {
                        if (result) {
                            resolve(true);
                        } else {
                            reject(new Error('Cliente no está completamente preparado'));
                        }
                    })
                    .catch(() => {
                        reject(new Error('No se pudo verificar la preparación del cliente'));
                    });

                // Fallback timeout
                setTimeout(() => {
                    reject(new Error('Tiempo de espera agotado para verificar cliente'));
                }, 30000);
            });
        };

        // Wait for client to be ready
        await checkClientReady();

        const chatId = `${numero}@c.us`;
        const result = await client.sendMessage(chatId, mensaje);
        
        console.log(`📩 Mensaje enviado a ${numero}: ${mensaje}`);
        console.log('Detalles del envío:', result);
        
        return { 
            ok: true,
            messageId: result?.id?._serialized
        };
    } catch (error) {
        console.error('❌ Error detallado al enviar mensaje:', {
            errorMessage: error.message,
            errorStack: error.stack,
            clientState: {
                exists: !!client,
                isReady: client?.isReady,
                state: client?.state
            }
        });
        
        return { 
            ok: false, 
            error: error.message || 'Error desconocido al enviar mensaje' 
        };
    }
});

// Modifica la función enviar-multiples-mensajes en main.js
ipcMain.handle('enviar-multiples-mensajes', async (event, numero, mensaje, cantidad) => {
    console.log(`🔄 Intentando enviar ${cantidad} mensajes a ${numero}...`);
    
    try {
        if (!client) {
            throw new Error('Cliente WhatsApp no inicializado');
        }

        // Verificación robusta del estado del cliente
        const esperarClienteListo = async () => {
            if (isClientReady && client?.isReady) {
                console.log('✅ Cliente ya estaba listo');
                return;
            }

            console.log('🕒 Esperando a que el cliente esté completamente listo...');
            let attempts = 0;
            const maxAttempts = 60; // Hasta 30 segundos

            return new Promise((resolve, reject) => {
                const interval = setInterval(async () => {
                    attempts++;
                    if (isClientReady && client.isReady) {
                        clearInterval(interval);
                        console.log('✅ Cliente listo después de espera');
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(interval);

                        // Intento forzado adicional
                        try {
                            console.log('⚠️ Intentando obtener contactos como verificación forzada...');
                            await client.getContacts();
                            console.log('✅ Cliente forzado a estar activo vía getContacts()');
                            resolve();
                        } catch (error) {
                            reject(new Error('Cliente no completamente listo tras verificación forzada'));
                        }
                    }
                }, 500);
            });
        };

        await esperarClienteListo();

        console.log('📱 Cliente listo, enviando mensajes...');
        const chatId = `${numero}@c.us`;
        const resultados = [];

        for (let i = 0; i < cantidad; i++) {
            const result = await client.sendMessage(chatId, mensaje);
            resultados.push(result?.id?._serialized || 'unknown');

            // Pausa para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

            if (i % 5 === 0 || i === cantidad - 1) {
                console.log(`📩 Progreso: ${i + 1}/${cantidad} mensajes enviados`);
            }
        }

        return { 
            ok: true, 
            count: resultados.length,
            messageIds: resultados
        };
    } catch (error) {
        console.error('❌ Error detallado al enviar múltiples mensajes:', {
            errorMessage: error.message,
            errorStack: error.stack,
            clientState: client ? {
                isClientReadyFlag: isClientReady,
                isReadyProperty: client?.isReady,
                state: client?.state || 'unknown'
            } : 'No client'
        });

        return { 
            ok: false, 
            error: error.message || 'Error desconocido al enviar mensajes' 
        };
    }
});


// 🧹 Limpieza al cerrar
app.on('window-all-closed', () => {
    if (client) {
        try {
            client.destroy();
        } catch (error) {
            console.error('Error al cerrar cliente:', error);
        }
    }
    if (process.platform !== 'darwin') app.quit();
});

// Errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
