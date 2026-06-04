---
title: 'Ops — Backups, Rollback y Recuperación'
description: Estrategias de backup, procedimientos de rollback de cambios fallidos, recuperación de routing y firewall, backup del Active Directory, y estrategia 3-2-1.
sidebar:
  label: 'Ops: Backups y Rollback'
  badge:
    text: Intermedio
    variant: caution
---

# Backups, Rollback y Recuperación de Desastres

**Duración estimada:** 1–2 horas  
**Dificultad:** Intermedio

---

## 🎯 Estrategia 3-2-1

La regla de oro del backup:

```
3 copias de los datos
2 medios de almacenamiento diferentes
1 copia offsite (fuera del sitio físico o en cloud)

Ejemplo:
  ✅ Copia 1: Servidor de backup local (copia primaria)
  ✅ Copia 2: NAS en el mismo datacenter (medio diferente)
  ✅ Copia 3: Azure Blob Storage / S3 (offsite/cloud)
```

### Evolución: 3-2-1-1-0

La versión moderna añade:
- **+1**: al menos 1 copia inmutable (no puede ser modificada/borrada por ransomware)
- **+0**: 0 errores en las restauraciones verificadas periódicamente

> ⚠️ **Un backup que no se ha probado, no es un backup.** Programa restauraciones de prueba periódicamente.

---

## 🏢 Backup de Active Directory

AD es el componente más crítico del entorno Windows. Si el DC cae sin backup, perderías todos los usuarios, grupos, GPOs y configuración.

### Backup del Estado del Sistema (System State)

El `System State` en un DC incluye: AD DS (NTDS.dit), SYSVOL, Registro, Boot files, Certificate Services (si aplica).

```powershell
# Instalar Windows Server Backup (si no está instalado)
Install-WindowsFeature Windows-Server-Backup

# Backup del System State a una ubicación de red
wbadmin start systemstatebackup -backuptarget:\\BACKUPSERVER\backups\dc01

# Backup del System State a disco local
wbadmin start systemstatebackup -backuptarget:F:

# Ver backups disponibles
wbadmin get versions

# Programar backup automático diario vía tarea programada
$action = New-ScheduledTaskAction -Execute 'wbadmin.exe' `
    -Argument 'start systemstatebackup -backuptarget:\\BACKUPSERVER\backups\dc01 -quiet'
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "DC-SystemState-Backup" `
    -Action $action -Trigger $trigger -RunLevel Highest
```

### Recuperación del AD DS (Directory Services Restore Mode)

Si NTDS.dit se corrompe o necesitas recuperar el AD:

1. Reiniciar el DC → `F8` → **Directory Services Restore Mode (DSRM)**
2. Iniciar sesión con la contraseña DSRM (configurada al crear el dominio)
3. Ejecutar la restauración:

```powershell
# Restaurar el System State
wbadmin start systemstaterecovery -version:<FECHA/HORA> -quiet

# Si la restauración es en el mismo DC: authoritative restore (para recuperar objetos borrados)
# ntdsutil → "activate instance ntds" → "authoritative restore" → "restore object <DN>"
```

### Papelera de reciclaje de AD (AD Recycle Bin)

Antes de necesitar restaurar un backup por un objeto borrado, activa la papelera:

```powershell
# Habilitar AD Recycle Bin (requiere DFL 2008 R2+)
Enable-ADOptionalFeature -Identity "Recycle Bin Feature" `
    -Scope ForestOrConfigurationSet `
    -Target "corp.local"

# Restaurar un usuario borrado
Get-ADObject -Filter {displayName -eq "Juan Perez"} `
    -IncludeDeletedObjects | Restore-ADObject
```

---

## 🔄 Rollback de Cambios Fallidos

Un rollback es revertir un cambio que causó problemas en producción. Es una de las habilidades más valoradas en un SysAdmin.

### Principio del Change Management

Antes de cualquier cambio significativo:
1. **Plan de implementación**: paso a paso del cambio
2. **Plan de rollback**: cómo deshacer el cambio si algo falla
3. **Ventana de mantenimiento**: horario de baja actividad
4. **Criterios de éxito**: cómo verificas que el cambio funcionó
5. **Criterios de rollback**: cuándo decides hacer rollback

### Rollback de Configuración de Red / Routing

```powershell
# ANTES del cambio: exportar configuración de rutas
route print > C:\backup-routes-$(Get-Date -Format 'yyyyMMdd-HHmm').txt

# Si el cambio de routing falla, restaurar rutas
# Leer el archivo de backup y re-agregar cada ruta:
$backup = Get-Content "C:\backup-routes-20241201-0200.txt"
# Identificar las rutas específicas y ejecutar:
route add 10.0.0.0 MASK 255.0.0.0 192.168.100.1 METRIC 10
```

```bash
# Linux: exportar tabla de rutas antes del cambio
ip route show > /tmp/backup-routes-$(date +%Y%m%d-%H%M).txt

# Rollback
ip route flush table main
while read -r line; do
    ip route add $line
done < /tmp/backup-routes-20241201-0200.txt
```

### Rollback de Configuración de Firewall

```cisco
! Cisco ASA — Guardar config ANTES del cambio
copy running-config startup-config
copy running-config tftp://192.168.100.50/asa-backup-$(date).cfg

! Configurar reload automático como seguro de rollback
reload in 30    ! Si no cancelas en 30 min, reinicia y vuelve a startup-config
! Después de verificar que el cambio está bien:
reload cancel
```

```bash
# pfSense / Linux con iptables
# Guardar reglas actuales
iptables-save > /tmp/iptables-backup-$(date +%Y%m%d-%H%M).rules

# Después de hacer cambios, si algo falla:
iptables-restore < /tmp/iptables-backup-20241201-0200.rules
```

### Rollback de Actualizaciones / Parches de Windows

```powershell
# Ver actualizaciones instaladas
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10

# Desinstalar un parche específico
wusa.exe /uninstall /kb:KB5031455 /quiet /norestart

# Con SCCM: crear despliegue de "Uninstall" de la actualización
# En consola SCCM → Software Library → Software Updates → buscar el parche → Deployments → Uninstall

# Ver puntos de restauración
Get-ComputerRestorePoint

# Crear punto de restauración antes de un cambio
Checkpoint-Computer -Description "Antes de cambio de configuracion red" -RestorePointType MODIFY_SETTINGS
```

### Rollback de Cambios en Active Directory

```powershell
# Si hiciste un cambio masivo con PowerShell (ej: moviste muchos usuarios a la OU equivocada)
# Usa el historial del script para identificar los objetos afectados

# Opción 1: Usar AD Recycle Bin (si borraste objetos)
Get-ADObject -Filter {isDeleted -eq $true} -IncludeDeletedObjects |
    Where-Object { $_.whenChanged -gt (Get-Date).AddHours(-1) } |
    Restore-ADObject

# Opción 2: Restaurar desde backup (System State)
# Solo si el problema es grave y la papelera de reciclaje no aplica

# Opción 3: Restauración autoritativa de atributos específicos
# ntdsutil para restauraciones granulares
```

---

## 💾 Backup de Servidores con Veeam / Windows Server Backup

### Windows Server Backup — Backup completo de VM

```powershell
# Backup de volúmenes específicos
wbadmin start backup `
    -backuptarget:\\NAS01\backups `
    -include:C:,D: `
    -allCritical `
    -quiet

# Backup bare-metal (incluye todo lo necesario para recuperar el servidor completo)
wbadmin start backup `
    -backuptarget:\\NAS01\backups `
    -allCritical `
    -systemState `
    -quiet
```

### Estrategia de retención

```
Retención recomendada para entorno corporativo:
  - Backup diario: retener 30 días
  - Backup semanal (domingo): retener 12 semanas
  - Backup mensual (primer día): retener 12 meses
  - Backup anual: retener 7 años (cumplimiento regulatorio)
```

---

## 🚨 Runbook de Recuperación de Desastres

Un **runbook** es el procedimiento documentado paso a paso para recuperar un servicio. Todo SysAdmin debe tener runbooks para los servicios críticos.

### Runbook: DC caído (sin backup disponible)

```
Escenario: El único DC dejó de funcionar y no hay backup reciente.

1. Si hay segundo DC:
   - Verificar que el segundo DC tiene los roles FSMO
   - Transferir roles si es necesario: netdom /fsmo
   - Los clientes deberían reconectarse automáticamente

2. Si no hay segundo DC (caso malo):
   - Restaurar desde último backup del System State
   - Si no hay backup: reconstruir el DC desde cero
     * Instalar Windows Server
     * Instalar AD DS
     * Usar metadata cleanup para limpiar el DC muerto
     * Re-unir todos los clientes al dominio

3. Prevención: SIEMPRE tener al menos 2 DCs
```

---

## 🎤 Preguntas de Entrevista

**1. Explica la regla 3-2-1 de backups.**
> 3 copias de los datos (el original + 2 backups), en 2 medios de almacenamiento diferentes (ej: disco local + NAS), con 1 copia offsite (en una ubicación física diferente o en la nube). Esto protege contra: falla de hardware (2 copias), falla del sitio físico/incendio/robo (copia offsite). La variante moderna 3-2-1-1-0 añade una copia inmutable (resistente a ransomware) y requiere 0 errores en las pruebas de restauración.

**2. Has participado en rollbacks de cambios fallidos. ¿Cuál es tu proceso?**
> Antes del cambio: documentar el estado actual (exportar config de red, guardar config del firewall, hacer snapshot de VM), definir el plan de rollback y los criterios para activarlo, trabajar en ventana de mantenimiento. Si el cambio falla: ejecutar el plan de rollback (restaurar config, revertir rutas), verificar que el servicio está operativo, documentar qué falló y por qué. En Cisco ASA usaba `reload in 30` como red de seguridad automática.

**3. ¿Cómo harías backup del Active Directory?**
> Con Windows Server Backup, backup del `System State` que incluye NTDS.dit (base de datos de AD), SYSVOL y el Registro. Se programa automáticamente via tarea programada o Windows Server Backup. Para recuperar objetos borrados accidentalmente, la AD Recycle Bin es la primera opción (más rápida). Si el DC está corrupto, se restaura en modo DSRM. En producción siempre hay al menos 2 DCs para no depender de un solo punto de falla.

**4. ¿Qué es el modo DSRM y cuándo lo usas?**
> Directory Services Restore Mode: es el modo seguro del DC para tareas de mantenimiento del AD. Se accede presionando F8 al arrancar y usando la contraseña DSRM (configurada al crear el dominio). Se usa para: restaurar un backup del System State, reparar NTDS.dit corrupto, o hacer restauraciones autoritativas de objetos con ntdsutil.

**5. ¿Cómo recuperarías la configuración de routing de un router que dejó de funcionar?**
> Si había backup de la configuración (debería haberlo): restaurarlo desde el servidor TFTP o desde el archivo de backup. En Cisco: `copy tftp running-config` con la IP del servidor y el nombre del archivo. Si no hay backup, reconstruir la configuración desde la documentación de red. Por eso es crítico documentar y hacer backup de las configuraciones de red antes de cualquier cambio, y almacenarlas en repositorio centralizado (ej: git para configs de red, o TFTP server).

**6. ¿Con qué frecuencia deberías probar la restauración de backups?**
> Al menos una vez al mes para datos críticos, y siempre después de cambios en la infraestructura de backup. La prueba debe verificar que los datos restaurados son funcionales y completos, no solo que el archivo de backup existe. Muchas organizaciones descubren que sus backups están corruptos o incompletos solo cuando necesitan restaurar en una emergencia real — cuando ya es demasiado tarde.
