import json
from pywinauto import Application, mouse
import time
import tkinter as tk
from tkinter import messagebox
from threading import Thread
import keyboard
import threading
import os

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
    ventana_contador.geometry("300x100")
    ventana_contador.attributes('-topmost', True)

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

# Función para actualizar el intervalo desde la interfaz
def actualizar_intervalo():
    global intervalo
    try:
        nuevo_intervalo = float(entry_intervalo.get())
        if 0.1 <= nuevo_intervalo <= 1.0:
            intervalo = nuevo_intervalo
            config["intervalo"] = intervalo
            guardar_configuracion(config)
            messagebox.showinfo("Configuración", f"Intervalo actualizado a {intervalo} segundos.")
        else:
            messagebox.showerror("Error", "El intervalo debe estar entre 0.1 y 1.0 segundos.")
    except ValueError:
        messagebox.showerror("Error", "Ingresa un valor numérico válido para el intervalo.")

# Crear la ventana principal
ventana = tk.Tk()
ventana.title("WhatsApp Bot")
ventana.geometry("400x500")

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

tk.Label(ventana, text="Intervalo de envío (0.1ms - 1.0s):").pack(pady=5)
entry_intervalo = tk.Entry(ventana, width=10)
entry_intervalo.insert(0, str(intervalo))
entry_intervalo.pack(pady=5)
tk.Button(ventana, text="Aplicar intervalo", command=actualizar_intervalo).pack(pady=10)

tk.Button(ventana, text="Configuración de atajo", command=configurar_atajo).pack(pady=10)

threading.Thread(target=escuchar_atajo, daemon=True).start()

ventana.mainloop()
