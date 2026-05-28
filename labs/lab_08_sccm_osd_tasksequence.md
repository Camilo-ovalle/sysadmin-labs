# Lab 08 — SCCM: OSD y Task Sequences

**Prerequisito:** Labs 05-07 completados. SCCM con Distribution Point funcional y clientes registrados.  
**Duración estimada:** 6-8 horas (incluye captura de imagen)  
**Dificultad:** Experto

---

## Objetivos del Laboratorio

- Configurar **PXE Boot** para instalar Windows desde la red sin medios físicos
- Crear **Boot Images** (WinPE) personalizadas
- Capturar una imagen de referencia de Windows
- Crear un **OS Image** para despliegue
- Construir una **Task Sequence** completa para bare-metal deployment
- Entender el flujo OSD completo: arranque PXE → WinPE → instalación → configuración
- Crear una Task Sequence de **OS Refresh** (reinstalar Windows manteniendo datos)

---

## Conceptos Clave de OSD

### Componentes del OSD

| Componente | Descripción |
|---|---|
| **Boot Image** | Imagen de WinPE que arranca el equipo desde la red. Contiene el agente SCCM para comunicarse con el servidor. |
| **OS Image** | El archivo WIM de Windows capturado de una máquina de referencia o el WIM estándar de Microsoft. |
| **Task Sequence** | Secuencia de pasos automatizados: formatear disco, instalar OS, aplicar drivers, instalar software, unir al dominio, etc. |
| **PXE** | Permite que un equipo sin SO arranque desde la red y reciba la Boot Image de SCCM. |
| **Deployment Package** | Contiene los archivos de drivers, scripts y herramientas adicionales que usa la TS. |

### Tipos de Task Sequences

| Tipo | Caso de uso |
|---|---|
| **Bare Metal** | Equipo nuevo o sin OS. Se formatea y se instala Windows desde cero. |
| **OS Refresh** | Reinstala Windows en un equipo existente, manteniendo datos del usuario (USMT). |
| **OS Upgrade** | Upgrade in-place (ej: Win 10 → Win 11) sin reinstalar. |
| **Capture** | Captura la imagen de un equipo de referencia para usarla en otros deployments. |

---

## Arquitectura del OSD

```
┌─────────────────┐    PXE Request     ┌──────────────────────┐
│  Equipo Nuevo   │ ─────────────────► │  SCCM01              │
│  Sin OS         │                    │  (PXE + WDS + SCCM)  │
│                 │ ◄───────────────── │                      │
│  Arranca WinPE  │    Boot Image      │  Distribution Point  │
└─────────────────┘                    └──────────────────────┘
         │
         │ (WinPE carga, agente SCCM se conecta)
         ▼
┌─────────────────┐
│  Task Sequence  │
│  1. Formatear   │
│  2. Instalar OS │
│  3. Drivers     │
│  4. Software    │
│  5. Join Domain │
│  6. Reboot      │
└─────────────────┘
```

---

## Parte 1: Configurar el Distribution Point para PXE

### 1.1 Habilitar PXE en el Distribution Point

En la consola: `Administration > Site Configuration > Servers and Site System Roles`

1. Selecciona `SCCM01`
2. Clic derecho en el rol **Distribution Point** → **Properties**
3. Pestaña **PXE:**
   - Enable PXE support for clients: **Yes**
   - Allow this distribution point to respond to incoming PXE requests: **Yes**
   - Enable unknown computer support: **Yes** (permite equipos que no están en AD)
   - Require a password when computers use PXE: **Yes** → establece una contraseña segura
   - Respond to PXE requests on specific network interfaces: configura según tu red

> Al habilitar PXE, SCCM instala automáticamente **WDS (Windows Deployment Services)** si no está instalado.

```powershell
# Verificar que WDS se instaló correctamente
Get-WindowsFeature -Name WDS | Select-Object Name, InstallState
Get-Service -Name WDSServer | Select-Object Name, Status
```

### 1.2 Agregar Boot Images al DP

Las Boot Images ya existen en SCCM por defecto (se crean durante la instalación). Necesitas distribuirlas al DP:

`Software Library > Operating Systems > Boot Images`

1. Selecciona `Boot image (x64)` (usa 64-bit para sistemas modernos)
2. Clic derecho → **Distribute Content** → selecciona `SCCM01`
3. Espera a que el estado sea **Success** en `Monitoring > Content Status`

---

## Parte 2: Preparar la Boot Image (WinPE)

### 2.1 Personalizar la Boot Image

`Software Library > Operating Systems > Boot Images`

1. Clic derecho en `Boot image (x64)` → **Properties**
2. Pestaña **Drivers:**
   - Agrega drivers de red si tus VMs no son detectadas automáticamente
   - Para VMs de Hyper-V o VMware, generalmente no necesitas drivers adicionales
3. Pestaña **Customization:**
   - Enable command support (F8): **Yes** (muy útil para debugging en el lab)
   - Set the background image: puedes poner un logo corporativo
4. Pestaña **Optional Components:**
   - Agrega: `.NET (WinPE-NetFx)`, `PowerShell (WinPE-PowerShell)` si los vas a usar en la TS
5. Tras modificar → clic en **Update Distribution Points**

> **Habilitar F8 Command Support en el lab:** Cuando el equipo esté en WinPE durante el OSD, podrás abrir un CMD para diagnosticar problemas. **No habilites esto en producción.**

---

## Parte 3: Crear la Máquina de Referencia y Capturar la Imagen

### 3.1 Crear la máquina de referencia

Crea una nueva VM limpia (sin unir al dominio) con:
- Windows 10/11 Pro o Enterprise
- RAM: 2 GB, Disco: 40 GB
- Sin unir al dominio
- Nombre sugerido: `REF-WIN10`

### 3.2 Configurar Windows en la máquina de referencia

En la VM de referencia, instala y configura:

```powershell
# Instalar software corporativo base
# (Ejecutar instaladores de forma silenciosa)

# Configuraciones de Windows
# Deshabilitar aplicaciones preinstaladas innecesarias
Get-AppxPackage -AllUsers | Where-Object {
    $_.Name -like "*xbox*" -or 
    $_.Name -like "*solitaire*" -or 
    $_.Name -like "*zune*"
} | Remove-AppxPackage -AllUsers

# Configurar zona horaria
Set-TimeZone -Name "Romance Standard Time"

# Habilitar actualizaciones (para que estén al día antes de capturar)
Install-Module PSWindowsUpdate -Force
Get-WindowsUpdate -Install -AcceptAll -AutoReboot
```

> **Consejo profesional:** Antes de capturar, aplica todas las actualizaciones de Windows en la imagen de referencia. Así reduces el tiempo que tardan los deployments en parcharse después de instalar.

### 3.3 Preparar la imagen de referencia para captura (Sysprep)

Antes de capturar, debes ejecutar **Sysprep** para generalizar la imagen (eliminar el SID único y la información específica del equipo).

```cmd
# En la máquina de referencia (ejecutar como administrador)
cd C:\Windows\System32\Sysprep
sysprep.exe /generalize /oobe /shutdown
```

> **CRÍTICO:** Después de Sysprep, el equipo se apaga. **NO lo vuelvas a iniciar**. Si arranca, Sysprep habrá completado el proceso y no podrás capturar correctamente. La próxima vez que arranque debe ser desde WinPE para la captura.

### 3.4 Crear la Task Sequence de captura

`Software Library > Operating Systems > Task Sequences`

1. Clic derecho → **Create Task Sequence**
2. Selecciona: **Build and capture a reference operating system image**
3. **Task Sequence information:**
   - Name: `TS_Capture_Win10_Ref`
   - Boot image: `Boot image (x64)`
4. **Install Windows:**
   - Image package: el ISO/WIM de Windows (o la imagen de instalación)
   - Image index: Enterprise (o la edición que tengas)
   - Product key: (si aplica)
5. **Configure Network:**
   - Join a domain: No (la máquina de referencia no va al dominio)
   - Workgroup: WORKGROUP
6. **Install Configuration Manager Client:**
   - Deja los defaults
7. **Include Updates:**
   - Required updates only (o All software updates)
8. **Install Applications:**
   - Agrega las apps que quieres en la imagen base
9. **System Preparation:**
   - Image destination: `\\SCCM01\Sources$\CapturedImages\Win10_Ref.wim`

> Si ya tienes la imagen capturada manualmente con Sysprep, puedes saltarte la TS de captura e importar el WIM directamente.

### 3.5 Importar el WIM capturado como OS Image

Si capturaste el WIM manualmente o mediante la TS:

`Software Library > Operating Systems > Operating System Images`

1. Clic derecho → **Add Operating System Image**
2. Data source: `\\SCCM01\Sources$\CapturedImages\Win10_Ref.wim`
3. Name: `Win10 Enterprise 22H2 - Imagen Corporativa`
4. Version: `22H2`
5. Comment: `Imagen de referencia con software base. Capturada MM/YYYY`

Distribuir al DP:
1. Clic derecho → **Distribute Content** → selecciona `SCCM01`

---

## Parte 4: Crear la Task Sequence de Bare Metal Deployment

Esta es la Task Sequence principal que se ejecuta cuando un equipo arranca via PXE.

### 4.1 Crear la Task Sequence

`Software Library > Operating Systems > Task Sequences`

1. Clic derecho → **Create Task Sequence**
2. Selecciona: **Install an existing image package**
3. **Task Sequence information:**
   - Name: `TS_Deploy_Win10_BareMetal`
   - Boot image: `Boot image (x64)`
4. **Install Windows:**
   - Image package: `Win10 Enterprise 22H2 - Imagen Corporativa`
   - Image index: `1`
   - Partition and format the target computer: **Yes**
   - Configure Target Disk: BIOS (o UEFI según tus equipos)
5. **Configure the Network:**
   - Join a domain: **Yes**
   - Domain: `corp.local`
   - Domain OU: `OU=Computadoras,OU=IT,OU=_Corporativo,DC=corp,DC=local`
   - Account: `corp\svc_SCCM` (con permisos de Join Computer)
6. **Install the Configuration Manager Client:**
   - Software update point: `SCCM01:8530`
7. **Install Updates:**
   - All software updates
8. **Install Applications:**
   - Agrega las aplicaciones base (7-Zip, etc.)

### 4.2 Personalizar la Task Sequence manualmente

Después de crearla, abre el editor de la TS para personalizarla:

Clic derecho en la TS → **Edit**

La TS tiene varios grupos de pasos. Añade o modifica:

**Grupo: Pre-Installation**

Agrega un paso de tipo **Set Task Sequence Variable** al inicio:
- Variable: `OSDComputerName`
- Value: `%_SMSTSMachineName%`

**Grupo: Partition Disk**

Verifica que la partición esté correcta para UEFI:
- Paso `Format and Partition Disk` debe tener:
  - Disk type: GPT (para UEFI) o MBR (para BIOS legacy)
  - Partición EFI: FAT32, 499 MB
  - Partición MSR: 128 MB
  - Partición OS: NTFS, resto del disco
  - Partición Recovery: NTFS, 984 MB

**Después del Install OS — Agregar paso personalizado:**

Clic en **Add > General > Run Command Line**:
- Name: `Deshabilitar SMBv1`
- Command line: `powershell.exe -Command "Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force"`
- Run this step as the following account: usa SYSTEM

**Grupo: Setup Windows and ConfigMgr**

Asegúrate de que el paso **Apply Windows Settings** tiene:
- Time zone: `Romance Standard Time`
- Registered organization: `Corp SA`

**Grupo: Post-Installation — Agregar pasos:**

```
Add > General > Run PowerShell Script
Name: Configurar hostname desde variable
Script: 
    $newName = $env:OSDComputerName
    if ($newName -and $newName -ne $env:COMPUTERNAME) {
        Rename-Computer -NewName $newName -Force
    }
```

### 4.3 Desplegar la Task Sequence

1. Clic derecho en la TS → **Deploy**
2. **General:**
   - Collection: crea una colección especial para OSD:
     `DC_OSD_Unknown_Computers` — colección con `All Unknown Computers` como miembro
3. **Deployment Settings:**
   - Purpose: **Required**
   - Make available to: **Only media and PXE**
4. **Scheduling:**
   - Make this task sequence available: `As soon as possible`
   - No installation deadline (OSD se lanza manualmente via PXE boot)
5. **User Experience:**
   - Allow user to run the program independently of assignments: **No** (solo admins)
   - Show Task Sequence progress: **Yes** (útil para ver el progreso en el lab)
6. **Distribution Points:**
   - When no local distribution point is available: Download content from a remote distribution point

---

## Parte 5: Ejecutar el Deployment Bare Metal

### 5.1 Preparar el equipo cliente para PXE

1. Crea una nueva VM sin SO instalado (o usa una existente que quieras reinstalar)
2. En la configuración de red de la VM:
   - Asegúrate de que esté en la misma red que SCCM01 (192.168.100.0/24)
3. En la BIOS/UEFI de la VM:
   - Habilita **PXE Boot** / **Network Boot**
   - Coloca la red como primer dispositivo de arranque

### 5.2 Proceso de boot PXE

1. Inicia la VM → verás un mensaje como: `Press F12 for network service boot`
2. Presiona F12 → el equipo obtiene IP por DHCP y descarga la Boot Image de SCCM
3. WinPE carga → aparece el Wizard de SCCM (Task Sequence Wizard)
4. Si configuraste contraseña de PXE, la pedirá aquí
5. Selecciona la TS `TS_Deploy_Win10_BareMetal` → Next
6. El proceso tarda 30-60 minutos dependiendo del hardware

### 5.3 Pre-staging el equipo en AD (opcional pero recomendado)

Si quieres que el equipo tenga un nombre específico desde el inicio, créalo en AD antes del despliegue.

**Vía GUI — Active Directory Users and Computers:**

1. Navega a `_Corporativo > IT > Computadoras`
2. Clic derecho → **New** → **Computer**
3. Computer name: `WKSTN-003` → Next → Finish

**Pre-staging en SCCM — Vía GUI (SCCM Console):**

`Assets and Compliance > All Systems`
1. Clic derecho → **Import Computer Information**
2. En el asistente: agrega la **MAC Address** del equipo o su **SMBIOS GUID**
3. Asigna el nombre: `WKSTN-003`
4. Asigna la colección: `DC_OSD_Unknown_Computers`
5. Completa el asistente

<details>
<summary>⚡ PowerShell — crear objeto equipo en AD</summary>

```powershell
New-ADComputer -Name "WKSTN-003" `
    -SAMAccountName "WKSTN-003$" `
    -Path "OU=Computadoras,OU=IT,OU=_Corporativo,DC=corp,DC=local" `
    -Enabled $true
```

</details>

---

## Parte 6: Task Sequence de OS Refresh

El **OS Refresh** reinstala Windows en un equipo existente, capturando y restaurando los datos del usuario con USMT.

### 6.1 Configurar USMT

**USMT (User State Migration Tool)** captura el perfil del usuario, documentos, favoritos y configuraciones.

**Vía GUI — Explorador de archivos + Server Manager (en SCCM01):**

1. En el Explorador de archivos, ve a `D:\` → crea la carpeta `USMT_Store`
2. En **Server Manager** → **File and Storage Services** → **Shares** → **Tasks** → **New Share**
3. **SMB Share – Quick** → selecciona `D:` → Next
4. Share name: `USMT$` (oculto)
5. Permissions → **Customize**:
   - `CORP\svc_SCCM` → **Full Control**
   - `CORP\Domain Admins` → **Full Control**
   - `CORP\Domain Computers` → **Change** (necesitan leer y escribir)
6. **Create**

<details>
<summary>⚡ PowerShell — crear carpeta y share USMT</summary>

```powershell
New-Item -Path "D:\USMT_Store" -ItemType Directory -Force
New-SmbShare -Name "USMT$" -Path "D:\USMT_Store" `
    -FullAccess "CORP\svc_SCCM","CORP\Domain Admins" `
    -ChangeAccess "CORP\Domain Computers"
```

</details>

### 6.2 Crear la Task Sequence de Refresh

1. Clic derecho → **Create Task Sequence**
2. Selecciona: **Install an existing image package** (mismo que bare metal)
3. Nombre: `TS_Refresh_Win10`

Edita la TS y agrega estos pasos **antes** del grupo "Partition Disk":

**Grupo: Capture User State**
1. `Add > User State > Request State Store`
   - Type: Capture state from the computer
   - State storage location: `\\SCCM01\USMT$\%_SMSTSMachineName%`
   - Fallback to capturing locally if State Migration Point is not available
2. `Add > User State > Capture User State`
   - USMT Package: selecciona el paquete de USMT
   - Save user settings and files locally: No (usar el share)

**Después de la instalación de Windows, agrega:**

**Grupo: Restore User State**
1. `Add > User State > Request State Store`
   - Type: Restore state to computer
2. `Add > User State > Restore User State`
   - USMT Package: mismo paquete
3. `Add > User State > Release State Store`

---

## Parte 7: Driver Management

Los drivers son críticos para OSD. Sin el driver de red correcto, WinPE no puede comunicarse con SCCM.

### 7.1 Importar drivers

`Software Library > Operating Systems > Drivers`

1. Descarga los drivers para tu hardware de prueba (o de la VM — Hyper-V, VMware)
2. Clic derecho → **Import**
3. Source folder: carpeta con los archivos .INF de los drivers
4. SCCM importa automáticamente todos los drivers encontrados

### 7.2 Crear Driver Packages

Los drivers importados deben empaquetarse para distribuirse:

1. Selecciona todos los drivers para un modelo de equipo específico
2. Clic derecho → **Create Driver Package**
3. Name: `Drivers - VMware Workstation`
4. Source path: `D:\Sources\Drivers\VMware`

### 7.3 Agregar aplicación de drivers a la Task Sequence

En el editor de la TS, después de `Apply Operating System`:

`Add > Drivers > Apply Driver Package`
- Driver package: `Drivers - VMware Workstation`
- Select the mass storage driver to install: (si aplica)

---

## Parte 8: Diagnóstico de OSD

### 8.1 Ver logs durante el proceso

Con F8 habilitado en WinPE, abre CMD durante el OSD y ejecuta:

```cmd
# Ver el log principal de la Task Sequence (en tiempo real)
notepad X:\Windows\Temp\SMSTSLog\smsts.log

# O desde un cliente Windows durante el OSD
notepad C:\Windows\CCM\Logs\smsts.log
```

### 8.2 Logs importantes de OSD

```powershell
# Después del deployment, en el equipo recién instalado
$logPath = "C:\Windows\CCM\Logs"

# smsts.log — log principal de la Task Sequence
# SMSTS_BareMetal.log — log en la fase de WinPE (antes de que se instale Windows)
# Setupact.log — log de instalación de Windows
# setuperr.log — errores de instalación de Windows
```

### 8.3 Desde el servidor SCCM

```powershell
# Ver estado de deployments de TS
# Monitoring > Deployments → filtra por Task Sequence

# Logs del servidor relevantes
Get-Content "C:\Program Files\Microsoft Configuration Manager\Logs\distmgr.log" -Tail 30
Get-Content "C:\Program Files\Microsoft Configuration Manager\Logs\pxecontrol.log" -Tail 30
```

---

## Troubleshooting Común de OSD

| Problema | Causa probable | Solución |
|---|---|---|
| PXE boot no arranca | WDS no está corriendo | `Start-Service WDSServer` |
| PXE boot no arranca | Equipo no en el mismo broadcast domain | Verificar que la VM está en la red correcta |
| WinPE carga pero no ve la TS | Boundary no configurado para el equipo | Verificar IP del equipo y Boundary Groups |
| "Failed to run task sequence" | Contenido no distribuido | Verificar `Monitoring > Content Status` para la TS y sus dependencias |
| Error en "Apply OS Image" | WIM corrupto o path incorrecto | Verificar el WIM con `dism /get-wiminfo /wimfile:path.wim` |
| No se une al dominio | Cuenta sin permisos o DC no accesible | Verificar conectividad del cliente con DC durante la TS |
| USMT falla | Share inaccesible o permisos incorrectos | Verificar permisos de `\\SCCM01\USMT$` |
| TS se queda colgada | Un paso específico está fallando | Abrir `smsts.log` para ver el último paso exitoso |

---

## Resumen del Flujo Completo de OSD

```
1. Equipo arranca via PXE
   └─ DHCP asigna IP
   └─ WDS/SCCM entrega Boot Image

2. WinPE carga
   └─ Agente SCCM en WinPE se contacta con el Management Point
   └─ Descarga la política de la TS

3. Task Sequence inicia
   ├─ Capture User State (si es Refresh)
   ├─ Particionar y formatear disco
   ├─ Apply OS Image (extrae el WIM)
   ├─ Apply Windows Settings (hostname, zona horaria)
   ├─ Apply Network Settings
   ├─ Apply Drivers
   ├─ Setup Windows and ConfigMgr (primer reinicio en el nuevo OS)
   ├─ Instalar actualizaciones de Windows
   ├─ Instalar aplicaciones base
   ├─ Unirse al dominio
   ├─ Restore User State (si es Refresh)
   └─ Reboot final

4. Equipo listo y unido al dominio
   └─ Aparece en SCCM como cliente registrado
   └─ Recibe GPOs de Active Directory
   └─ Comienza a recibir actualizaciones y software según colección
```

---

## Siguientes Pasos Sugeridos

Con todos estos labs completados tienes un entorno sólido de SysAdmin. Para continuar:

| Tema | Herramienta | Descripción |
|---|---|---|
| **Co-Management** | SCCM + Intune | Gestionar equipos con ambas herramientas simultáneamente |
| **Azure AD Join** | Azure AD | Unir equipos a Azure AD para escenarios híbridos |
| **SCCM Reporting** | SQL Reporting Services | Crear reportes personalizados de compliance y activos |
| **Backup del DC** | Windows Server Backup | Procedimientos de backup y recuperación de AD |
| **DHCP Failover** | Windows Server | Alta disponibilidad para el servicio DHCP |
| **DFS Namespaces** | Windows Server | Espacio de nombres distribuido para recursos compartidos |
| **Certificate Services** | AD CS | PKI interna para HTTPS en SCCM y otros servicios |
