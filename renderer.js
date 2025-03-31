let sesionConfirmada = false;

window.electronAPI.onSessionActive(() => {
    console.log('🟢 Evento session-active recibido fuera del DOM');
    sesionConfirmada = true;
});

document.addEventListener('DOMContentLoaded', async () => {
    const QRCode = window.QRCode;
    const statusElemento = document.getElementById('status');
    const spinner = document.getElementById('spinner');
    const qrContainer = document.getElementById('qr-container');
    const contactosContainer = document.getElementById('contactos-container');
    const inputBusqueda = document.getElementById('buscador-contacto');
    const listaContactos = document.getElementById('lista-contactos');
    const inputMensaje = document.getElementById('mensaje-texto');
    const btnEnviarMensaje = document.getElementById('btn-enviar-mensaje');
    const mensajeStatus = document.getElementById('mensaje-status');
    const destinatarioSeleccionado = document.getElementById('destinatario-seleccionado');
    const mensajeContainer = document.getElementById('mensaje-container');
    const loadingIcon = document.getElementById('loading-icon');

    // Ocultar por defecto
    mensajeContainer.style.display = 'none';
    loadingIcon.style.display = 'inline-block';
    spinner.style.display = 'block';  

    let contactosGlobal = [];
    let contactoSeleccionado = null;
    

    try {
        const resultado = await window.electronAPI.verificarSesion();
        statusElemento.textContent = resultado.mensaje;
        statusElemento.style.color = resultado.sesionActiva ? 'green' : 'orange';
        
        // Si la sesión ya está activa, mostrar el contenedor de mensajes y ocultar el icono de carga
        if (resultado.sesionActiva) {
            mensajeContainer.style.display = 'block';
            loadingIcon.style.display = 'none';
            btnEnviarMensaje.disabled = false;
        }
    } catch (error) {
        statusElemento.textContent = 'Error al verificar sesión';
        statusElemento.style.color = 'red';
        console.error(error);
        loadingIcon.style.display = 'none'; // Ocultar también en caso de error
    } finally {
        spinner.style.display = 'none';
    }

    window.electronAPI.onContactosListos((event, contactos) => {
        contactosContainer.innerHTML = '';
        contactosGlobal = [];
    
        if (!contactos || contactos.length === 0) {
            contactosContainer.innerHTML = `
                <div style="text-align: center; color: gray; margin-top: 20px;">
                    <p>No se encontraron contactos</p>
                    <p>Asegúrate de que la sesión de WhatsApp esté completamente iniciada</p>
                </div>
            `;
            return;
        }
    
        const contactosFiltrados = [];
        const numerosVistos = new Set();
    
        for (const contacto of contactos) {
            const numero = contacto.number;
            const idSerializado = contacto.id || ''; // 🔧 CORREGIDO
    
            const esValido = /^[0-9]{10,15}$/.test(numero)
                          && !numero.startsWith('100')
                          && idSerializado.endsWith('@c.us'); // Solo contactos reales
    
            if (!esValido || numerosVistos.has(numero)) continue;
    
            numerosVistos.add(numero);
            contactosFiltrados.push(contacto);
        }
    
        contactosGlobal = contactosFiltrados;
        
        // Asegurarse de que el contenedor de mensajes esté visible cuando los contactos están listos
        mensajeContainer.style.display = 'block';
        loadingIcon.style.display = 'none';
    
        // Comentado el código de la tabla como estaba originalmente
        /*const tablaContactos = document.createElement('table');
        tablaContactos.innerHTML = `
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Número</th>
                    <th>Detalles</th>
                </tr>
            </thead>
            <tbody>
                ${contactosFiltrados.map(contacto => `
                    <tr>
                        <td>${contacto.name || '(Sin nombre)'}</td>
                        <td>${contacto.number}</td>
                        <td>
                            ${contacto.isMe ? '👤 Yo ' : ''}
                            ${contacto.isBlocked ? '🚫 Bloqueado ' : ''}
                            ${contacto.isBusiness ? '💼 Negocio' : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        contactosContainer.appendChild(tablaContactos);*/
    });
    
    

    // Búsqueda de contactos
    inputBusqueda.addEventListener('input', () => {
        const filtro = inputBusqueda.value.toLowerCase();
        listaContactos.innerHTML = '';

        const encontrados = contactosGlobal.filter(c => {
            const nombre = (c.name || '').toLowerCase();
            const numero = c.number.toLowerCase();
            return nombre.includes(filtro) || numero.includes(filtro);
        }).slice(0, 10);

        encontrados.forEach(contacto => {
            const item = document.createElement('li');
            item.textContent = `${contacto.name} (${contacto.number})`;
            item.style.padding = '6px';
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                contactoSeleccionado = contacto;
                destinatarioSeleccionado.textContent = `✉️ Enviar a: ${contacto.name} (${contacto.number})`;
                listaContactos.innerHTML = '';
                inputBusqueda.value = '';
            });
            listaContactos.appendChild(item);
        });
    });

    // Enviar mensaje
    btnEnviarMensaje.addEventListener('click', async () => {
        const mensaje = inputMensaje.value.trim();
        const cantidad = parseInt(document.getElementById('cantidad-mensajes').value, 10);
    
        if (!contactoSeleccionado || !mensaje || !cantidad || cantidad < 1) {
            mensajeStatus.textContent = '⚠️ Selecciona un contacto, escribe un mensaje y una cantidad válida.';
            mensajeStatus.style.color = 'orange';
            return;
        }
    
        mensajeStatus.textContent = '⏳ Enviando mensajes...';
        mensajeStatus.style.color = 'blue';
        document.getElementById('loading-icon').style.display = 'block';
        btnEnviarMensaje.disabled = true;
    
        const progressElement = document.createElement('div');
        progressElement.style.marginTop = '10px';
        progressElement.textContent = 'Inicializando...';
        mensajeStatus.appendChild(progressElement);
    
        try {
            
            if (!sesionConfirmada) {
                throw new Error('La sesión no está completamente iniciada');
            }
    
            progressElement.textContent = 'Conectando con WhatsApp...';
            const resultado = await window.electronAPI.enviarMultiplesMensajes(
                contactoSeleccionado.number, mensaje, cantidad
            );
    
            if (resultado.ok) {
                mensajeStatus.textContent = `✅ Se enviaron ${cantidad} mensajes correctamente`;
                mensajeStatus.style.color = 'green';
            } else {
                mensajeStatus.innerHTML = `❌ Error: ${resultado.error}<br><small>Intenta escanear nuevamente el código QR o reiniciar la aplicación</small>`;
                mensajeStatus.style.color = 'red';
            }
        } catch (err) {
            console.error('Error al enviar mensajes:', err);
            mensajeStatus.innerHTML = `❌ Error: ${err.message || 'Error inesperado'}<br><small>Es posible que necesites reiniciar la aplicación</small>`;
            mensajeStatus.style.color = 'red';
        } finally {
            document.getElementById('loading-icon').style.display = 'none';
            btnEnviarMensaje.disabled = false;
            if (progressElement.parentNode) {
                progressElement.parentNode.removeChild(progressElement);
            }
        }
    });
    
    

    // Sesión activa
    window.electronAPI.onSessionActive(() => {
        console.log('🟢 Evento session-active recibido (UI)');
        statusElemento.textContent = '✅ ¡Sesión iniciada correctamente!';
        statusElemento.style.color = 'green';
        spinner.style.display = 'none';
        qrContainer.innerHTML = '<p style="color: green;">QR escaneado. Bot listo.</p>';
        mensajeContainer.style.display = 'block';
        loadingIcon.style.display = 'none';
        btnEnviarMensaje.disabled = false;
    });
     

    window.electronAPI.onAuthenticated((event, sessionInfo) => {
        console.log('🔐 Evento authenticated recibido', sessionInfo);
        statusElemento.textContent = '🔐 ¡Autenticación exitosa!';
        statusElemento.style.color = 'green';
        qrContainer.innerHTML = '<p style="color: green;">Autenticado correctamente</p>';
        loadingIcon.style.display = 'none'; // Asegurarse de ocultar el ícono de carga
        mensajeContainer.style.display = 'block'; // Mostrar el contenedor de mensajes
        console.log('Información de sesión:', sessionInfo);
    });

    window.electronAPI.onQrCode((event, qr) => {
        statusElemento.textContent = 'Escanea el código QR para iniciar sesión';
        statusElemento.style.color = 'orange';
        spinner.style.display = 'none';

        if (!qr || qr.length < 100) {
            console.warn('QR recibido muy corto, esperando otro...');
            qrContainer.innerHTML = '<p style="color: gray;">Esperando QR válido...</p>';
            return;
        }

        console.log('📦 QR válido recibido:', qr);
        qrContainer.innerHTML = '<p style="color: gray;">Generando código QR...</p>';

        QRCode.toCanvas(qr, { width: 300, height: 300 }, (err, canvas) => {
            if (err) {
                console.error('❌ Error al generar el QR visual:', err);
                qrContainer.innerHTML = '<p style="color: red;">Error al mostrar el QR</p>';
                return;
            }
            qrContainer.innerHTML = '';
            qrContainer.appendChild(canvas);
        });
    });

    window.electronAPI.onSessionError((event, error) => {
        statusElemento.textContent = 'Error al conectar sesión: ' + (error || 'Desconocido');
        statusElemento.style.color = 'red';
        spinner.style.display = 'none';
        qrContainer.innerHTML = '<p style="color: red;">Error de sesión</p>';
        btnEnviarMensaje.disabled = true;
        mensajeContainer.style.display = 'none';
        loadingIcon.style.display = 'none'; // Asegurarse de ocultar el ícono de carga
        console.error('Session Error:', error);
    });

    window.electronAPI.onSessionDisconnected((event, reason) => {
        statusElemento.textContent = 'Sesión desconectada';
        statusElemento.style.color = 'orange';
        mensajeContainer.style.display = 'none';
        loadingIcon.style.display = 'none'; // Asegurarse de ocultar el ícono de carga
        console.log('Desconexión:', reason);
    });
});