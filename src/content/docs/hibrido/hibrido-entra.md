---
title: 'Lab Híbrido — Dominio Híbrido con Entra ID (Azure AD)'
description: Integración de Active Directory on-premise con Microsoft Entra ID (Azure AD), Azure AD Connect, Hybrid Join, Entra ID Join, BitLocker y escrow de claves de recuperación.
sidebar:
  label: 'Híbrido: AD + Entra ID'
  badge:
    text: Avanzado
    variant: danger
---

# Lab Híbrido — AD On-Premise + Microsoft Entra ID

**Prerequisito:** Labs 01–04 completados (AD DS funcional). Cuenta de Microsoft Azure (tier gratuito para pruebas).  
**Duración estimada:** 3–4 horas  
**Dificultad:** Avanzado

---

## 🏗️ ¿Qué es un Dominio Híbrido?

Un **dominio híbrido** combina Active Directory on-premise con **Microsoft Entra ID** (anteriormente Azure Active Directory) para gestionar identidades tanto en la red local como en la nube.

```
On-Premise                          Cloud (Azure)
┌────────────────────┐              ┌──────────────────────┐
│  Active Directory  │◀─────────────▶│  Microsoft Entra ID  │
│  corp.local        │  Sync        │  corp.onmicrosoft.com│
│  DC01 (AD DS)      │◀── AAD ─────▶│  (Azure AD tenant)   │
└────────────────────┘  Connect     └──────────────────────┘
        │                                      │
  Equipos Windows                    Microsoft 365, Teams,
  en la red local                    SharePoint, Intune
```

### ¿Por qué implementar un dominio híbrido?

- Permitir que los usuarios se autentiquen en Microsoft 365 con sus credenciales de AD (Single Sign-On)
- Gestionar equipos remotos con Intune además de SCCM
- Co-Management: gestionar equipos con SCCM + Intune simultáneamente
- Conditional Access: exigir MFA o compliance del equipo para acceder a apps en la nube
- Azure SSO para aplicaciones SaaS (Salesforce, ServiceNow, etc.)

---

## 🔄 Microsoft Entra ID (Azure AD) — Conceptos Clave

### Terminología

| Término On-Prem | Equivalente en Entra ID | Notas |
|---|---|---|
| Active Directory | Microsoft Entra ID | Antes llamado Azure Active Directory |
| Domain Controller | Tenant (inquilino) | Un tenant por organización |
| OU (Organizational Unit) | Administrative Units | Similar pero en cloud |
| Group Policy (GPO) | Intune Policies / Conditional Access | GPOs no existen en Entra; se usa Intune |
| Domain Join | Entra ID Join | El equipo se registra en Entra |
| Trust (entre dominios) | B2B / B2C | Colaboración externa |
| ADConnect (sync) | Microsoft Entra Connect | Sincroniza identidades on-prem → cloud |

### Tipos de join de equipos

| Tipo | Descripción | Gestión |
|---|---|---|
| **AD Domain Join** | Solo en on-prem, clásico | GPOs, SCCM |
| **Entra ID Join** | Solo en cloud, sin on-prem | Intune, MDM |
| **Hybrid Azure AD Join** | En ambos (on-prem + cloud) | GPOs + SCCM + Intune (co-management) |
| **Entra Registered** | Personal/BYOD, unión suave | Acceso condicional limitado |

---

## ⚙️ Parte 1: Instalar y Configurar Microsoft Entra Connect

Azure AD Connect / Entra Connect sincroniza los objetos de AD on-prem (usuarios, grupos) hacia Entra ID.

### 1.1 Prerrequisitos

- Un tenant de Azure (crear en `portal.azure.com`)
- Cuenta Global Administrator en Azure
- Cuenta Enterprise Admin en AD on-prem
- .NET Framework 4.6.2+
- TLS 1.2 habilitado

### 1.2 Descargar e instalar

1. Descargar desde: `https://www.microsoft.com/en-us/download/details.aspx?id=47594`
2. Ejecutar `AzureADConnect.msi` en el DC (o en un servidor miembro dedicado en producción)

### 1.3 Configuración del asistente

```
1. Express Settings (para lab) → instala con configuración por defecto
   - Sincroniza todos los usuarios de AD
   - Password Hash Sync habilitado

   ---- O ----

2. Custom Settings (para producción)
   - Elegir atributos a sincronizar
   - Filtrar OUs específicas
   - Federation con ADFS (si se requiere)
```

### 1.4 Verificar la sincronización

```powershell
# En el servidor con Azure AD Connect
# Ver estado del servicio de sync
Get-Service -Name ADSync

# Forzar sincronización manual
Start-ADSyncSyncCycle -PolicyType Delta    # Solo cambios recientes
Start-ADSyncSyncCycle -PolicyType Initial  # Sincronización completa

# Ver errores de sync
Get-ADSyncRunStepResult -StepName "Export" -RunIdentifier (Get-ADSyncRunHistory -NumberRequested 1).RunIdentifier
```

En el portal Azure (portal.azure.com):
- **Entra ID → Users**: deberías ver los usuarios sincronizados con el badge "Synced from on-premises"

---

## 💻 Parte 2: Hybrid Azure AD Join

Con Hybrid Join, los equipos quedan registrados tanto en AD on-prem como en Entra ID, permitiendo acceso a recursos de ambos entornos.

### 2.1 Prerrequisitos para Hybrid Join

- Azure AD Connect configurado y sincronizando
- Dominio verificado en Azure (no `.local` — necesitas un dominio público verificado o UPN alternativo)
- Acceso al servicio `enterpriseregistration` desde los clientes (puede ser vía proxy o directamente)

### 2.2 Configurar Hybrid Join vía Azure AD Connect

En Azure AD Connect (asistente de configuración):
1. `Configure device options`
2. `Configure Hybrid Azure AD join`
3. Seleccionar el dominio de AD
4. El wizard crea el SCP (Service Connection Point) en AD para que los clientes descubran el tenant de Azure

### 2.3 Verificar el Hybrid Join en un cliente

```cmd
:: Verificar el estado de join del equipo
dsregcmd /status

:: Buscar estas líneas:
:: AzureAdJoined : YES    ← registrado en Entra ID
:: DomainJoined  : YES    ← registrado en AD on-prem
```

```powershell
# Ver en Azure Portal
# Entra ID → Devices → All Devices
# El equipo debe aparecer con Join Type = "Hybrid Azure AD joined"
```

---

## 🔐 Parte 3: BitLocker con Escrow de Claves en AD / Entra ID

**BitLocker** cifra el disco completo de los equipos Windows. En entornos empresariales, las claves de recuperación deben almacenarse centralmente para poder recuperar acceso si el usuario olvida el PIN o el TPM falla.

### 3.1 Escrow de claves en Active Directory on-prem

```powershell
# Habilitar BitLocker en el volumen C:
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly -RecoveryPasswordProtector

# Respaldar la clave de recuperación en AD
$BLV = Get-BitLockerVolume -MountPoint "C:"
Backup-BitLockerKeyProtector -MountPoint "C:" -KeyProtectorId $BLV.KeyProtector[0].KeyProtectorId

# Verificar que la clave se guardó en AD
# En el DC: ADUC → equipo → BitLocker Recovery Tab
```

**Via GPO** (recomendado para despliegue masivo):
- `Computer Configuration → Administrative Templates → Windows Components → BitLocker Drive Encryption`
- **"Store BitLocker recovery information in Active Directory Domain Services"** → Habilitado
- **"Require BitLocker backup to AD DS before enabling"** → Habilitado

### 3.2 Escrow de claves en Entra ID (para equipos con Hybrid/Entra Join)

Para equipos unidos a Entra ID, las claves se guardan automáticamente en Azure si está configurado:

**Via Intune / MDM**:
- Endpoint Manager → Devices → Configuration Profiles
- Crear perfil: Windows 10/11 → Endpoint Protection → Windows Encryption
- `Configure BitLocker`: Require, backup to Azure AD: Required

```powershell
# Verificar escrow en Entra desde el equipo
dsregcmd /status | Select-String "KeysToRegister"

# Ver en Azure Portal:
# Entra ID → Devices → <nombre del equipo> → BitLocker Keys
```

### 3.3 Recuperar una clave de BitLocker

**Desde AD on-prem** (ADUC):
1. `dsa.msc` → buscar el equipo → propiedades → pestaña "BitLocker Recovery"
2. Copiar la Recovery Key ID que muestra el equipo al arrancar

```powershell
# PowerShell - buscar clave por ID
Get-ADObject -Filter {objectClass -eq 'msFVE-RecoveryInformation'} -SearchBase "DC=corp,DC=local" -Properties msFVE-RecoveryPassword | Select-Object Name, msFVE-RecoveryPassword
```

**Desde Entra ID / Azure Portal**:
- `portal.azure.com` → Entra ID → Devices → nombre del equipo → BitLocker Keys

---

## ☁️ Parte 4: Conditional Access (Acceso Condicional)

Conditional Access en Entra ID permite crear políticas del tipo: "solo permitir acceso a Microsoft 365 si el equipo está unido a Hybrid AD Y está marcado como compliant por Intune."

### Ejemplo de política de Conditional Access

```
Política: Require Compliant Device for M365
  Asignaciones:
    Usuarios: All Users (excepto admins de emergencia)
    Apps: Office 365
  Condiciones:
    Plataformas: Windows
  Controles de acceso:
    Otorgar: Require device to be marked as compliant
             Require Hybrid Azure AD joined device
             (usar AND u OR según el rigor)
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué es Microsoft Entra ID (Azure AD) y en qué se diferencia de Active Directory on-prem?**
> Entra ID es el servicio de identidad en la nube de Microsoft. A diferencia de AD on-prem (basado en LDAP/Kerberos, en DCs físicos/virtuales, con GPOs y OUs), Entra ID es un servicio PaaS: sin DCs que administrar, usa SAML/OAuth2/OIDC para autenticación, se gestiona con Intune en lugar de GPOs, y está diseñado para apps en la nube y usuarios remotos.

**2. ¿Qué hace Azure AD Connect / Entra Connect?**
> Sincroniza objetos de AD on-prem (usuarios, grupos, equipos) hacia Entra ID, permitiendo Single Sign-On: el usuario usa sus credenciales de AD también para iniciar sesión en Microsoft 365, Teams y otras apps integradas con Entra. Soporta varios métodos de autenticación: Password Hash Sync, Pass-through Authentication, o Federation con ADFS.

**3. ¿Cuál es la diferencia entre Entra ID Join y Hybrid Azure AD Join?**
> Entra ID Join: el equipo solo está en la nube, sin AD on-prem — ideal para equipos remotos o nuevas organizaciones. Hybrid Azure AD Join: el equipo está registrado tanto en AD on-prem como en Entra ID, permitiendo que reciba GPOs de AD Y políticas de Intune simultáneamente. Es el estado de transición para organizaciones que tienen AD y están migrando a la nube.

**4. ¿Qué es BitLocker y cómo gestionas las claves de recuperación en una empresa?**
> BitLocker cifra el disco completo del equipo (AES-256 XTS). Las claves de recuperación se almacenan centralmente: en AD on-prem (objeto msFVE-RecoveryInformation asociado al equipo en ADUC) o en Entra ID (visible desde el portal de Azure). La GPO más importante es "Store BitLocker recovery information in AD before enabling" para asegurar que nunca se active BitLocker sin guardar la clave primero.

**5. ¿Qué es el Conditional Access y un caso de uso real?**
> Conditional Access evalúa señales (usuario, dispositivo, ubicación, app, riesgo) y decide si permite el acceso, pide MFA o bloquea. Caso real: "solo permitir acceso a correo corporativo desde dispositivos gestionados por Intune y marcados como compliant (parches al día, BitLocker activo, antivirus activo) — si el dispositivo no cumple, bloquear acceso aunque las credenciales sean correctas."

**6. ¿Cómo sincronizarías solo algunas OUs de AD hacia Entra ID, no todo el directorio?**
> En Azure AD Connect (modo Custom), durante la configuración de sincronización, puedes seleccionar qué OUs filtrar. Solo las OUs seleccionadas y sus objetos se sincronizarán. Puedes modificarlo después en `Synchronization Service Manager → Connectors → AD Connector → Configure Directory Partitions → Containers`.
