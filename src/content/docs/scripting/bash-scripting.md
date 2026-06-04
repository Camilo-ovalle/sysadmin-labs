---
title: 'Script Bash — Bash para SysAdmin'
description: Fundamentos de scripting Bash para administración de sistemas. Variables, bucles, funciones, grep/awk/sed, cron, y construcción de la herramienta real de recolección de logs (30 → 5 minutos).
sidebar:
  label: 'Script: Bash'
  badge:
    text: Intermedio
    variant: caution
---

# Bash para SysAdmin — Del Shell a la Automatización

**Prerequisito:** Tener acceso a un sistema Linux (Ubuntu Server del lab Linux, o WSL2 en Windows).  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🐚 Fundamentos de Bash

### Variables

```bash
# Declaración y uso
NOMBRE="Camilo"
NUMERO=42
RESULTADO=$(date +%Y%m%d)    # Capturar salida de comando

echo "Hola $NOMBRE"
echo "Número: $NUMERO"
echo "Fecha: $RESULTADO"

# Variables especiales
echo $0    # Nombre del script
echo $1    # Primer argumento al script
echo $#    # Número de argumentos
echo $@    # Todos los argumentos
echo $?    # Código de salida del último comando (0 = éxito)
echo $$    # PID del proceso actual
```

### Condicionales

```bash
# if / elif / else
if [ "$NOMBRE" = "Camilo" ]; then
    echo "Bienvenido, admin"
elif [ "$NOMBRE" = "invitado" ]; then
    echo "Acceso limitado"
else
    echo "Usuario desconocido"
fi

# Comparaciones numéricas
if [ $NUMERO -gt 10 ]; then echo "Mayor que 10"; fi
if [ $NUMERO -eq 0 ]; then echo "Es cero"; fi
if [ $NUMERO -ne 5 ]; then echo "No es 5"; fi

# Operadores de archivo
if [ -f "/etc/passwd" ]; then echo "El archivo existe"; fi
if [ -d "/var/log" ]; then echo "El directorio existe"; fi
if [ -r "/etc/passwd" ]; then echo "Tengo permiso de lectura"; fi

# Condición doble (más moderna, soporta regex)
if [[ "$NOMBRE" =~ ^C ]]; then
    echo "Empieza con C"
fi
```

### Bucles

```bash
# for - iterar lista
for SERVIDOR in "dc01" "sccm01" "wkstn01"; do
    echo "Procesando: $SERVIDOR"
    ping -c 1 "$SERVIDOR" > /dev/null 2>&1 && echo "  ✅ En línea" || echo "  ❌ Fuera de línea"
done

# for - rango de números
for i in {1..10}; do
    echo "Iteración $i"
done

# while
CONTADOR=0
while [ $CONTADOR -lt 5 ]; do
    echo "Contador: $CONTADOR"
    ((CONTADOR++))
done

# until (lo opuesto de while)
until ping -c1 192.168.100.10 &>/dev/null; do
    echo "Esperando que el servidor esté disponible..."
    sleep 5
done
echo "Servidor disponible"

# Iterar líneas de un archivo
while IFS= read -r linea; do
    echo "Procesando: $linea"
done < /etc/hosts
```

### Funciones

```bash
# Declaración de función
verificar_servidor() {
    local servidor=$1    # Variables locales con 'local'
    local timeout=${2:-3}   # Con valor por defecto
    
    if ping -c 1 -W $timeout "$servidor" > /dev/null 2>&1; then
        echo "✅ $servidor: en línea"
        return 0
    else
        echo "❌ $servidor: sin respuesta"
        return 1
    fi
}

# Uso
verificar_servidor "192.168.100.10"
verificar_servidor "192.168.100.20" 5   # Timeout de 5 segundos
```

---

## 🔧 Herramientas Clave: grep, awk, sed

### `grep` — Buscar patrones en texto

```bash
# Buscar línea en archivo
grep "Error" /var/log/syslog

# Case-insensitive
grep -i "error" /var/log/syslog

# Mostrar número de línea
grep -n "Failed password" /var/log/auth.log

# Invertir (mostrar líneas que NO coinciden)
grep -v "^#" /etc/ssh/sshd_config   # Omitir comentarios

# Contar ocurrencias
grep -c "ERROR" application.log

# Búsqueda recursiva en directorio
grep -r "contraseña" /etc/    # Buscar texto en todos los archivos de /etc/

# Extended regex (alternación, grupos)
grep -E "ERROR|WARNING|CRITICAL" /var/log/syslog

# Mostrar contexto alrededor del match
grep -A 3 -B 3 "Segmentation fault" /var/log/syslog   # 3 líneas antes y después
```

### `awk` — Procesar columnas y texto estructurado

```bash
# Imprimir columnas específicas (campo $N, separador por defecto = espacio)
awk '{print $1, $3}' /etc/passwd    # 1era y 3era columna

# Separador personalizado
awk -F: '{print $1, $3}' /etc/passwd   # Usuario y UID

# Filtrar por condición y sumar
awk -F: '$3 >= 1000 {print $1, $3}' /etc/passwd   # Solo usuarios normales (UID >= 1000)

# Calcular suma de una columna
du -sh /var/log/* | awk '{sum += $1} END {print "Total:", sum}'

# Procesar logs: extraer IPs de intentos de login fallidos
grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -10
```

### `sed` — Stream editor (buscar y reemplazar)

```bash
# Reemplazar texto (primera ocurrencia por línea)
sed 's/viejo/nuevo/' archivo.txt

# Reemplazar todas las ocurrencias (g = global)
sed 's/viejo/nuevo/g' archivo.txt

# Modificar el archivo en lugar (in-place)
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Eliminar líneas vacías
sed '/^$/d' archivo.txt

# Eliminar líneas que empiezan con #
sed '/^#/d' archivo.txt

# Insertar texto antes de una línea que coincide
sed '/^GRUB_TIMEOUT/i # Configurado por script' /etc/default/grub

# Extraer rango de líneas
sed -n '10,20p' archivo.txt   # Imprimir líneas 10 a 20
```

---

## ⏰ Cron — Automatización de Tareas Programadas

```bash
# Editar el crontab del usuario actual
crontab -e

# Ver el crontab actual
crontab -l

# Formato de crontab:
# MIN  HORA  DIA-MES  MES  DIA-SEM  COMANDO
# 0    2     *        *    *        /scripts/backup.sh    # Todos los días a las 2am
# */5  *     *        *    *        /scripts/monitor.sh   # Cada 5 minutos
# 0    9     *        *    1-5      /scripts/report.sh    # L-V a las 9am
# 30   23    1        *    *        /scripts/monthly.sh   # El día 1 de cada mes a las 23:30
```

```bash
# Crontab del sistema (con usuario específico): /etc/cron.d/
# o editar /etc/crontab:
# 0 2 * * * root /scripts/backup.sh >> /var/log/backup.log 2>&1

# Redirigir output al log
0 2 * * * /scripts/backup.sh >> /var/log/backup.log 2>&1
#                                                    ^^^^ stderr también al log
```

---

## 🔨 Proyecto: Herramienta de Recolección de Logs (30 → 5 min)

Este es el script real que construiste para reducir el tiempo de recolección de logs de 30 minutos a 5:

```bash
#!/bin/bash
# collect-logs.sh
# Recolecta logs de error de múltiples servidores Linux
# Uso: ./collect-logs.sh [horas_atras] [ruta_reporte]

# ─── Configuración ───────────────────────────────────────────────────
SERVIDORES=("192.168.100.10" "192.168.100.20" "192.168.100.100")
NOMBRES=("DC01" "SCCM01" "WKSTN-01")
HORAS=${1:-24}
REPORTE_DIR="/var/reports"
FECHA=$(date +%Y%m%d-%H%M)
REPORTE="${REPORTE_DIR}/logs-${FECHA}.txt"
USUARIO_SSH="adminuser"
CLAVE_SSH="/root/.ssh/id_rsa"

# ─── Funciones ───────────────────────────────────────────────────────
log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

verificar_servidor() {
    local ip=$1
    ping -c 1 -W 2 "$ip" > /dev/null 2>&1
    return $?
}

recolectar_logs() {
    local ip=$1
    local nombre=$2
    local horas=$3
    
    # Calcular timestamp de inicio
    local inicio=$(date -d "$horas hours ago" '+%Y-%m-%d %H:%M:%S')
    
    # Comando remoto para extraer logs de error
    local comando="
        echo '=== Errores del sistema ===' &&
        journalctl --since '$inicio' -p err --no-pager -o short 2>/dev/null | tail -50 &&
        echo '=== Servicios caídos ===' &&
        systemctl list-units --state=failed --no-pager 2>/dev/null &&
        echo '=== Uso de disco ===' &&
        df -h | grep -v tmpfs &&
        echo '=== Memoria ===' &&
        free -h
    "
    
    ssh -i "$CLAVE_SSH" -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
        "$USUARIO_SSH@$ip" "$comando" 2>/dev/null
    return $?
}

# ─── Script principal ────────────────────────────────────────────────
mkdir -p "$REPORTE_DIR"
INICIO=$(date +%s)

log "Iniciando recolección de logs (últimas $HORAS horas)"
log "Servidores: ${NOMBRES[*]}"
log "Reporte: $REPORTE"
echo ""

{
    echo "════════════════════════════════════════"
    echo "  REPORTE DE LOGS - $(date '+%d/%m/%Y %H:%M')"
    echo "  Período: últimas $HORAS horas"
    echo "════════════════════════════════════════"
    echo ""
} > "$REPORTE"

EXITOS=0
FALLOS=0

for i in "${!SERVIDORES[@]}"; do
    ip="${SERVIDORES[$i]}"
    nombre="${NOMBRES[$i]}"
    
    log "Procesando $nombre ($ip)..."
    
    if ! verificar_servidor "$ip"; then
        log "  ❌ $nombre no responde a ping"
        echo "[$nombre] FUERA DE LÍNEA - Sin conexión" >> "$REPORTE"
        ((FALLOS++))
        continue
    fi
    
    {
        echo ""
        echo "────────────────────────────────────────"
        echo " SERVIDOR: $nombre ($ip)"
        echo " Recolectado: $(date '+%H:%M:%S')"
        echo "────────────────────────────────────────"
    } >> "$REPORTE"
    
    if recolectar_logs "$ip" "$nombre" "$HORAS" >> "$REPORTE" 2>&1; then
        log "  ✅ $nombre: logs recolectados"
        ((EXITOS++))
    else
        log "  ⚠️  $nombre: error de SSH"
        echo "  [ERROR] No se pudo conectar por SSH" >> "$REPORTE"
        ((FALLOS++))
    fi
done

# Resumen final
DURACION=$(($(date +%s) - INICIO))
{
    echo ""
    echo "════════════════════════════════════════"
    echo " RESUMEN"
    echo " Servidores procesados: $((EXITOS + FALLOS))"
    echo " Exitosos: $EXITOS | Con error: $FALLOS"
    echo " Duración: ${DURACION}s"
    echo " Reporte: $REPORTE"
    echo "════════════════════════════════════════"
} | tee -a "$REPORTE"

log "✅ Reporte generado: $REPORTE"
```

```bash
# Hacer ejecutable
chmod +x collect-logs.sh

# Ejecutar
./collect-logs.sh 24 /var/reports

# Agregar a cron: ejecutar cada hora
(crontab -l 2>/dev/null; echo "0 * * * * /scripts/collect-logs.sh 1 >> /var/log/collect-logs.cron.log 2>&1") | crontab -
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuándo usarías Bash vs PowerShell para automatizar una tarea?**
> Bash en sistemas Linux/Unix o cuando necesitas scripts que corran en servidores sin GUI. PowerShell en Windows cuando necesitas interactuar con AD, WMI, servicios de Windows, o el ecosistema Microsoft. En entornos híbridos (como este trabajo) se usan ambos: PS para gestionar AD y Windows, Bash para los servidores Linux.

**2. Desarrollaste una herramienta de recolección de logs. ¿Qué técnicas de Bash usaste?**
> Arrays para la lista de servidores, funciones para modularizar la lógica (verificar_servidor, recolectar_logs), SSH remoto no interactivo con `ssh -o ConnectTimeout`, redirección de output a archivo de reporte, cálculo de tiempo de ejecución con `date +%s`, y manejo de errores con códigos de retorno (`$?`). El resultado fue reducir el tiempo de 30 a 5 minutos al eliminar el trabajo manual de conectarse a cada servidor uno por uno.

**3. ¿Cómo buscarías los 10 IPs con más intentos de login fallidos en los logs de SSH?**
> `grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -10`. Esto extrae la columna 11 (IP), ordena para agrupar, cuenta ocurrencias con `uniq -c`, ordena de mayor a menor y toma los 10 primeros.

**4. ¿Qué hace `2>&1` al final de un comando?**
> Redirige el stderr (descriptor de archivo 2) al mismo lugar que stdout (descriptor 1). Sin esto, los mensajes de error van a la terminal aunque hayas redirigido stdout a un archivo. Con `comando >> log.txt 2>&1`, tanto la salida normal como los errores van al archivo de log.

**5. ¿Cómo programarías un script para ejecutarse todos los días a las 2am?**
> `crontab -e` y agregar: `0 2 * * * /ruta/al/script.sh >> /var/log/script.log 2>&1`. El formato cron es: minuto hora dia-mes mes dia-semana. El `>> log 2>&1` captura toda la salida para diagnóstico posterior.

**6. ¿Qué diferencia hay entre `grep -E` y `grep` normal?**
> `grep` básico usa expresiones regulares básicas (BRE) donde caracteres como `+`, `?`, `|` necesitan escaparse con `\`. `grep -E` (o `egrep`) usa expresiones regulares extendidas (ERE) donde esos caracteres funcionan directamente. Ejemplo: `grep -E "ERROR|WARNING"` busca ERROR o WARNING; sin `-E` habría que escribir `grep "ERROR\|WARNING"`.
