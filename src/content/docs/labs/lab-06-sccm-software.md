---
title: "Lab 06 — SCCM: Despliegue de Software"
description: Despliegue de aplicaciones con SCCM usando Applications, Detection Methods, Collections y despliegues Required vs Available.
sidebar:
  label: "Lab 06: Despliegue Software"
  badge:
    text: Avanzado
    variant: danger
---

# Lab 06 — SCCM: Despliegue de Software

**Prerequisito:** Lab 05 completado. SCCM instalado, clientes registrados, Distribution Point configurado.  
**Duración estimada:** 3-4 horas  
**Dificultad:** Avanzado

---

## Objetivos del Laboratorio

- Entender la diferencia entre **Packages**, **Applications** y **Scripts**
- Crear y desplegar software mediante Applications (método moderno)
- Configurar **Detection Methods** para verificar si el software ya está instalado
- Crear **Collections** de dispositivos y usuarios
- Realizar despliegues **Required** (forzado) y **Available** (bajo demanda)
- Verificar el cumplimiento del despliegue y diagnosticar errores

---

## Conceptos Clave

### Packages vs Applications

| | Package | Application |
|---|---|---|
| **Cuándo usar** | Software legacy, scripts, herramientas sin instalador MSI | Software moderno con MSI/EXE |
| **Detection Method** | No tiene (no detecta si ya está instalado) | Sí tiene — verifica antes de instalar |
| **Supersedence** | No | Sí — puede reemplazar versiones anteriores |
| **User-targeted deployment** | Solo equipos | Equipos y usuarios |
| **Complejidad** | Baja | Media |

> **Recomendación:** Usa siempre **Applications** para software nuevo. Usa **Packages** solo para scripts o software muy antiguo sin detección.

### Tipos de deployment

| Tipo | Descripción |
|---|---|
| **Required** | El software se instala automáticamente en los equipos/usuarios del deployment. El usuario no puede elegir. |
| **Available** | Aparece en el Software Center del cliente para que el usuario lo instale cuando quiera. |

---

## Parte 1: Preparar el Software a Desplegar

Para el lab, usaremos software gratuito y con instalador MSI bien documentado:
- **7-Zip** (MSI): Herramienta de compresión
- **VLC** (MSI): Reproductor de medios
- **Google Chrome** (MSI Enterprise): Navegador

### 1.1 Descargar los instaladores MSI

**Vía GUI — Explorador de archivos (en SCCM01):**

1. Abre el Explorador de archivos → ve a `D:\`
2. Clic derecho → **New** → **Folder** → nombre: `Sources`
3. Dentro de `D:\Sources`, crea la carpeta `Software`
4. Dentro de `D:\Sources\Software`, crea tres subcarpetas: `7-Zip`, `VLC`, `Chrome`

Descarga los MSI directamente en sus carpetas:
- **7-Zip:** `7z2301-x64.msi` desde 7-zip.org → guarda en `D:\Sources\Software\7-Zip\`
- **VLC:** `vlc-3.x.x-win64.msi` desde videolan.org → guarda en `D:\Sources\Software\VLC\`
- **Chrome Enterprise:** `googlechromestandaloneenterprise64.msi` desde google.com/chrome/enterprise → guarda en `D:\Sources\Software\Chrome\`

<details>
<summary>⚡ PowerShell — crear la estructura de carpetas</summary>

```powershell
$sourcePath = "D:\Sources\Software"
foreach ($app in @("7-Zip","VLC","Chrome")) {
    New-Item -Path "$sourcePath\$app" -ItemType Directory -Force
}
```

</details>

### 1.2 Crear el share de fuentes de software

**Vía GUI — Server Manager:**

1. En SCCM01, abre **Server Manager** → **File and Storage Services** → **Shares**
2. Clic en **Tasks** → **New Share** → **SMB Share – Quick** → Next
3. Share location: `D:` → Next
4. Share name: `Sources$`
   - El signo `$` al final hace el share **oculto** — no aparece al explorar la red. Buena práctica de seguridad.
5. En **Permissions** → **Customize permissions**:
   - Pestaña **Share**: elimina los permisos actuales
   - Agrega `CORP\svc_SCCM` → **Full Control**
   - Agrega `CORP\Domain Admins` → **Full Control**
   - Agrega `CORP\Domain Computers` → **Read**
   - Agrega `Authenticated Users` → **Read**
6. **Create**

<details>
<summary>⚡ PowerShell — crear el share</summary>

```powershell
New-SmbShare -Name "Sources$" -Path "D:\Sources" `
    -Description "Fuentes de software SCCM" `
    -FullAccess "CORP\svc_SCCM","CORP\Domain Admins" `
    -ReadAccess "CORP\Domain Computers","CORP\Authenticated Users"
```

</details>

---

## Parte 2: Crear Collections

Las **Collections** son grupos de dispositivos o usuarios que reciben deployments. Pueden ser estáticas (membresía manual) o dinámicas (basadas en consultas).

### 2.1 Crear Device Collections

En la consola de SCCM: `Assets and Compliance > Device Collections`

**Collection estática — Todos los clientes Windows 10/11:**

1. Clic derecho → **Create Device Collection**
2. Name: `DC_All_Windows10_Clients`
3. Limiting collection: `All Systems`
4. Membership rules → **Add Rule > Query Rule**:
   - Name: `Windows 10 and 11`
   - Query Statement:
   ```sql
   SELECT SMS_R_System.ResourceId, SMS_R_System.ResourceType,
          SMS_R_System.Name, SMS_R_System.SMSAssignedSites,
          SMS_R_System.IPAddresses, SMS_R_System.IPSubnets,
          SMS_R_System.OperatingSystemNameandVersion
   FROM SMS_R_System
   WHERE SMS_R_System.OperatingSystemNameandVersion LIKE "%Workstation%"
   ```

**Collection dinámica — Equipos sin 7-Zip:**

1. Clic derecho → **Create Device Collection**
2. Name: `DC_Sin_7Zip`
3. Limiting collection: `DC_All_Windows10_Clients`
4. Membership rules → **Add Rule > Query Rule**:
   ```sql
   SELECT SMS_R_System.ResourceId, SMS_R_System.ResourceType,
          SMS_R_System.Name
   FROM SMS_R_System
   LEFT OUTER JOIN SMS_G_System_ADD_REMOVE_PROGRAMS_64
       ON SMS_G_System_ADD_REMOVE_PROGRAMS_64.ResourceId = SMS_R_System.ResourceId
   WHERE SMS_G_System_ADD_REMOVE_PROGRAMS_64.DisplayName NOT LIKE "7-Zip%"
       OR SMS_G_System_ADD_REMOVE_PROGRAMS_64.DisplayName IS NULL
   ```

> **Nota:** Para que las consultas basadas en inventario funcionen, primero debes ejecutar un ciclo de inventario de hardware en los clientes. Espera al menos un ciclo de Hardware Inventory antes de crear estas colecciones.

### 2.2 Crear User Collections

`Assets and Compliance > User Collections`

**Collection — Usuarios de IT:**

1. Clic derecho → **Create User Collection**
2. Name: `UC_Usuarios_IT`
3. Membership rules → **Add Rule > Query Rule**:
   ```sql
   SELECT SMS_R_User.ResourceId, SMS_R_User.ResourceType,
          SMS_R_User.UniqueUserName, SMS_R_User.WindowsNTDomain
   FROM SMS_R_User
   WHERE SMS_R_User.UserGroupName LIKE "%GG_IT%"
   ```

---

## Parte 3: Crear y Desplegar una Application (7-Zip)

### 3.1 Crear la Application

En la consola: `Software Library > Application Management > Applications`

1. Clic derecho → **Create Application**
2. Selecciona `Automatically detect information about this application from installation files`
3. Type: **Windows Installer (*.msi file)**
4. Location: `\\SCCM01\Sources$\Software\7-Zip\7z2301-x64.msi`
5. El asistente leerá el MSI y rellenará la información automáticamente:
   - Name: `7-Zip 23.01 (x64)`
   - Publisher: `Igor Pavlov`
   - Software version: `23.01`
6. **General Information:** Completa:
   - Administrator comments: `Herramienta de compresión de archivos`
   - Categories (opcional): crea categorías como "Herramientas", "Productividad"
7. **Deployment Types:** El asistente ya creó uno automáticamente (DT detectado del MSI)

### 3.2 Revisar y ajustar el Deployment Type

En la Application creada, selecciona la pestaña **Deployment Types**:
1. Doble clic en el DT existente
2. Pestaña **Detection Method:**
   - El asistente lo detectó del MSI automáticamente (Product Code del MSI)
   - Verifica que sea correcto: `Windows Installer` + Product Code del MSI
3. Pestaña **User Experience:**
   - Installation behavior: `Install for system`
   - Logon requirement: `Whether or not a user is logged on`
   - Installation program visibility: `Hidden` (el usuario no ve la instalación)
4. Pestaña **Requirements:** (opcional)
   - Puedes añadir condiciones: `Operating system = Windows 10 x64`
5. Pestaña **Return Codes:**
   - `0` = Success
   - `3010` = Success, reboot required (ya debe estar configurado)

### 3.3 Distribuir el contenido al Distribution Point

Antes de hacer el deployment, el contenido debe estar en el DP:

1. Clic derecho en la Application → **Distribute Content**
2. Selecciona `SCCM01` como Distribution Point
3. El contenido se copia de `\\SCCM01\Sources$\Software\7-Zip\` al DP

Verifica en `Monitoring > Distribution Status > Content Status`:
- El estado debe cambiar de `In Progress` a `Success`

### 3.4 Crear el Deployment — Required (forzado)

1. Clic derecho en la Application → **Deploy**
2. **General:**
   - Software: `7-Zip 23.01 (x64)`
   - Collection: `DC_All_Windows10_Clients`
3. **Content:** (ya distribuido) → Next
4. **Deployment Settings:**
   - Action: **Install**
   - Purpose: **Required** (se instalará automáticamente)
5. **Scheduling:**
   - Software available time: `As soon as possible`
   - Installation deadline: `Specific time` → pon una hora en el futuro (ej. 1 hora)
6. **User Experience:**
   - User notifications: `Only show in Software Center and only show notifications for computer restarts`
   - Commit changes at deadline or during a maintenance window: (depende de tus maintenance windows)
7. **Alerts:** Configura si quieres alertas cuando el deployment falle en un % de equipos
8. Finaliza el asistente

### 3.5 Verificar el Deployment en el cliente

En el cliente Windows 10/11:

```powershell
# Forzar evaluación de políticas de máquina
Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client -Name TriggerSchedule -ArgumentList "{00000000-0000-0000-0000-000000000021}"

# Forzar Application Evaluation Cycle
Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client -Name TriggerSchedule -ArgumentList "{00000000-0000-0000-0000-000000000026}"

# Ver log de instalaciones
Get-Content "C:\Windows\CCM\Logs\AppEnforce.log" -Tail 30

# Ver log de evaluación de aplicaciones
Get-Content "C:\Windows\CCM\Logs\AppDiscovery.log" -Tail 30
```

También puedes abrir el **Software Center** en el cliente (desde el menú inicio) y ver el estado del deployment.

---

## Parte 4: Deployment Available (Software Center)

Ahora desplegaremos VLC como **Available** — el usuario puede instalarlo cuando quiera desde el Software Center.

### 4.1 Crear la Application VLC

Repite el proceso del paso 3.1-3.2 para VLC:
- Location: `\\SCCM01\Sources$\Software\VLC\vlc-x.x.x-win64.msi`

### 4.2 Crear el Deployment Available

1. Clic derecho en la Application VLC → **Deploy**
2. Collection: `DC_All_Windows10_Clients`
3. **Deployment Settings:**
   - Purpose: **Available**
   - Make available to: `Configuration Manager clients`
4. **Scheduling:**
   - Software available time: `As soon as possible`
   - No installation deadline (es disponible, no requerido)
5. Finaliza

### 4.3 Verificar en el Software Center

En el cliente:
1. Abre el **Software Center** (buscar en inicio o `C:\Windows\CCMSetup\softwarecenter:`)
2. En la sección **Available Software**, debe aparecer VLC
3. El usuario puede hacer clic en **Install** cuando quiera

---

## Parte 5: Deployment con Script (Packages)

Para software que no tiene MSI (o para ejecutar scripts), usamos Packages.

### 5.1 Crear un script de ejemplo

Crea `C:\Scripts\SCCM\InstallChrome.cmd`:

```batch
@echo off
echo Instalando Google Chrome Enterprise...
msiexec /i "%~dp0googlechromestandaloneenterprise64.msi" /quiet /norestart REBOOT=ReallySuppress
if %ERRORLEVEL% == 0 (
    echo Chrome instalado exitosamente
    exit /b 0
) else (
    echo Error instalando Chrome: %ERRORLEVEL%
    exit /b 1
)
```

### 5.2 Crear el Package

En la consola: `Software Library > Application Management > Packages`

1. Clic derecho → **Create Package**
2. **Package Information:**
   - Name: `Google Chrome Enterprise 64-bit`
   - Version: `120.0`
   - Manufacturer: `Google`
   - Description: `Google Chrome navegador corporativo`
   - Source folder: `\\SCCM01\Sources$\Software\Chrome\`
3. **Program Type:** Select **Standard program**
4. **Standard Program:**
   - Name: `Install Chrome`
   - Command line: `InstallChrome.cmd`
   - Run: `Hidden`
   - Program can run: `Whether or not a user is logged on`
   - After running: `Configuration Manager restarts computer` (o `No action required`)
   - Return codes: `0` = Success

### 5.3 Distribuir y desplegar el Package

Los pasos son iguales que para Applications: Distribute Content → Deploy.

---

## Parte 6: Monitoreo y Reportes de Deployment

### 6.1 Ver el estado del deployment en la consola

`Monitoring > Deployments`

Selecciona tu deployment. Verás:
- **Success:** Instalado correctamente
- **In Progress:** En proceso de instalación
- **Error:** Falló la instalación
- **Requirements Not Met:** El equipo no cumple los requisitos del DT
- **Unknown:** El cliente no ha reportado aún

### 6.2 Drill-down en errores

Doble clic en un deployment → pestaña **Asset Details** → filtra por `Error` → verás los equipos con error y el código de error.

Clic derecho en un equipo con error → **View Status Messages** para ver el log detallado.

### 6.3 Logs del cliente para diagnóstico

```powershell
# Carpeta de logs del cliente SCCM
$logPath = "C:\Windows\CCM\Logs"

# Los más útiles para deployment de software:
# AppEnforce.log      — instalación/desinstalación de aplicaciones
# AppDiscovery.log    — detección de aplicaciones instaladas
# AppIntentEval.log   — evaluación de si se debe instalar/desinstalar
# CIAgent.log         — descarga de políticas de configuración
# PolicyAgent.log     — recepción de políticas del servidor
# execmgr.log         — ejecución de packages

# Ver errores en AppEnforce
Select-String -Path "$logPath\AppEnforce.log" -Pattern "error|fail|exception" -CaseSensitive:$false | 
    Select-Object -Last 20
```

### 6.4 Forzar ciclos de evaluación manualmente

```powershell
# Trigger cycles via WMI (útil para no esperar el schedule automático)
$triggers = @{
    "Machine Policy Retrieval"          = "{00000000-0000-0000-0000-000000000021}"
    "Machine Policy Evaluation"         = "{00000000-0000-0000-0000-000000000022}"
    "Software Inventory"                = "{00000000-0000-0000-0000-000000000002}"
    "Hardware Inventory"                = "{00000000-0000-0000-0000-000000000001}"
    "Application Deployment Evaluation" = "{00000000-0000-0000-0000-000000000121}"
    "Software Update Scan"              = "{00000000-0000-0000-0000-000000000113}"
    "Software Update Deployment"        = "{00000000-0000-0000-0000-000000000108}"
}

foreach ($trigger in $triggers.GetEnumerator()) {
    Write-Host "Ejecutando: $($trigger.Key)"
    Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client `
        -Name TriggerSchedule -ArgumentList $trigger.Value
}
```

---

## Parte 7: Supersedence (Reemplazar versiones)

**Escenario:** Tienes 7-Zip 22.x instalado y quieres actualizarlo a 23.x automáticamente.

### 7.1 Configurar Supersedence

1. Crea la nueva Application `7-Zip 23.01` (ya la tienes)
2. Abre las propiedades de la Application nueva → pestaña **Supersedence**
3. Clic en **Add**
4. Selecciona la versión anterior: `7-Zip 22.xx`
5. **Deployment type:** selecciona los DTs correspondientes
6. **Uninstall:** marca si quieres que desinstale la versión antigua antes de instalar la nueva

> Con Supersedence, cuando un cliente tiene la versión vieja, SCCM automáticamente la reemplaza con la nueva en el próximo ciclo de evaluación.

---

## Parte 8: Scripts via Configuration Manager (Run Scripts)

SCCM permite ejecutar PowerShell directamente en colecciones de equipos desde la consola.

### 8.1 Habilitar Run Scripts

En `Administration > Site Configuration > Sites > Site Properties > Client Settings`:
- Asegúrate de que **Script Execution** esté habilitado

### 8.2 Crear y ejecutar un script

`Software Library > Scripts`

1. Clic derecho → **Create Script**
2. Script name: `Get-DiskInfo`
3. Script language: `PowerShell`
4. Script:
   ```powershell
   Get-PSDrive -PSProvider FileSystem | 
       Select-Object Name, 
           @{N="Used(GB)";E={[math]::Round(($_.Used/1GB),2)}},
           @{N="Free(GB)";E={[math]::Round(($_.Free/1GB),2)}},
           @{N="Total(GB)";E={[math]::Round(($_.Used+$_.Free)/1GB,2)}} |
       ConvertTo-Json
   ```
5. Clic en **Script Approval** → Approve the script

### 8.3 Ejecutar el script en una collection

1. En `Assets and Compliance > Device Collections`
2. Clic derecho en `DC_All_Windows10_Clients` → **Run Script**
3. Selecciona `Get-DiskInfo` → Run
4. Ver resultados en `Monitoring > Script Status`

---

## Troubleshooting Común

| Problema | Causa probable | Solución |
|---|---|---|
| Content not distributed | DP no tiene el contenido | Distribute Content → verificar `Monitoring > Content Status` |
| Application not detected | Detection Method incorrecto | Verificar Product Code del MSI con `msiinfo.exe` o Orca |
| Deployment stays "In Progress" | Cliente no ha recibido la política | `TriggerSchedule` para Machine Policy |
| Error 0x87D00215 | Content no disponible en ningún DP | Verificar Boundary Groups del cliente |
| Error 0x643 | MSI installation failed | Ver `C:\Windows\CCM\Logs\AppEnforce.log` y el log del MSI en `%TEMP%` |
| Collection vacía | Discovery no ha corrido o collection query incorrecta | Actualizar membership de la collection |
| Software no aparece en Software Center | Cliente no ha bajado la política | Forzar Machine Policy Retrieval |

### Códigos de error frecuentes

| Código | Significado |
|---|---|
| `0x87D00215` | Content unavailable |
| `0x87D01106` | Application requirement not met |
| `0x643` | MSI/script failed |
| `0x80070641` | Invalid command line |
| `3010` | Success, requires reboot |

---

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre un Package y una Application en SCCM?**
> `Application` es el método moderno: tiene Detection Method (verifica si ya está instalado), puede reemplazar versiones anteriores (Supersedence), y puede apuntar a usuarios o equipos. `Package` es el método legacy para scripts y herramientas sin instalador estándar; no detecta si ya está instalado.

**2. ¿Qué es un Detection Method y por qué es crítico?**
> Le indica a SCCM cómo verificar si una aplicación ya está instalada (clave de registro, archivo, versión de MSI). Sin él, SCCM no puede saber si reinstalar o no, causando re-instalaciones innecesarias.

**3. ¿Cuál es la diferencia entre un despliegue Required y uno Available?**
> `Required`: se instala automáticamente en la fecha/hora configurada, sin intervención del usuario. `Available`: aparece en el Software Center para que el usuario lo instale cuando quiera. Para parches de seguridad críticos, siempre Required.

**4. ¿Qué son las Collections y cómo las usas?**
> Son agrupaciones dinámicas o estáticas de dispositivos o usuarios basadas en reglas (query WQL, membresía directa, basada en otras colecciones). Son el target de todos los despliegues. Ejemplo: "All Windows 10 Workstations", "Finance Department Computers".

**5. ¿Cómo diagnosticarías un despliegue de software fallido en SCCM?**
> 1. Revisar el reporte de compliance del despliegue en la consola. 2. En el cliente: revisar `AppEnforce.log`, `AppDiscovery.log`, `CAS.log`, `ContentTransferManager.log`. 3. Verificar que el contenido está distribuido al DP correcto. 4. Revisar que el cliente esté en el Boundary Group correcto.

**6. ¿Qué es el Software Center?**
> La aplicación instalada por el cliente SCCM que permite a los usuarios ver e instalar software Available, ver estado de despliegues Required y reiniciar/actualizar cuando sea necesario. Es la interfaz del usuario final con SCCM.

---

## Próximo Paso

**Lab 07 — SCCM: Patch Management con Software Update Point (SUP)**  
Configurarás WSUS integrado con SCCM, sincronizarás actualizaciones de seguridad, crearás ADRs (Automatic Deployment Rules) para aplicar parches automáticamente, y configurarás Maintenance Windows.
