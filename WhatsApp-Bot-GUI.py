import json
from pywinauto import Application, mouse
import time
import tkinter as tk
from tkinter import messagebox
from tkinter import PhotoImage
from threading import Thread
import keyboard
import threading
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Archivo de configuración
CONFIG_FILE = "config.json"

# Cargar configuración desde un archivo JSON
def cargar_configuracion():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as file:
            return json.load(file)
    return {"atajo_cierre": "ctrl+q", "intervalo": 0.1}  # Valores por defecto

# Guardar configuración en el archivo JSON
def guardar_configuracion(config):
    with open(CONFIG_FILE, "w") as file:
        json.dump(config, file)

# Variables globales
contador_mensajes = 0
ejecutando = False
config = cargar_configuracion()
atajo_cierre = config["atajo_cierre"]
intervalo = config["intervalo"]

# Función que se ejecuta al presionar el botón "Iniciar"
def iniciar_script():
    global contador_mensajes, ejecutando

    nombre_contacto = entry_contacto.get()
    mensaje = entry_mensaje.get()
    cantidad = entry_cantidad.get()

    if not nombre_contacto or not mensaje or not cantidad:
        messagebox.showerror("Error", "Todos los campos son obligatorios.")
        return

    try:
        cantidad = int(cantidad)
    except ValueError:
        messagebox.showerror("Error", "La cantidad de mensajes debe ser un número.")
        return

    ejecutando = True
    contador_mensajes = 0

    Thread(target=mostrar_contador, daemon=True).start()
    Thread(target=enviar_mensajes, args=(nombre_contacto, mensaje, cantidad), daemon=True).start()

# Función para enviar mensajes en un hilo separado
def enviar_mensajes(nombre_contacto, mensaje, cantidad):
    global contador_mensajes, ejecutando, intervalo

    try:
        app = Application(backend="uia").connect(title="WhatsApp")
        window = app.window(title="WhatsApp")

        if window.exists():
            print("La ventana de WhatsApp está activa.")
            window.maximize()

            window.click_input(double=True)
            time.sleep(1)
            mouse.move(coords=(400, 145))
            mouse.click(coords=(400, 145))
            window.type_keys(nombre_contacto)
            time.sleep(1)
            window.type_keys("{ENTER}")
            time.sleep(1)
            window.type_keys("{TAB}")
            time.sleep(1)
            window.type_keys("{ENTER}")
            time.sleep(1)
            print("Búsqueda realizada y contacto seleccionado.")

            for i in range(cantidad):
                if not ejecutando:
                    break
                window.type_keys(mensaje)
                window.type_keys("{ENTER}")
                contador_mensajes += 1
                time.sleep(intervalo)

            if ejecutando:
                messagebox.showinfo("Éxito", f"{cantidad} mensajes enviados a {nombre_contacto}.")
        else:
            messagebox.showerror("Error", "No se pudo encontrar la ventana de WhatsApp.")
    except Exception as e:
        messagebox.showerror("Error", f"Ocurrió un error: {e}")
    finally:
        ejecutando = False

# Función para mostrar el contador de mensajes
def mostrar_contador():
    global contador_mensajes, ejecutando

    ventana_contador = tk.Toplevel()
    ventana_contador.title("Contador de mensajes")
    ventana_contador.attributes('-topmost', True)

    # Obtener el tamaño de la pantalla
    ancho_pantalla = ventana_contador.winfo_screenwidth()
    alto_pantalla = ventana_contador.winfo_screenheight()

    # Definir tamaño de la ventana del contador
    ancho_ventana = 250
    alto_ventana = 80

    # Calcular la posición en la esquina superior derecha
    x = ancho_pantalla - ancho_ventana - 20  # 20px de margen
    y = 20  # 20px desde la parte superior

    ventana_contador.geometry(f"{ancho_ventana}x{alto_ventana}+{x}+{y}")

    label_contador = tk.Label(ventana_contador, text="Mensajes enviados: 0", font=("Arial", 14))
    label_contador.pack(pady=20)

    def actualizar_contador():
        if ejecutando:
            label_contador.config(text=f"Mensajes enviados: {contador_mensajes}")
            ventana_contador.after(100, actualizar_contador)
        else:
            ventana_contador.destroy()

    actualizar_contador()


# Función para configurar el atajo de teclado
def configurar_atajo():
    global atajo_cierre

    def guardar_atajo():
        global atajo_cierre
        modificador = "ctrl+" if var_ctrl.get() else "alt+" if var_alt.get() else ""
        tecla = entry_tecla.get().strip().lower()

        if not tecla:
            messagebox.showerror("Error", "Debes ingresar una tecla.")
            return
        
        atajo_cierre = f"{modificador}{tecla}"
        config["atajo_cierre"] = atajo_cierre
        guardar_configuracion(config)

        # ACTUALIZAR EL LABEL CON EL NUEVO ATAJO
        label_atajo.config(text=f"Atajo de pausa: {atajo_cierre}")

        messagebox.showinfo("Configuración", f"Atajo guardado: {atajo_cierre}")
        ventana_config.destroy()

    ventana_config = tk.Toplevel()
    ventana_config.title("Configuración de atajo")
    ventana_config.geometry("300x200")

    tk.Label(ventana_config, text="Selecciona el modificador:").pack(pady=5)

    var_ctrl = tk.BooleanVar()
    var_alt = tk.BooleanVar()

    frame_modificadores = tk.Frame(ventana_config)
    tk.Checkbutton(frame_modificadores, text="Ctrl", variable=var_ctrl).pack(side="left", padx=10)
    tk.Checkbutton(frame_modificadores, text="Alt", variable=var_alt).pack(side="left", padx=10)
    frame_modificadores.pack(pady=5)

    tk.Label(ventana_config, text="Ingresa la tecla secundaria:").pack(pady=5)
    entry_tecla = tk.Entry(ventana_config, width=10)
    entry_tecla.pack(pady=5)

    tk.Button(ventana_config, text="Guardar", command=guardar_atajo).pack(pady=10)

# Función que escucha el atajo para detener el bot
def escuchar_atajo():
    global ejecutando
    while True:
        keyboard.wait(atajo_cierre)
        if ejecutando:
            ejecutando = False
            messagebox.showinfo("Bot detenido", "Se ha detenido el envío de mensajes.")

# Función para actualizar el intervalo desde el slider
def actualizar_intervalo(valor):
    global intervalo
    intervalo = float(valor)
    config["intervalo"] = intervalo
    guardar_configuracion(config)
    label_intervalo.config(text=f"Intervalo actual: {intervalo:.2f}s")

# Detectar si se está ejecutando como un .exe con PyInstaller
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Rutas absolutas para los íconos
ruta_icono = os.path.join(BASE_DIR, "bot-icon.ico")
ruta_icono_png = os.path.join(BASE_DIR, "bot-icon.png")

# Crear la ventana principal
ventana = tk.Tk()
ventana.title("WhatsApp Bot By CrafterJe")
ventana.geometry("400x500")

# Configurar iconos de la ventana y la barra de tareas
if os.path.exists(ruta_icono):
    ventana.iconbitmap(ruta_icono)
else:
    print(f"⚠️ Advertencia: No se encontró {ruta_icono}")

if os.path.exists(ruta_icono_png):
    icono_tarea = PhotoImage(file=ruta_icono_png)
    ventana.iconphoto(True, icono_tarea)
else:
    print(f"⚠️ Advertencia: No se encontró {ruta_icono_png}")


# Usar rutas absolutas para los iconos
ruta_icono = os.path.join(BASE_DIR, "bot-icon.ico")
ruta_icono_png = os.path.join(BASE_DIR, "bot-icon.png")

# Establecer el ícono de la ventana (para la barra de título)
if os.path.exists(ruta_icono):
    ventana.iconbitmap(ruta_icono)

# Establecer el ícono de la barra de tareas
if os.path.exists(ruta_icono_png):
    icono_tarea = PhotoImage(file=ruta_icono_png)
    ventana.iconphoto(True, icono_tarea)


tk.Label(ventana, text="Nombre del contacto:").pack(pady=5)
entry_contacto = tk.Entry(ventana, width=40)
entry_contacto.pack(pady=5)

tk.Label(ventana, text="Mensaje:").pack(pady=5)
entry_mensaje = tk.Entry(ventana, width=40)
entry_mensaje.pack(pady=5)

tk.Label(ventana, text="Cantidad de mensajes:").pack(pady=5)
entry_cantidad = tk.Entry(ventana, width=40)
entry_cantidad.pack(pady=5)

tk.Button(ventana, text="Iniciar", command=iniciar_script).pack(pady=10)

# Slider para intervalo
tk.Label(ventana, text="Intervalo de envío (segundos):").pack(pady=5)
scale_intervalo = tk.Scale(ventana, from_=0.1, to=1.0, resolution=0.05, orient="horizontal", length=300, command=actualizar_intervalo)
scale_intervalo.set(intervalo)
scale_intervalo.pack(pady=5)
label_intervalo = tk.Label(ventana, text=f"Intervalo actual: {intervalo:.2f}s")
label_intervalo.pack(pady=5)

# Atajo de teclado
label_atajo = tk.Label(ventana, text=f"Atajo de pausa: {atajo_cierre}")
label_atajo.pack(pady=10)

tk.Button(ventana, text="Configuración de atajo", command=configurar_atajo).pack(pady=10)

threading.Thread(target=escuchar_atajo, daemon=True).start()

ventana.mainloop()
