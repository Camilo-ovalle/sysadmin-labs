---
title: 'Linux — Administración de Sistemas Linux'
description: Administración esencial de Linux para SysAdmin. Usuarios, grupos, permisos, servicios con systemd, gestión de paquetes, procesos, y diagnóstico de sistema. Base para entornos híbridos.
sidebar:
  label: 'Linux: Administración'
  badge:
    text: Intermedio
    variant: caution
---

# Administración de Sistemas Linux

**Prerequisito:** Tener Ubuntu Server instalado en VirtualBox (guía de setup incluida en este lab).  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🖥️ Setup Rápido: Ubuntu Server en VirtualBox

Antes de empezar los ejercicios, levanta la VM de práctica:

1. **Descargar ISO**: `ubuntu.com/download/server` → Ubuntu Server 24.04 LTS
2. **Crear VM en VirtualBox**:
   - RAM: 2 GB | Disco: 20 GB | vCPU: 2
   - Red: Adaptador 1 = NAT (internet), Adaptador 2 = Internal Network `intnet-corp`
3. **Instalar**: durante la instalación, habilitar OpenSSH Server
4. **IP estática** (adaptador 2, red interna):

```yaml
# /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    enp0s3:         # Adaptador NAT (obtiene IP automáticamente)
      dhcp4: true
    enp0s8:         # Adaptador red interna
      dhcp4: false
      addresses: [192.168.100.50/24]
      routes:
        - to: default
          via: 192.168.100.1
      nameservers:
        addresses: [192.168.100.10, 8.8.8.8]
```

```bash
sudo netplan apply
ip addr show    # Verificar la IP
```

---

## 👤 Usuarios y Grupos

### Gestión de usuarios

```bash
# Crear usuario
sudo useradd -m -s /bin/bash camilo        # -m crea home, -s shell por defecto
sudo useradd -m -s /bin/bash -c "Camilo Ovalle" -G sudo,docker camilo

# Crear usuario con contraseña
sudo useradd -m -s /bin/bash nuevo_usuario
sudo passwd nuevo_usuario    # Te pide la contraseña interactivamente

# Modificar usuario
sudo usermod -aG docker camilo      # Agregar al grupo docker (-a = append)
sudo usermod -s /bin/zsh camilo     # Cambiar shell
sudo usermod -c "Camilo Ovalle - SysAdmin" camilo  # Cambiar comentario/GECOS
sudo usermod -L camilo              # Bloquear (Lock) cuenta
sudo usermod -U camilo              # Desbloquear (Unlock)

# Eliminar usuario
sudo userdel camilo                 # Solo el usuario
sudo userdel -r camilo              # Usuario + directorio home + mail spool

# Ver información del usuario
id camilo                           # UID, GID y grupos
finger camilo                       # Info detallada (requiere package finger)
getent passwd camilo                # Entrada en /etc/passwd
```

### Gestión de grupos

```bash
# Crear grupo
sudo groupadd sysadmins

# Agregar usuario a grupo
sudo usermod -aG sysadmins camilo

# Ver miembros de un grupo
getent group sysadmins
grep sysadmins /etc/group

# Eliminar grupo
sudo groupdel sysadmins
```

### Archivos de usuario importantes

```bash
/etc/passwd     # Lista de usuarios (formato: usuario:x:UID:GID:comentario:home:shell)
/etc/shadow     # Contraseñas hasheadas (solo root puede leer)
/etc/group      # Lista de grupos (formato: grupo:x:GID:miembros)
/etc/sudoers    # Configuración de sudo (SIEMPRE editar con visudo)
```

---

## 🔒 Permisos en Linux

### Sistema de permisos rwx

```bash
ls -la /var/log
# drwxr-xr-x  12 root  syslog  4096 Jun  3 08:00 syslog
# │││││││││
# │││└────── permisos de otros (r-x = lectura + ejecución)
# │││
# ││└─────── permisos de grupo (r-x)
# ││
# │└──────── permisos de dueño (rwx = lectura + escritura + ejecución)
# │
# └───────── tipo: d=directorio, -=archivo, l=symlink
```

| Permiso | Archivos | Directorios |
|---|---|---|
| **r** (4) | Leer contenido | Listar contenido (`ls`) |
| **w** (2) | Modificar contenido | Crear/eliminar archivos dentro |
| **x** (1) | Ejecutar | Entrar al directorio (`cd`) |

### `chmod` — Cambiar permisos

```bash
# Notación octal (más rápida)
chmod 755 script.sh       # rwxr-xr-x  (dueño: rwx, grupo: r-x, otros: r-x)
chmod 644 archivo.txt     # rw-r--r--  (dueño: rw-, grupo: r--, otros: r--)
chmod 600 ~/.ssh/id_rsa   # rw-------  (solo el dueño puede leer/escribir)
chmod 700 ~/.ssh/         # rwx------  (directorio privado)
chmod 777 /tmp/shared/    # rwxrwxrwx  (todos tienen todo — evitar en producción)

# Notación simbólica (más legible)
chmod u+x script.sh       # Agregar ejecución al dueño (user)
chmod g-w archivo.txt     # Quitar escritura al grupo
chmod o=r archivo.txt     # Establecer solo lectura para otros
chmod a+r archivo.txt     # Agregar lectura a todos (all)

# Recursivo (directorios)
chmod -R 755 /var/www/html/
```

### `chown` — Cambiar dueño y grupo

```bash
# Cambiar dueño
sudo chown camilo archivo.txt

# Cambiar dueño y grupo
sudo chown camilo:sysadmins archivo.txt

# Cambiar solo el grupo
sudo chgrp sysadmins /var/data/

# Recursivo
sudo chown -R www-data:www-data /var/www/html/
```

### `sudo` y `/etc/sudoers`

```bash
# Siempre editar sudoers con visudo (valida la sintaxis antes de guardar)
sudo visudo

# Dar privilegios completos a un usuario
camilo  ALL=(ALL:ALL) ALL

# Dar permiso de ejecutar comandos específicos sin contraseña
camilo  ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl

# Dar privilegios a un grupo (prefijado con %)
%sysadmins  ALL=(ALL:ALL) ALL

# Verificar permisos sudo del usuario actual
sudo -l
```

---

## ⚙️ Servicios y Demonios con systemd

`systemd` es el sistema de init moderno de Linux. Gestiona todos los servicios (demonios).

### `systemctl` — Gestión de servicios

```bash
# Estado de un servicio
systemctl status nginx
systemctl status ssh

# Iniciar / Detener / Reiniciar
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx      # Recargar config sin detener (si el servicio lo soporta)

# Habilitar / Deshabilitar (inicio automático con el sistema)
sudo systemctl enable nginx      # Inicia al arrancar
sudo systemctl disable nginx     # No inicia al arrancar
sudo systemctl enable --now nginx  # Habilitar Y arrancar ahora

# Ver todos los servicios
systemctl list-units --type=service
systemctl list-units --type=service --state=failed    # Solo los fallidos
systemctl list-units --type=service --state=running   # Solo los corriendo
```

### `journalctl` — Ver logs del sistema

```bash
# Ver todos los logs (como tail del syslog clásico)
journalctl -f                    # Follow (en tiempo real)
journalctl -n 100                # Últimas 100 líneas
journalctl --since "1 hour ago"  # Últimas horas

# Logs de un servicio específico
journalctl -u nginx              # Todos los logs de nginx
journalctl -u nginx -f           # Follow (tiempo real)
journalctl -u nginx --since "2024-06-03 08:00:00"

# Filtrar por prioridad
journalctl -p err                # Solo errores
journalctl -p crit               # Solo críticos
journalctl -p warning..err       # Warnings y errores

# Logs del último arranque
journalctl -b 0                  # Boot actual
journalctl -b -1                 # Boot anterior

# Logs del kernel
journalctl -k
```

### Crear un servicio systemd personalizado

```bash
# Crear unit file
sudo nano /etc/systemd/system/mi-script.service
```

```ini
[Unit]
Description=Mi Script de Monitoreo
After=network.target

[Service]
Type=simple
User=monitoruser
ExecStart=/opt/scripts/monitor.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Activar el nuevo servicio
sudo systemctl daemon-reload    # Recargar la lista de units
sudo systemctl enable --now mi-script.service
```

---

## 📦 Gestión de Paquetes con APT (Ubuntu/Debian)

```bash
# Actualizar la lista de paquetes disponibles
sudo apt update

# Actualizar todos los paquetes instalados
sudo apt upgrade -y

# Actualizar y también gestionar cambios de dependencias
sudo apt full-upgrade -y

# Instalar paquete
sudo apt install nginx vim htop git -y

# Eliminar paquete (mantiene archivos de configuración)
sudo apt remove nginx

# Eliminar paquete + archivos de configuración
sudo apt purge nginx

# Eliminar paquetes huérfanos (dependencias ya no necesarias)
sudo apt autoremove

# Buscar paquete
apt search nginx

# Ver información de un paquete
apt show nginx

# Ver archivos de un paquete instalado
dpkg -L nginx

# Ver a qué paquete pertenece un archivo
dpkg -S /usr/sbin/nginx
```

---

## 🔄 Procesos

```bash
# Ver procesos en tiempo real
top                    # Clásico
htop                   # Mejorado (instalar: apt install htop)

# Ver todos los procesos
ps aux                 # a=todos los usuarios, u=formato usuario, x=sin terminal
ps aux | grep nginx    # Buscar proceso específico

# Ver árbol de procesos
pstree -p

# Ver proceso por nombre
pidof nginx
pgrep -la nginx        # -l = mostrar nombre, -a = mostrar argumentos

# Matar proceso
kill <PID>             # SIGTERM (graceful)
kill -9 <PID>          # SIGKILL (forzado, último recurso)
killall nginx          # Matar todos los procesos con ese nombre
pkill -9 -u camilo     # Matar todos los procesos de un usuario

# Ejecutar proceso en segundo plano
/opt/scripts/largo.sh &
nohup /opt/scripts/largo.sh > /var/log/largo.log 2>&1 &    # Persiste al cerrar sesión
```

---

## 📁 Comandos de Sistema Esenciales

```bash
# Información del sistema
uname -a               # Kernel, arquitectura
hostname               # Nombre del host
hostname -I            # IPs del equipo
uptime                 # Tiempo encendido y carga
cat /etc/os-release    # Versión de OS

# Uso de disco
df -h                  # Espacio libre en particiones
du -sh /var/log/*      # Espacio usado por directorio
lsblk                  # Discos y particiones

# Uso de memoria
free -h                # RAM y swap

# CPU
lscpu                  # Información detallada del CPU
nproc                  # Número de procesadores

# Logs del sistema
tail -f /var/log/syslog         # Seguir log del sistema
tail -f /var/log/auth.log       # Intentos de autenticación
grep "Failed password" /var/log/auth.log   # Intentos SSH fallidos
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre `useradd` y `adduser` en Linux?**
> `useradd` es el comando de bajo nivel, requiere especificar todas las opciones manualmente (home dir, shell, etc.). `adduser` (disponible en Debian/Ubuntu) es un script de alto nivel más amigable que usa `useradd` internamente y configura valores por defecto (crea home dir, pide contraseña interactivamente). En scripts de automatización se prefiere `useradd` por ser más predecible.

**2. Explica los permisos 755 y 644 en Linux.**
> 755 = `rwxr-xr-x`: el dueño puede leer, escribir y ejecutar; el grupo y otros solo leer y ejecutar. Usado para binarios, scripts ejecutables y directorios web. 644 = `rw-r--r--`: el dueño puede leer y escribir; grupo y otros solo leer. Usado para archivos de configuración y documentos. 600 (`rw-------`) para archivos privados como claves SSH.

**3. ¿Qué es systemd y cómo usas `systemctl`?**
> systemd es el sistema de init moderno de Linux, gestiona todos los servicios y demonios del sistema. `systemctl start/stop/restart/status <servicio>` para gestionar servicios. `systemctl enable/disable` para configurar el inicio automático. `journalctl -u <servicio>` para ver los logs de un servicio específico.

**4. Un servicio de Linux no inicia. ¿Cómo lo diagnosticas?**
> 1. `systemctl status <servicio>` → muestra el error inmediato y las últimas líneas del log. 2. `journalctl -u <servicio> -n 50` → últimas 50 líneas de log del servicio con más detalle. 3. Si hay archivo de log dedicado: `tail -50 /var/log/<servicio>/error.log`. 4. Verificar que el archivo de configuración no tenga errores de sintaxis (ej: `nginx -t`, `apache2 -t`). 5. Verificar que los puertos que necesita no estén ocupados: `ss -tlnp | grep <puerto>`.

**5. ¿Cómo das permisos de sudo a un usuario sin darle acceso completo de root?**
> En `/etc/sudoers` (siempre editar con `visudo`): `usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl` — esto permite solo ejecutar systemctl y journalctl como root, sin contraseña. También se puede agregar al grupo sudo (`usermod -aG sudo usuario`) para acceso completo con contraseña, o crear grupos personalizados en sudoers con permisos específicos.

**6. ¿Qué diferencia hay entre `kill` y `kill -9`?**
> `kill <PID>` envía SIGTERM: pide al proceso que termine de forma limpia (puede guardar archivos, cerrar conexiones). El proceso puede ignorar SIGTERM. `kill -9 <PID>` envía SIGKILL: el kernel termina el proceso inmediatamente sin que el proceso pueda hacer nada. Se usa como último recurso cuando el proceso no responde a SIGTERM, ya que puede dejar archivos corruptos o recursos sin liberar.

**7. ¿Cómo verías qué usuarios han intentado conectarse por SSH sin éxito?**
> `grep "Failed password" /var/log/auth.log | awk '{print $9, $11}' | sort | uniq -c | sort -rn | head -20` — extrae el usuario y la IP de cada intento fallido, los agrupa y ordena por frecuencia. Para ver intentos de los últimos 10 minutos: `journalctl -u ssh --since "10 minutes ago" | grep "Failed"`.
