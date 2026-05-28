# Lab 05 — Instalación y Configuración de SCCM/MECM

**Prerequisito:** Lab 02 completado. DC funcional con `corp.local`. Internet o ISOs disponibles.  
**Duración estimada:** 4-6 horas (incluye tiempos de instalación)  
**Dificultad:** Avanzado

---

## Qué es SCCM / MECM

**Microsoft Endpoint Configuration Manager (MECM)**, anteriormente conocido como **System Center Configuration Manager (SCCM)**, es la solución de Microsoft para:
- Desplegar software y actualizaciones de Windows en múltiples equipos
- Inventariar hardware y software
- Desplegar sistemas operativos (OSD)
- Gestionar configuración y compliance
- Integrar con Intune (co-management) en entornos híbridos

---

## Arquitectura del Lab

```
Red interna: 192.168.100.0/24

┌────────────────────────────┐
│  VM 1 — DC                 │
│  Windows Server 2022       │
│  IP: 192.168.100.10        │
│  Roles: AD DS + DNS        │
└────────────┬───────────────┘
             │ corp.local
┌────────────┴───────────────┐
│  VM 2 — SCCM Server        │
│  Windows Server 2022       │
│  IP: 192.168.100.20        │
│  Roles: SCCM + SQL Server  │
│  Nombre: SCCM01            │
│  RAM: 8 GB mínimo          │
│  Disco: 100 GB+            │
└────────────┬───────────────┘
             │
     ┌───────┴────────┐
┌────┴──────┐  ┌──────┴─────┐
│  WKSTN-01 │  │  WKSTN-02  │
│  Win 10/11│  │  Win 10/11 │
└───────────┘  └────────────┘
```

> **Para 4-5 VMs:** SQL Server y SCCM van en la misma VM (SCCM01). Aceptable en labs, no en producción.

### Requisitos del servidor SCCM01

| Componente | Mínimo (lab) | Recomendado (lab) |
|---|---|---|
| RAM | 8 GB | 12-16 GB |
| CPU | 4 vCPU | 4-8 vCPU |
| Disco SO | 80 GB | 100 GB |
| Disco SCCM | 100 GB separado | 150 GB |
| Disco SQL | 50 GB separado | 100 GB |
| SO | Windows Server 2022 | Windows Server 2022 |

---

## Parte 1: Preparar el Servidor SCCM01

### 1.1 Configuración inicial del servidor

**Vía GUI — Cambiar nombre del equipo:**

1. Clic derecho en **Este equipo** → **Properties** (o busca "System" en el Panel de Control)
2. Clic en **Change settings** → pestaña **Computer Name** → **Change**
3. Nombre del equipo: `SCCM01` → OK → reinicia cuando se solicite

**Vía GUI — Configurar IP estática:**

1. Clic derecho en el ícono de red (bandeja del sistema) → **Open Network & Internet settings**
2. Clic en **Change adapter options**
3. Clic derecho en el adaptador de red → **Properties**
4. Doble clic en **Internet Protocol Version 4 (TCP/IPv4)**
5. Selecciona **Use the following IP address**:
   - IP: `192.168.100.20`
   - Mask: `255.255.255.0`
   - Gateway: `192.168.100.1`
   - Preferred DNS: `192.168.100.10` (el DC)
6. OK → OK → cerrar

**Vía GUI — Unirse al dominio:**

1. Clic derecho en **Este equipo** → **Properties** → **Change settings**
2. Pestaña **Computer Name** → **Change**
3. Selecciona **Domain** → escribe `corp.local`
4. Introduce credenciales: `corp\Administrator` y la contraseña del DC
5. Reinicia el servidor

<details>
<summary>⚡ PowerShell — configuración inicial en un solo bloque</summary>

```powershell
# Cambiar nombre (requiere reinicio)
Rename-Computer -NewName "SCCM01" -Restart

# Después del reinicio — IP estática
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress "192.168.100.20" `
    -PrefixLength 24 -DefaultGateway "192.168.100.1"
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "192.168.100.10"

# Unirse al dominio
Add-Computer -DomainName "corp.local" -Credential "corp\Administrator" -Restart
```

</details>

### 1.2 Instalar prerrequisitos de Windows

**Vía GUI — Server Manager:**

1. En Server Manager, clic en **Manage** → **Add Roles and Features**
2. **Installation Type:** Role-based or feature-based → Next
3. Selecciona `SCCM01` como servidor → Next
4. En **Server Roles**: no añadir roles aquí todavía (los agregas en la siguiente pantalla)
5. En **Features** — marca las siguientes características:
   - `.NET Framework 3.5 Features` → `.NET Framework 3.5`
   - `.NET Framework 4.5 Features` → `.NET Framework 4.5`, `ASP.NET 4.5`
   - `Background Intelligent Transfer Service (BITS)`
   - `Remote Differential Compression`
6. En el árbol de **Web Server (IIS)** (dentro de Roles), marca:
   - `Web Server > Common HTTP Features` — todos
   - `Web Server > Application Development` → ASP.NET 3.5, ASP.NET 4.5, ISAPI Extensions, ISAPI Filters
   - `Web Server > Security` → Windows Authentication
   - `Management Tools` → IIS Management Console, IIS Management Scripts and Tools
7. Next → Install → espera que termine → reinicia si se solicita

<details>
<summary>⚡ PowerShell — instalación de todos los prerrequisitos de una vez</summary>

```powershell
Install-WindowsFeature -Name `
    NET-Framework-Core, `
    NET-Framework-45-Core, `
    NET-Framework-45-ASPNET, `
    Web-Server, `
    Web-Mgmt-Console, `
    Web-Asp-Net, `
    Web-Asp-Net45, `
    Web-Net-Ext, `
    Web-Net-Ext45, `
    Web-Scripting-Tools, `
    Web-Windows-Auth, `
    Web-ISAPI-Ext, `
    Web-ISAPI-Filter, `
    BITS, `
    RDC `
    -IncludeManagementTools -Restart
```

</details>

### 1.3 Instalar Windows ADK

El **Windows ADK** es necesario para OSD y Task Sequences. La instalación es siempre via GUI.

Descarga desde Microsoft (busca "Download and install the Windows ADK"):
- **Windows ADK** (para Windows 11 / Server 2022)
- **Windows PE add-on for the ADK**

Ejecuta el instalador del ADK y selecciona:
- Deployment Tools
- Windows Preinstallation Environment (WinPE)
- User State Migration Tool (USMT)

Luego ejecuta el instalador del WinPE add-on y selecciona WinPE.

<details>
<summary>⚡ Línea de comandos — instalación silenciosa del ADK</summary>

```cmd
.\adksetup.exe /quiet /features OptionId.DeploymentTools OptionId.WindowsPreinstallationEnvironment OptionId.UserStateMigrationTool

.\adkwinpesetup.exe /quiet /features OptionId.WindowsPreinstallationEnvironment
```

</details>

---

## Parte 2: Instalar SQL Server

SCCM requiere SQL Server. Para el lab usaremos **SQL Server 2019 Developer Edition** (gratuita).

### 2.1 Preparar la estructura de carpetas para SQL

**Vía GUI — Explorador de archivos:**

1. Abre el Explorador de archivos
2. Ve a la unidad `D:\` (o crea una segunda unidad virtual en Hyper-V/VMware)
3. Crea la carpeta `D:\SQL`
4. Dentro de `D:\SQL`, crea estas subcarpetas: `Data`, `Logs`, `TempDB`, `Backup`

<details>
<summary>⚡ PowerShell — crear la estructura de directorios</summary>

```powershell
foreach ($folder in @("Data","Logs","TempDB","Backup")) {
    New-Item -Path "D:\SQL\$folder" -ItemType Directory -Force
}
```

</details>

### 2.2 Instalar SQL Server 2019

Monta la ISO y ejecuta el instalador — es un asistente GUI:

1. Selecciona **Installation** → **New SQL Server stand-alone installation**
2. **Product Key:** Developer (gratuito)
3. **Feature Selection:**
   - `Database Engine Services` — obligatorio
   - `Reporting Services - Native` — opcional, útil para reportes de SCCM
4. **Instance Configuration:** Default instance (`MSSQLSERVER`)
5. **Service Accounts:**
   - SQL Server: `NT AUTHORITY\SYSTEM` (válido para labs)
   - SQL Server Agent: `NT AUTHORITY\SYSTEM`
6. **Collation:** clic en **Customize** → selecciona `SQL_Latin1_General_CP1_CI_AS`
   > **CRÍTICO — no cambies esta collation.** SCCM la requiere exactamente así.
7. **Data Directories:**
   - User database dir: `D:\SQL\Data`
   - User database log dir: `D:\SQL\Logs`
   - TempDB dir: `D:\SQL\TempDB`
   - Backup dir: `D:\SQL\Backup`
8. **Server Configuration (Admins):** agrega `CORP\Domain Admins`
9. Completa la instalación → reinicia si se solicita

### 2.3 Configurar memoria máxima de SQL

**Vía GUI — SQL Server Management Studio (SSMS):**

1. Abre **SSMS** → conecta a `SCCM01` (Windows Authentication)
2. Clic derecho en el servidor → **Properties** → pestaña **Memory**
3. **Maximum server memory (MB):** establece `8192` (8 GB) si tienes 12 GB de RAM
   → Esto reserva ~4 GB para el SO y otros procesos
4. OK

<details>
<summary>⚡ T-SQL — mismo resultado desde una query</summary>

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'max server memory', 8192;
RECONFIGURE;
EXEC sp_configure 'max server memory';
```

</details>

---

## Parte 3: Preparar Active Directory para SCCM

### 3.1 Extender el schema de AD

> **Este paso es irreversible** y requiere pertenencia al grupo `Schema Admins`. Solo se hace una vez por bosque.

**Paso previo — verificar pertenencia a Schema Admins:**

**Vía GUI — Active Directory Users and Computers:**

1. En el DC, navega a `corp.local > Builtin` (o donde esté el grupo `Schema Admins`)
2. Abre el grupo `Schema Admins` → pestaña **Members** → verifica o agrega el usuario administrador

**Extensión del schema — solo via línea de comandos:**

Desde **SCCM01**, con la ISO de SCCM montada:

```cmd
cd "E:\SMSSETUP\BIN\X64"
extadsch.exe
```

Verifica el resultado:
```powershell
Get-Content "C:\ExtADSch.log" | Select-Object -Last 10
# Debe contener: "Successfully extended the Active Directory schema."
```

### 3.2 Crear el contenedor System Management en AD

**Vía GUI — Active Directory Users and Computers:**

1. En el DC, habilita **View** → **Advanced Features**
2. Expande `corp.local > System`
3. Clic derecho en `System` → **New** → **Other...**
4. Busca y selecciona `Container` → OK
5. Nombre: `System Management` → OK

**Asignar permisos al contenedor:**

1. Clic derecho en `System Management` → **Properties** → pestaña **Security** → **Advanced**
2. Clic en **Add** → **Select a principal** → escribe `SCCM01$` (con el signo dolar, es la cuenta del equipo)
3. Permissions: marca **Full control**
4. Applies to: **This object and all descendant objects**
5. OK → Apply → OK

<details>
<summary>⚡ PowerShell — creación del contenedor y permisos</summary>

```powershell
Import-Module ActiveDirectory

$domainDN = (Get-ADDomain).DistinguishedName
$containerPath = "CN=System,$domainDN"

New-ADObject -Name "System Management" -Type Container `
    -Path $containerPath -ProtectedFromAccidentalDeletion $false

$sccmComputer = Get-ADComputer "SCCM01"
$acl = Get-Acl "AD:\CN=System Management,$containerPath"

$rule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    $sccmComputer.SID,
    [System.DirectoryServices.ActiveDirectoryRights]::GenericAll,
    [System.Security.AccessControl.AccessControlType]::Allow,
    [System.DirectoryServices.ActiveDirectorySecurityInheritance]::All
)

$acl.AddAccessRule($rule)
Set-Acl "AD:\CN=System Management,$containerPath" $acl
Write-Host "Contenedor creado y permisos asignados."
```

</details>

### 3.3 Crear la cuenta de servicio SCCM

**Vía GUI — Active Directory Users and Computers:**

1. Navega a `_Admin > Cuentas de Servicio`
2. Clic derecho → **New** → **User**
3. Nombre: `svc SCCM` / Logon: `svc_SCCM` → Siguiente
4. Contraseña: `SCCMService2024!`
5. Desmarca "User must change password" → marca **Password never expires** → Finish
6. Doble clic en el usuario → **Description**: `Cuenta de servicio para SCCM`
7. Agrega al grupo `Domain Admins` temporalmente:
   - Pestaña **Member Of** → **Add** → `Domain Admins` → OK

<details>
<summary>⚡ PowerShell — crear la cuenta de servicio</summary>

```powershell
$password = ConvertTo-SecureString "SCCMService2024!" -AsPlainText -Force

New-ADUser -Name "svc_SCCM" -SamAccountName "svc_SCCM" `
    -UserPrincipalName "svc_SCCM@corp.local" `
    -Path "OU=Cuentas de Servicio,OU=_Admin,DC=corp,DC=local" `
    -AccountPassword $password -Enabled $true `
    -PasswordNeverExpires $true `
    -Description "Cuenta de servicio para SCCM"

Add-ADGroupMember -Identity "Domain Admins" -Members "svc_SCCM"
```

</details>

### 3.4 Crear registro DNS para SCCM01

**Vía GUI — DNS Manager (`dnsmgmt.msc`):**

1. En el DC, abre **DNS Manager**
2. Expande el servidor → **Forward Lookup Zones** → `corp.local`
3. Clic derecho → **New Host (A or AAAA)**
4. Name: `SCCM01`
5. IP address: `192.168.100.20`
6. Marca **Create associated pointer (PTR) record**
7. **Add Host** → OK

<details>
<summary>⚡ PowerShell — agregar registro DNS</summary>

```powershell
Add-DnsServerResourceRecordA -ZoneName "corp.local" `
    -Name "SCCM01" -IPv4Address "192.168.100.20" -CreatePtr
```

</details>

---

## Parte 4: Instalar SCCM/MECM Current Branch

### 4.1 Descargar SCCM

Descarga la **versión de evaluación de 180 días** desde el Microsoft Evaluation Center:
> Busca `Microsoft Endpoint Configuration Manager Evaluation` en el Evaluation Center de Microsoft.

### 4.2 Verificar conectividad antes de instalar

```powershell
# Ejecutar en SCCM01
Test-NetConnection -ComputerName "192.168.100.10" -Port 389   # LDAP al DC
Test-NetConnection -ComputerName "192.168.100.10" -Port 3268  # Global Catalog
Test-NetConnection -ComputerName "SCCM01" -Port 1433          # SQL local
```

### 4.3 Proceso de instalación

Monta la ISO de SCCM y ejecuta `splash.hta` o `setup.exe`. Todo es GUI:

1. **Install a Configuration Manager primary site**
2. **Product Key:** escribe `Evaluation` o usa tu clave de licencia
3. **Accept the license terms**
4. **Prerequisite Downloads:**
   - Selecciona **Download required files**
   - Carpeta destino: `C:\SCCMPrereqs`
   - El instalador descarga todo automáticamente (requiere internet, puede tardar)
5. **Site and Installation Settings:**
   - Site code: `CRP` (3 letras únicas en tu entorno)
   - Site name: `Corp Primary Site`
   - Carpeta de instalación: `C:\Program Files\Microsoft Configuration Manager`
6. **Primary Site Installation:** Install as a stand-alone site
7. **Database Information:**
   - SQL Server name: `SCCM01`
   - Database name: `CM_CRP`
   - SQL Server Service Broker port: `4022` (default)
8. **SMS Provider:** mantén el default (`SCCM01`)
9. **Client Communication:**
   - Selecciona **HTTP** (para labs sin PKI)
10. **Site System Roles:** marca:
    - **Management point**
    - **Distribution point**
11. **Diagnostics:** a tu elección
12. Revisa el resumen → **Begin Install**

> **La instalación tarda 30-60 minutos.** Puedes ver el progreso en tiempo real en la ventana del instalador.

### 4.4 Verificar la instalación

**Vía GUI:**

1. Abre **Configuration Manager Console** desde el menú inicio
2. En `Monitoring > Site Status` verifica que todos los componentes muestren estado verde

```powershell
# Verificar que los servicios de SCCM están corriendo
Get-Service "SMS_EXECUTIVE","SMS_SITE_COMPONENT_MANAGER","SMS_SITE_VSS_WRITER" |
    Select-Object Name, Status
```

---

## Parte 5: Configuración Post-Instalación

### 5.1 Configurar Boundaries y Boundary Groups

Los **Boundaries** definen qué red pertenece a este sitio SCCM.

**Vía GUI — SCCM Console:**

1. Ve a `Administration > Hierarchy Configuration > Boundaries`
2. Clic derecho → **Create Boundary**:
   - Description: `Red Lab 192.168.100.0/24`
   - Type: **IP address range**
   - From: `192.168.100.1` / To: `192.168.100.254`
   - OK

3. Ve a `Administration > Hierarchy Configuration > Boundary Groups`
4. Clic derecho → **Create Boundary Group**:
   - Name: `BG_LabNetwork`
   - Pestaña **Boundaries**: clic en **Add** → agrega el boundary creado
   - Pestaña **References**: clic en **Add** → selecciona `SCCM01` → marca **Use this site system as a preferred management point** → OK
   - OK

### 5.2 Configurar Discovery Methods

**Vía GUI — SCCM Console:**

`Administration > Hierarchy Configuration > Discovery Methods`

1. Doble clic en **Active Directory System Discovery** → marca **Enable Active Directory System Discovery**
2. Clic en el ícono de estrella (New) para agregar un contenedor:
   - AD Container: selecciona `OU=_Corporativo,DC=corp,DC=local`
   - Recursive: marcado
3. En **Schedule**: clic en **New Schedule** → Recur every `1 Hours`
4. OK

5. Doble clic en **Active Directory User Discovery** → Enable → misma configuración de contenedor

### 5.3 Instalar el cliente SCCM en los equipos

**Método 1 — Client Push desde la consola (recomendado para el lab):**

1. Ve a `Administration > Site Configuration > Sites`
2. Clic derecho en `CRP - Corp Primary Site` → **Client Installation Settings** → **Client Push Installation**
3. Pestaña **General**: marca **Enable automatic site-wide client push installation**
4. Pestaña **Accounts**: agrega `corp\svc_SCCM`
5. OK

**Método 2 — Manual en el cliente:**

En el cliente como administrador:
```powershell
Start-Process "\\SCCM01\SMS_CRP\Client\ccmsetup.exe" -ArgumentList "/MP:SCCM01 SMSSITECODE=CRP"
Get-Service -Name "CcmExec"  # verifica cuando termine la instalación
```

**Método 3 — GPO de startup script:**

1. Crea un GPO en `_Corporativo` → nombre: `CORP - Instalar SCCM Client`
2. Ve a:
   ```
   Computer Configuration > Policies > Windows Settings > Scripts > Startup
   ```
3. Add Script: `\\SCCM01\SMS_CRP\Client\ccmsetup.exe`
4. Parameters: `/MP:SCCM01 SMSSITECODE=CRP /logon`

### 5.4 Verificar clientes registrados

**Vía GUI — SCCM Console:**

`Assets and Compliance > Devices`

Los clientes pueden tardar hasta 30 minutos en aparecer.

```powershell
# En el cliente — ver logs si no aparece
Get-Content "C:\Windows\CCMSetup\Logs\ccmsetup.log" -Tail 30
Get-Content "C:\Windows\CCM\Logs\CcmExec.log" -Tail 30
```

---

## Parte 6: Configurar el Distribution Point

### 6.1 Verificar el DP

**Vía GUI — SCCM Console:**

`Administration > Site Configuration > Servers and Site System Roles`

Selecciona `SCCM01` — en la lista inferior debe aparecer el rol **Distribution point**. Si no, clic derecho en el servidor → **Add Site System Roles** → marca **Distribution point**.

### 6.2 Configurar Network Access Account

Esta cuenta se usa cuando los clientes necesitan descargar contenido del DP sin credenciales de dominio:

**Vía GUI — SCCM Console:**

1. Ve a `Administration > Site Configuration > Sites`
2. Clic derecho en tu sitio → **Properties** → pestaña **Client Computer Communication**
3. En **Network Access Account**: clic en **Set** → agrega `corp\svc_SCCM`
4. Apply → OK

---

## Troubleshooting de Instalación

| Problema | Causa probable | Solución |
|---|---|---|
| "Schema not extended" | extadsch.exe falló | Verificar `C:\ExtADSch.log` y que el usuario sea Schema Admin |
| SQL connection fails | TCP/IP no habilitado en SQL | Abrir **SQL Server Configuration Manager** → Protocols for MSSQLSERVER → habilitar TCP/IP |
| "Unable to connect to SQL" | Firewall bloqueando puerto 1433 | Crear regla en Windows Firewall para puerto 1433 entrante |
| Clientes no aparecen en SCCM | Boundary no configurado | Verificar que la IP del cliente esté dentro del Boundary |
| Client push falla | Firewall en el cliente | Habilitar `File and Printer Sharing` y `WMI` en el firewall del cliente |
| SCCM console no abre | SMS Provider no inició | Verificar servicios y `...\Logs\SMSProv.log` |

### Logs importantes de SCCM

| Log | Ubicación | Qué muestra |
|---|---|---|
| `ConfigMgrSetup.log` | `C:\` | Log completo de instalación del sitio |
| `SMSProv.log` | `...\Logs\` | Actividad del SMS Provider |
| `sitestat.log` | `...\Logs\` | Estado de los componentes del sitio |
| `ccmsetup.log` | `C:\Windows\ccmsetup\Logs\` | Instalación del cliente |
| `CcmExec.log` | `C:\Windows\CCM\Logs\` | Actividad del agente cliente |

---

## Próximo Paso

**Lab 06 — SCCM: Despliegue de Software**  
Aprenderás a crear aplicaciones y paquetes, configurar detection methods, desplegar software de forma requerida y disponible, y verificar el cumplimiento.
