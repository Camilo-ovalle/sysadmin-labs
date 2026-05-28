# Lab 07 — SCCM: Patch Management con Software Update Point (SUP)

**Prerequisito:** Lab 05 y 06 completados. SCCM con clientes registrados.  
**Duración estimada:** 4-5 horas (incluye tiempos de sincronización con Microsoft Update)  
**Dificultad:** Avanzado

---

## Objetivos del Laboratorio

- Instalar y configurar el rol **Software Update Point (SUP)** con WSUS
- Sincronizar catálogo de actualizaciones con Microsoft Update
- Crear **Software Update Groups** y desplegarlos
- Configurar **Automatic Deployment Rules (ADR)** para parches de seguridad mensuales
- Configurar **Maintenance Windows** para controlar cuándo se instalan los parches
- Monitorear el compliance de actualizaciones
- Entender el flujo completo de Patch Tuesday

---

## Arquitectura de Patch Management

```
Microsoft Update (Internet)
         │
         │ (sincronización programada)
         ▼
┌────────────────────────────┐
│  WSUS (en SCCM01)          │
│  Descarga metadatos y      │
│  binarios de actualizaciones│
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  SCCM SUP                  │
│  Gestiona y aprueba qué    │
│  actualizaciones desplegar │
└────────────┬───────────────┘
             │ (Distribution Point)
     ┌───────┴────────┐
┌────┴──────┐  ┌──────┴─────┐
│  WKSTN-01 │  │  WKSTN-02  │
│  SCCM     │  │  SCCM      │
│  Client   │  │  Client    │
└───────────┘  └────────────┘
```

---

## Parte 1: Instalar WSUS

SCCM usa WSUS como backend para gestionar las actualizaciones. Debes instalar WSUS en SCCM01 antes de configurar el SUP.

### 1.1 Instalar el rol WSUS

**Vía GUI — Server Manager:**

1. En SCCM01, abre **Server Manager** → **Manage** → **Add Roles and Features**
2. **Server Roles** → expande **Windows Server Update Services**
3. Selecciona **WID Connectivity** y **WSUS Services** (usa WID para labs; para producción grande usa SQL)
   - Si prefieres SQL: selecciona **SQL Server Connectivity** en lugar de WID Connectivity
4. Next varias veces hasta llegar a **Confirm** → **Install**
5. Espera que termine (puede tardar varios minutos)

<details>
<summary>⚡ PowerShell — instalar WSUS</summary>

```powershell
# Con WID (para labs)
Install-WindowsFeature -Name UpdateServices -IncludeManagementTools

# Con SQL Server (para entornos medianos/grandes)
Install-WindowsFeature -Name UpdateServices-Services,UpdateServices-DB -IncludeManagementTools
```

</details>

### 1.2 Configurar la carpeta de contenido de WSUS

**Vía GUI — Explorador de archivos:**

1. Abre el Explorador → ve a `D:\`
2. Clic derecho → **New** → **Folder** → nombre: `WSUS`
   > Esta carpeta almacenará los binarios de las actualizaciones. Asegúrate de que el disco tenga suficiente espacio (50+ GB).

**Ejecutar la configuración post-instalación — Línea de comandos (obligatorio):**

El asistente post-instalación de WSUS no tiene opción gráfica completa. Ejecuta en una ventana de comandos elevada:

```cmd
"C:\Program Files\Update Services\Tools\WsusUtil.exe" postinstall CONTENT_DIR=D:\WSUS
```

Si usas SQL Server:
```cmd
"C:\Program Files\Update Services\Tools\WsusUtil.exe" postinstall SQL_INSTANCE_NAME=SCCM01 CONTENT_DIR=D:\WSUS
```

> La ejecución puede tardar varios minutos. Verás el mensaje `Post install has successfully completed` cuando termine.

### 1.3 Verificar instalación de WSUS

**Vía GUI — Windows Services (`services.msc`):**

1. Abre **services.msc**
2. Busca **WSUS Service** — debe estar en estado **Running** y startup **Automatic**

<details>
<summary>⚡ PowerShell — verificación por consola</summary>

```powershell
Get-Service -Name "WsusService" | Select-Object Name, Status, StartType
```

</details>

---

## Parte 2: Configurar el Software Update Point en SCCM

### 2.1 Agregar el rol SUP al sitio

En la consola de SCCM:
`Administration > Site Configuration > Servers and Site System Roles`

1. Selecciona `SCCM01`
2. Clic derecho → **Add Site System Roles**
3. Selecciona **Software Update Point**
4. Configuración del SUP:
   - **WSUS Port:** 8530 (HTTP — para labs con HTTP. En producción: 8531 HTTPS)
   - **Use this server as an active software update point**
   - **Use a proxy server for software update synchronization:** No (para labs con internet directo)
5. **Synchronization Source:**
   - Synchronize from Microsoft Update (para el top-level site)
6. **Synchronization Schedule:**
   - Simple schedule: cada 1 semana (para labs; en producción ajustar a después de Patch Tuesday)

### 2.2 Configurar las clasificaciones a sincronizar

En la consola: `Administration > Site Configuration > Sites > Software Update Point Component`

Pestaña **Classifications** — selecciona:
- Critical Updates
- Security Updates
- Update Rollups
- Updates
- Feature Packs (opcional)
- Service Packs (opcional)
- Definition Updates (solo si tienes Defender gestionado por SCCM)

> Para el lab, selecciona solo **Security Updates** y **Critical Updates** para que la sincronización sea más rápida.

### 2.3 Configurar los productos a sincronizar

Pestaña **Products** — selecciona según tus clientes:
- Windows 10 (versión específica de tus clientes)
- Windows 11 (si aplica)
- Microsoft 365 Apps for Enterprise (si usas Office)

> En el lab, selecciona solo las versiones de Windows que tienes en los clientes. Desmarcar todo lo demás reduce dramáticamente el tiempo de sincronización.

### 2.4 Realizar la primera sincronización

`Software Library > Software Updates > All Software Updates`
Clic derecho → **Synchronize Software Updates**

Verifica el progreso en:
```
Monitoring > Software Update Point Synchronization Status
```

O desde el log:
```powershell
Get-Content "C:\Program Files\Microsoft Configuration Manager\Logs\wsyncmgr.log" -Tail 50
```

> La primera sincronización puede tardar **30-60 minutos o más** según los productos seleccionados. Verás miles de actualizaciones importarse.

---

## Parte 3: Configurar Client Settings para Actualizaciones

### 3.1 Crear Client Settings personalizados para actualizaciones

`Administration > Client Settings`

1. Clic derecho → **Create Custom Client Device Settings**
2. Name: `CS_Software_Updates_Standard`
3. **Software Updates:**
   - Enable software updates on clients: `Yes`
   - Software update scan schedule: `7 days`
   - Schedule deployment re-evaluation: `7 days`
   - When any software update deployment deadline is reached: `Install all software update deployments with deadline coming in a specified time` → `72 hours`
   - Enable software updates in maintenance window when `No maintenance window defined`: `No` (respetar maintenance windows)
4. **Computer Restart:**
   - Display a temporary notification to the user...: `90 minutes`
   - Display a dialog box that the user cannot close: `15 minutes`

### 3.2 Asignar los Client Settings a una colección

Clic derecho en `CS_Software_Updates_Standard` → **Deploy** → selecciona `DC_All_Windows10_Clients`

---

## Parte 4: Crear Software Update Groups y Deployments

Un **Software Update Group (SUG)** es una colección de actualizaciones que se despliegan juntas. Equivale a un "paquete de parches".

### 4.1 Filtrar actualizaciones relevantes

`Software Library > Software Updates > All Software Updates`

Filtra por:
- **Required:** > 0 (actualizaciones que algún cliente necesita)
- **Expired:** No
- **Superseded:** No
- **Date Released:** últimos 3 meses

Selecciona todas las actualizaciones de seguridad críticas resultantes.

### 4.2 Crear el Software Update Group

Con las actualizaciones seleccionadas:
1. Clic derecho → **Create Software Update Group**
2. Name: `SUG_Security_Updates_YYYY_MM` (usa el mes y año actual)
3. Description: `Actualizaciones de seguridad mensuales`

### 4.3 Descargar el contenido de las actualizaciones

Antes del deployment, las actualizaciones deben estar en el DP:

1. Clic derecho en el SUG → **Download**
2. **Deployment Package:**
   - Create new: `DP_Security_Updates_YYYY_MM`
   - Package source: `D:\Sources\SoftwareUpdates\Security_YYYY_MM`
3. **Distribution Points:** Selecciona `SCCM01`
4. Lanzar el download

Verifica progreso en `Monitoring > Distribution Status > Content Status`.

### 4.4 Desplegar el Software Update Group

1. Clic derecho en el SUG → **Deploy**
2. **General:**
   - Name: `DEP_Security_Updates_YYYY_MM`
   - Collection: `DC_All_Windows10_Clients`
3. **Deployment Settings:**
   - Type: **Required**
   - Detail level: `Only error messages`
4. **Scheduling:**
   - Software available time: `As soon as possible`
   - Installation deadline: (ej. próximo domingo a las 02:00 AM — dentro de la Maintenance Window)
5. **User Experience:**
   - User notifications: `Only show in Software Center and only show notifications for computer restarts`
   - Suppress restarts for: **Servers** (si aplicase)
   - Deadline behavior: `Software Update Installation` + `System Restart (if required)`
6. Completa el asistente

---

## Parte 5: Maintenance Windows

Las **Maintenance Windows** controlan en qué horario SCCM puede instalar software y parches en una colección. Fuera de la ventana, las instalaciones no se ejecutan aunque haya deadline.

### 5.1 Crear Maintenance Window para clientes de producción

En `Assets and Compliance > Device Collections`:
1. Selecciona `DC_All_Windows10_Clients`
2. Clic derecho → **Properties** → pestaña **Maintenance Windows**
3. Clic en el ícono de estrella (New):
   - Name: `MW_Noche_Fin_De_Semana`
   - Schedule: **Custom**
   - Recurrence pattern: **Monthly**
   - Day: **Second Sunday** of the month
   - Start: `22:00`
   - Duration: `4 hours`
   - Apply this schedule to: **All deployments** (o solo Software Updates si prefieres)

> **Estrategia recomendada para Patch Tuesday:**
> - Patch Tuesday es el 2do martes de cada mes
> - Configura la MW para el 2do domingo del mes siguiente (da 2 semanas de pruebas)
> - Esto es lo que hacen la mayoría de empresas

---

## Parte 6: Automatic Deployment Rules (ADR)

Las **ADRs** automatizan el proceso de "buscar parches nuevos → crear SUG → desplegarlo". Es el corazón del Patch Management automatizado.

### 6.1 Crear una ADR para parches de seguridad críticos

`Software Library > Software Updates > Automatic Deployment Rules`

1. Clic derecho → **Create Automatic Deployment Rule**
2. **General:**
   - Name: `ADR_Security_Critical_Monthly`
   - Template: `Patch Tuesday`
   - Collection: `DC_All_Windows10_Clients`
   - Create a new Software Update Group each time this rule runs: **No** (usar el mismo SUG y añadir las nuevas actualizaciones)
   - Enable the deployment after this rule is run: Yes
3. **Deployment Settings:**
   - Type: **Required**
   - Detail level: `Only error messages`
4. **Software Updates (Filtros):**
   
   | Filtro | Valor |
   |---|---|
   | Date Released or Revised | Last 1 month |
   | Product | Windows 10 (versiones seleccionadas) |
   | Update Classification | Security Updates, Critical Updates |
   | Superseded | No |
   | Required | > 0 |
   
5. **Evaluation Schedule:**
   - Run this rule on a schedule: **Monthly**
   - Day: **3rd Wednesday** (una semana después de Patch Tuesday para que haya tiempo de que salgan los parches)
   - Time: **01:00**
6. **Deployment Schedule:**
   - Software available time: `As soon as possible after the rule is run`
   - Installation deadline: `2 weeks after software is made available`
7. **User Experience:** igual que el deployment manual
8. **Deployment Package:**
   - Create a new deployment package
   - Name: `DP_ADR_Security_Critical`
   - Source location: `D:\Sources\SoftwareUpdates\ADR_Security`
   - Distribution Points: `SCCM01`
9. **Language Selection:** selecciona los idiomas de tus clientes (Español)

### 6.2 Ejecutar la ADR manualmente para probar

Clic derecho en la ADR → **Run Now**

Monitorea el resultado en `Monitoring > Deployments` y `Monitoring > Reporting > Reports > Software Updates`.

---

## Parte 7: Monitoreo de Compliance de Actualizaciones

### 7.1 Ver compliance desde la consola

`Monitoring > Deployments`

Selecciona tu deployment de actualizaciones. Verás:
- Compliant: equipos con todas las actualizaciones instaladas
- Non-Compliant: equipos que faltan actualizaciones
- Error: equipos con errores en la instalación
- Unknown: clientes que no han reportado

### 7.2 Reportes de actualizaciones

`Monitoring > Reporting > Reports > Software Updates`

Reportes útiles:
- **Compliance 4 - Updates by vendor month year:** muestra actualizaciones por mes
- **Compliance 7 - Computers in a specific compliance state for an update group:** por colección
- **Software update groups compliance summary:** resumen rápido por SUG

### 7.3 Dashboard de Software Updates

`Software Library > Software Updates > Software Update Groups`
Selecciona tu SUG → pestaña **Summary**: muestra el porcentaje de compliance en tiempo real.

---

## Parte 8: Diagnóstico y Troubleshooting

### 8.1 Logs del cliente para actualizaciones

```powershell
$logPath = "C:\Windows\CCM\Logs"

# WUAHandler.log — comunicación con Windows Update Agent
# ScanAgent.log — escaneo de actualizaciones necesarias  
# UpdatesDeployment.log — proceso de deployment de actualizaciones
# UpdatesStore.log — almacén local de estado de actualizaciones
# WUAHandler.log — historial de instalaciones
# RebootCoordinator.log — coordinación de reinicios
# execmgr.log — ejecución de los packages de actualización

# Ver actualizaciones pendientes de instalar en el cliente
Get-WmiObject -Namespace "root\ccm\clientsdk" -Class CCM_SoftwareUpdate |
    Where-Object { $_.EvaluationState -ne 8 } |
    Select-Object Name, EvaluationState, ErrorCode |
    Format-Table -AutoSize

# Estados de EvaluationState:
# 0 = None
# 1 = Available
# 2 = Submitted
# 7 = Installing
# 8 = Installed (compliant)
# 13 = Error
```

### 8.2 Verificar WSUS

```powershell
# Estado del servicio WSUS
Get-Service WsusService

# Ver el contenido del log de sincronización en SCCM
Get-Content "C:\Program Files\Microsoft Configuration Manager\Logs\wsyncmgr.log" -Tail 30

# Ver si el cliente está apuntando al SCCM como WSUS
# (En el cliente)
Get-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" |
    Select-Object WUServer, WUStatusServer
```

Deben mostrar `http://SCCM01:8530`.

### 8.3 Forzar escaneo y deployment en el cliente

```powershell
# En el cliente — forzar escaneo de actualizaciones
$sched = "{00000000-0000-0000-0000-000000000113}"
Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client -Name TriggerSchedule -ArgumentList $sched

# Forzar evaluación de deployments de actualizaciones
$sched = "{00000000-0000-0000-0000-000000000108}"
Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client -Name TriggerSchedule -ArgumentList $sched

# Ver actualizaciones instaladas via SCCM
Get-WmiObject -Namespace root\ccm\softmgmt\updatescompliance -Class SMS_UpdatesAssignment `
    -ErrorAction SilentlyContinue
```

---

## Troubleshooting Común

| Problema | Causa probable | Solución |
|---|---|---|
| SUP no sincroniza | WSUS no está corriendo | `Start-Service WsusService` |
| SUP no sincroniza | Puerto 8530 bloqueado por firewall | Abrir puerto 8530 en el firewall de SCCM01 |
| Clientes no reciben actualizaciones | Client Settings no desplegados | Verificar en `Administration > Client Settings` que esté asignado a la colección |
| Cliente apunta a Microsoft Update en vez de SUP | Política de WSUS del cliente no aplicada | Forzar Machine Policy y verificar `HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate` |
| Compliance siempre "Unknown" | Hardware Inventory no ha corrido | Forzar Hardware Inventory Cycle en el cliente |
| Parches descargados pero no instalados | Fuera de Maintenance Window | Verificar que la MW está configurada y el deadline es dentro de la MW |
| "Content not found" | DP no tiene el contenido | Redistribuir el Deployment Package al DP |
| Error 0x80070643 | Windows Update Agent error | Ver Windows Update logs: `C:\Windows\WindowsUpdate.log` o `Get-WindowsUpdateLog` |

---

## Resumen del Flujo Completo de Patch Management

```
1. Patch Tuesday (2do martes del mes)
   └─ Microsoft publica actualizaciones de seguridad

2. SCCM SUP sincroniza (~12-24 horas después)
   └─ Nuevas actualizaciones aparecen en Software Library

3. ADR se ejecuta (3ra semana del mes)
   └─ Filtra actualizaciones relevantes
   └─ Crea/actualiza el Software Update Group
   └─ Descarga contenido al DP
   └─ Crea el deployment con deadline en 2 semanas

4. Clientes escanean y detectan updates pendientes
   └─ Reportan estado a SCCM

5. Maintenance Window se abre (domingo por la noche)
   └─ Clientes instalan las actualizaciones
   └─ Reinician si es necesario

6. Lunes por la mañana
   └─ Dashboard muestra compliance
   └─ Equipos que fallaron: investigar logs
```

---

## Próximo Paso

**Lab 08 — SCCM: OSD y Task Sequences**  
El lab más avanzado de la serie. Configurarás PXE boot, crearás imágenes de Windows, construirás Task Sequences para despliegue bare-metal y refresh de sistemas operativos.
