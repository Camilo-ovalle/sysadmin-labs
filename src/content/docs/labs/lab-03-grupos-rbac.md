---
title: "Lab 03 — Grupos AD y RBAC"
description: Tipos y alcances de grupos en Active Directory, estrategia AGDLP, carpetas compartidas, delegación de control y Role-Based Access Control.
sidebar:
  label: "Lab 03: Grupos y RBAC"
  badge:
    text: Intermedio
    variant: caution
---

# Lab 03 — Grupos de AD y Control de Acceso Basado en Roles (RBAC)

**Prerequisito:** Lab 02 completado (OUs creadas, usuarios de prueba en sus OUs).  
**Duración estimada:** 2-3 horas  
**Dificultad:** Intermedio

---

## Objetivos del Laboratorio

- Entender los tipos y alcances de grupos en Active Directory
- Implementar la estrategia **AGDLP** (Account → Global Group → Domain Local Group → Permission)
- Crear grupos departamentales con estructura profesional
- Crear carpetas compartidas y asignar permisos correctamente
- Delegar control en OUs para que admins de departamento gestionen sus propios usuarios
- Implementar Role-Based Access Control (RBAC) con grupos de rol

---

## Conceptos Clave Antes de Empezar

### Tipos de grupos

| Tipo | Uso |
|---|---|
| **Security Group** | Para asignar permisos a recursos. Es el tipo que más usarás. |
| **Distribution Group** | Solo para listas de distribución de correo (Exchange). No da acceso a recursos. |

### Alcances de grupos (Group Scope)

| Alcance | Puede contener | Puede usarse en permisos de |
|---|---|---|
| **Domain Local** | Usuarios, grupos globales y universales de cualquier dominio | Solo el dominio donde reside |
| **Global** | Usuarios y grupos globales del mismo dominio | Cualquier dominio del bosque |
| **Universal** | Usuarios y grupos de cualquier dominio | Cualquier dominio del bosque |

### La estrategia AGDLP

```
A → G → DL → P

Account (usuario)
  ↓ es miembro de
Global Group (agrupa usuarios por función/departamento)
  ↓ es miembro de
Domain Local Group (agrupa acceso a un recurso)
  ↓ recibe
Permission (permiso sobre una carpeta, impresora, etc.)
```

**¿Por qué este orden?**
- Los **Global Groups** son portables entre dominios
- Los **Domain Local Groups** son los que reciben permisos directamente sobre los recursos
- Así puedes añadir acceso desde un nuevo dominio solo cambiando la membresía del Domain Local Group

---

## Parte 1: Crear la Estructura de Grupos

### 1.1 Crear las OUs para organizar los grupos

**Vía GUI — Active Directory Users and Computers (`dsa.msc`):**

1. Clic derecho sobre la OU `_Admin` → **New** → **Organizational Unit**
2. Nombre: `Grupos` → OK
3. Dentro de `Grupos`, crea tres sub-OUs:
   - `GG_Departamentos` (para grupos globales de departamento)
   - `GG_Roles` (para grupos globales de rol)
   - `DL_Recursos` (para grupos Domain Local de acceso a recursos)

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$ouBase = "OU=_Admin,DC=corp,DC=local"
New-ADOrganizationalUnit -Name "Grupos" -Path $ouBase -ProtectedFromAccidentalDeletion $true

$gruposPath = "OU=Grupos,OU=_Admin,DC=corp,DC=local"
New-ADOrganizationalUnit -Name "GG_Departamentos" -Path $gruposPath
New-ADOrganizationalUnit -Name "GG_Roles" -Path $gruposPath
New-ADOrganizationalUnit -Name "DL_Recursos" -Path $gruposPath
```

</details>

### 1.2 Crear los Grupos Globales de Departamento

**Vía GUI — Active Directory Users and Computers:**

1. Expande `_Admin > Grupos > GG_Departamentos`
2. Clic derecho → **New** → **Group**
3. Crea los siguientes grupos (repite para cada uno):

| Group name | Group scope | Group type | Description |
|---|---|---|---|
| `GG_IT` | Global | Security | Todos los usuarios del departamento IT |
| `GG_RRHH` | Global | Security | Todos los usuarios de RRHH |
| `GG_Contabilidad` | Global | Security | Todos los usuarios de Contabilidad |
| `GG_Gerencia` | Global | Security | Directivos y gerentes |

Para cada grupo: en el campo **Description** (pestaña General de las propiedades) escribe la descripción correspondiente.

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$ggPath = "OU=GG_Departamentos,OU=Grupos,OU=_Admin,DC=corp,DC=local"

New-ADGroup -Name "GG_IT" -SamAccountName "GG_IT" `
    -GroupScope Global -GroupCategory Security -Path $ggPath `
    -Description "Todos los usuarios del departamento IT"

New-ADGroup -Name "GG_RRHH" -SamAccountName "GG_RRHH" `
    -GroupScope Global -GroupCategory Security -Path $ggPath `
    -Description "Todos los usuarios de RRHH"

New-ADGroup -Name "GG_Contabilidad" -SamAccountName "GG_Contabilidad" `
    -GroupScope Global -GroupCategory Security -Path $ggPath `
    -Description "Todos los usuarios de Contabilidad"

New-ADGroup -Name "GG_Gerencia" -SamAccountName "GG_Gerencia" `
    -GroupScope Global -GroupCategory Security -Path $ggPath `
    -Description "Directivos y gerentes"
```

</details>

### 1.3 Agregar usuarios a sus grupos globales

**Vía GUI — Active Directory Users and Computers:**

1. Doble clic en el grupo `GG_IT` → pestaña **Members** → **Add**
2. Escribe `jtecnico` → **Check Names** → OK → Apply
3. Repite para:
   - `GG_RRHH` → agrega `mrrhh`
   - `GG_Contabilidad` → agrega `pcontador`

> **Alternativa:** Doble clic en el **usuario** → pestaña **Member Of** → **Add** → busca el grupo.

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
Add-ADGroupMember -Identity "GG_IT" -Members "jtecnico"
Add-ADGroupMember -Identity "GG_RRHH" -Members "mrrhh"
Add-ADGroupMember -Identity "GG_Contabilidad" -Members "pcontador"
```

</details>

### 1.4 Crear Grupos de Rol (Global Groups)

Los grupos de rol definen **qué puede hacer** un usuario, independientemente de su departamento.

**Vía GUI — dentro de `_Admin > Grupos > GG_Roles`:**

Crea los siguientes grupos con scope **Global** y tipo **Security**:

| Group name | Description |
|---|---|
| `GG_ROL_Admins_Help_Desk` | Personal de soporte nivel 1 |
| `GG_ROL_Admins_Sistemas` | Administradores de sistemas con acceso completo |
| `GG_ROL_Lectura_RRHH` | Acceso de solo lectura a recursos de RRHH |
| `GG_ROL_HelpDesk_L1` | Help Desk Nivel 1 - reset passwords, unlock accounts |
| `GG_ROL_HelpDesk_L2` | Help Desk Nivel 2 - gestión de usuarios y equipos |
| `GG_ROL_SysAdmin` | Administradores de sistemas |

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$roleePath = "OU=GG_Roles,OU=Grupos,OU=_Admin,DC=corp,DC=local"

$roles = @(
    @{Name="GG_ROL_Admins_Help_Desk"; Desc="Personal de soporte nivel 1"},
    @{Name="GG_ROL_Admins_Sistemas";  Desc="Administradores de sistemas con acceso completo"},
    @{Name="GG_ROL_Lectura_RRHH";     Desc="Acceso de solo lectura a recursos de RRHH"},
    @{Name="GG_ROL_HelpDesk_L1";      Desc="Help Desk Nivel 1 - reset passwords, unlock accounts"},
    @{Name="GG_ROL_HelpDesk_L2";      Desc="Help Desk Nivel 2 - gestión de usuarios y equipos"},
    @{Name="GG_ROL_SysAdmin";         Desc="Administradores de sistemas"}
)

foreach ($r in $roles) {
    New-ADGroup -Name $r.Name -SamAccountName $r.Name `
        -GroupScope Global -GroupCategory Security `
        -Path $roleePath -Description $r.Desc
}
```

</details>

### 1.5 Crear Grupos Domain Local para Recursos

Estos grupos controlan el acceso a recursos específicos (carpetas compartidas, impresoras, etc.).

**Vía GUI — dentro de `_Admin > Grupos > DL_Recursos`:**

Crea los siguientes grupos con scope **Domain Local** y tipo **Security**:

| Group name | Description |
|---|---|
| `DL_FileServer_RRHH_RW` | Acceso Lectura/Escritura a carpeta RRHH |
| `DL_FileServer_RRHH_RO` | Acceso Solo Lectura a carpeta RRHH |
| `DL_FileServer_IT_RW` | Acceso Lectura/Escritura a carpeta IT |
| `DL_FileServer_Contabilidad_RW` | Acceso Lectura/Escritura a carpeta Contabilidad |

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$dlPath = "OU=DL_Recursos,OU=Grupos,OU=_Admin,DC=corp,DC=local"

$dlGroups = @(
    @{Name="DL_FileServer_RRHH_RW";         Desc="Acceso Lectura/Escritura a carpeta RRHH"},
    @{Name="DL_FileServer_RRHH_RO";         Desc="Acceso Solo Lectura a carpeta RRHH"},
    @{Name="DL_FileServer_IT_RW";           Desc="Acceso Lectura/Escritura a carpeta IT"},
    @{Name="DL_FileServer_Contabilidad_RW"; Desc="Acceso Lectura/Escritura a carpeta Contabilidad"}
)

foreach ($g in $dlGroups) {
    New-ADGroup -Name $g.Name -SamAccountName $g.Name `
        -GroupScope DomainLocal -GroupCategory Security `
        -Path $dlPath -Description $g.Desc
}
```

</details>

---

## Parte 2: Implementar AGDLP

### 2.1 Conectar Global Groups con Domain Local Groups

**Vía GUI — Active Directory Users and Computers:**

Para cada grupo Domain Local, agrega los grupos globales correspondientes como miembros:

1. Doble clic en `DL_FileServer_RRHH_RW` → pestaña **Members** → **Add**
   → agrega: `GG_RRHH`, `GG_ROL_Admins_Sistemas` → OK

2. Doble clic en `DL_FileServer_IT_RW` → Members → Add
   → agrega: `GG_IT`, `GG_ROL_Admins_Sistemas` → OK

3. Doble clic en `DL_FileServer_Contabilidad_RW` → Members → Add
   → agrega: `GG_Contabilidad`, `GG_ROL_Admins_Sistemas` → OK

4. Doble clic en `DL_FileServer_RRHH_RO` → Members → Add
   → agrega: `GG_ROL_Lectura_RRHH` → OK

5. Doble clic en `GG_ROL_Admins_Sistemas` → Members → Add
   → agrega: `jtecnico` → OK

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
Add-ADGroupMember -Identity "DL_FileServer_RRHH_RW" -Members "GG_RRHH","GG_ROL_Admins_Sistemas"
Add-ADGroupMember -Identity "DL_FileServer_IT_RW" -Members "GG_IT","GG_ROL_Admins_Sistemas"
Add-ADGroupMember -Identity "DL_FileServer_Contabilidad_RW" -Members "GG_Contabilidad","GG_ROL_Admins_Sistemas"
Add-ADGroupMember -Identity "DL_FileServer_RRHH_RO" -Members "GG_ROL_Lectura_RRHH"
Add-ADGroupMember -Identity "GG_ROL_Admins_Sistemas" -Members "jtecnico"
```

</details>

### 2.2 Visualizar la cadena AGDLP resultante

```
jtecnico (A) → GG_IT (G) → DL_FileServer_IT_RW (DL) → Carpeta \\DC\IT (P)
mrrhh (A)    → GG_RRHH (G) → DL_FileServer_RRHH_RW (DL) → Carpeta \\DC\RRHH (P)
jtecnico (A) → GG_ROL_Admins_Sistemas (G) → DL_FileServer_RRHH_RW (DL) → también accede a RRHH
```

---

## Parte 3: Crear el Servidor de Archivos Compartido

Usaremos el propio DC para el lab (en producción sería un servidor separado).

### 3.1 Crear estructura de carpetas

**Vía GUI — Explorador de archivos:**

1. Abre el Explorador en el DC
2. Ve a `C:\` → clic derecho → **New** → **Folder** → nombre: `Shares`
3. Dentro de `C:\Shares` crea las carpetas: `RRHH`, `IT`, `Contabilidad`, `Comun`

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$basePath = "C:\Shares"
New-Item -Path $basePath -ItemType Directory -Force
foreach ($dept in @("RRHH", "IT", "Contabilidad", "Comun")) {
    New-Item -Path "$basePath\$dept" -ItemType Directory -Force
}
```

</details>

### 3.2 Crear los shares de red

**Vía GUI — Server Manager:**

1. En el DC, abre **Server Manager** → **File and Storage Services** → **Shares**
2. Clic en **Tasks** → **New Share**
3. Selecciona **SMB Share – Quick** → Next
4. En **Share location** selecciona el volumen `C:` → Next
5. En **Share name** escribe `RRHH` → en **Share path** confirma `C:\Shares\RRHH` → Next
6. En **Other settings**: deja los defaults (enable access-based enumeration es útil)
7. En **Permissions**: clic en **Customize permissions**:
   - Pestaña **Share**: elimina todos los permisos existentes → Add → `Authenticated Users` → **Full Control**
   - La pestaña **NTFS** la configuramos en el siguiente paso
8. Completa el asistente → Create
9. Repite para `IT`, `Contabilidad` y `Comun`

> **Regla de oro:** El permiso del Share se pone en `Full Control` para `Authenticated Users`. Todo el control real de acceso se hace en los permisos NTFS.

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
foreach ($dept in @("RRHH", "IT", "Contabilidad", "Comun")) {
    New-SmbShare -Name $dept -Path "C:\Shares\$dept" `
        -Description "Archivos del departamento $dept" `
        -FullAccess "Authenticated Users"
}
```

</details>

### 3.3 Configurar permisos NTFS

**Vía GUI — Explorador de archivos:**

Sigue estos pasos para la carpeta `C:\Shares\RRHH` (repite adaptando para IT y Contabilidad):

1. Clic derecho en `C:\Shares\RRHH` → **Properties** → pestaña **Security**
2. Clic en **Advanced**
3. Clic en **Disable inheritance** → selecciona **Remove all inherited permissions from this object**
4. Ahora la lista de permisos está vacía. Agrega las entradas necesarias:

   a. Clic en **Add** → **Select a principal** → escribe `SYSTEM` → OK  
      Permissions: **Full control** → OK

   b. Clic en **Add** → **Select a principal** → escribe `Domain Admins` → OK  
      Permissions: **Full control** → OK

   c. Clic en **Add** → **Select a principal** → escribe `DL_FileServer_RRHH_RW` → OK  
      Permissions: **Modify** (incluye Read, Write, Execute pero no cambiar permisos) → OK

   d. Clic en **Add** → **Select a principal** → escribe `DL_FileServer_RRHH_RO` → OK  
      Permissions: **Read & execute** → OK

5. Apply → OK

Para `C:\Shares\IT`: agrega `SYSTEM` (Full), `Domain Admins` (Full), `DL_FileServer_IT_RW` (Modify)  
Para `C:\Shares\Contabilidad`: agrega `SYSTEM` (Full), `Domain Admins` (Full), `DL_FileServer_Contabilidad_RW` (Modify)

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
function Set-SecureFolderPermissions {
    param($FolderPath, $ReadWriteGroup, $ReadOnlyGroup = $null)
    
    $acl = Get-Acl $FolderPath
    $acl.SetAccessRuleProtection($true, $false)
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) }
    
    $rules = @(
        [System.Security.AccessControl.FileSystemAccessRule]::new(
            "SYSTEM","FullControl","ContainerInherit,ObjectInherit","None","Allow"),
        [System.Security.AccessControl.FileSystemAccessRule]::new(
            "CORP\Domain Admins","FullControl","ContainerInherit,ObjectInherit","None","Allow"),
        [System.Security.AccessControl.FileSystemAccessRule]::new(
            "CORP\$ReadWriteGroup","Modify","ContainerInherit,ObjectInherit","None","Allow")
    )
    
    if ($ReadOnlyGroup) {
        $rules += [System.Security.AccessControl.FileSystemAccessRule]::new(
            "CORP\$ReadOnlyGroup","ReadAndExecute","ContainerInherit,ObjectInherit","None","Allow")
    }
    
    $rules | ForEach-Object { $acl.AddAccessRule($_) }
    Set-Acl $FolderPath $acl
}

Set-SecureFolderPermissions "C:\Shares\RRHH" "DL_FileServer_RRHH_RW" "DL_FileServer_RRHH_RO"
Set-SecureFolderPermissions "C:\Shares\IT" "DL_FileServer_IT_RW"
Set-SecureFolderPermissions "C:\Shares\Contabilidad" "DL_FileServer_Contabilidad_RW"
```

</details>

---

## Parte 4: Delegar Control en OUs

**Escenario:** El grupo `GG_ROL_Admins_Help_Desk` puede resetear contraseñas de usuarios en la OU RRHH, sin ser Domain Admin.

### 4.1 Delegar mediante el asistente (GUI)

**Vía GUI — Active Directory Users and Computers:**

1. Clic derecho sobre `_Corporativo > RRHH > Usuarios` → **Delegate Control**
2. **Next** → en **Users or Groups** clic en **Add** → escribe `GG_ROL_Admins_Help_Desk` → OK → Next
3. Selecciona **Create a custom task to delegate** → Next
4. **Active Directory Object Type**: selecciona **Only the following objects in the folder** → marca **User objects** → Next
5. **Permissions**: marca:
   - **Reset password**
   - **Read and write lockoutTime**
   - **Read and write pwdLastSet**
6. Next → Finish

<details>
<summary>⚡ PowerShell — delegación más precisa con GUIDs del schema</summary>

```powershell
Import-Module ActiveDirectory

$ouDN = "OU=Usuarios,OU=RRHH,OU=_Corporativo,DC=corp,DC=local"
$groupSID = (Get-ADGroup "GG_ROL_Admins_Help_Desk").SID

$acl = Get-Acl "AD:\$ouDN"

$resetPasswordGUID = [GUID]"00299570-246d-11d0-a768-00aa006e0529"
$userClassGUID     = [GUID]"bf967aba-0de6-11d0-a285-00aa003049e2"

$rule = New-Object System.DirectoryServices.ActiveDirectoryAccessRule(
    $groupSID,
    [System.DirectoryServices.ActiveDirectoryRights]::ExtendedRight,
    [System.Security.AccessControl.AccessControlType]::Allow,
    $resetPasswordGUID,
    [System.DirectoryServices.ActiveDirectorySecurityInheritance]::Descendents,
    $userClassGUID
)

$acl.AddAccessRule($rule)
Set-Acl "AD:\$ouDN" $acl
Write-Host "Delegacion aplicada."
```

</details>

### 4.2 Verificar la delegación

**Vía GUI:**

1. En ADUC, menú **View** → **Advanced Features** (para ver las pestañas de seguridad)
2. Clic derecho en la OU `Usuarios` (dentro de RRHH) → **Properties** → pestaña **Security** → **Advanced**
3. Busca la entrada correspondiente a `GG_ROL_Admins_Help_Desk` y verifica los permisos

<details>
<summary>⚡ PowerShell — verificación por consola</summary>

```powershell
(Get-Acl "AD:\OU=Usuarios,OU=RRHH,OU=_Corporativo,DC=corp,DC=local").Access |
    Where-Object { $_.IdentityReference -like "*HelpDesk*" } |
    Format-Table IdentityReference, ActiveDirectoryRights, InheritanceType
```

</details>

---

## Parte 5: Grupos Built-in y Administración por Niveles

### 5.1 Grupos built-in importantes

| Grupo | Descripción |
|---|---|
| `Domain Admins` | Administración completa del dominio. Usar con precaución. |
| `Enterprise Admins` | Administración del bosque completo. Solo para cambios mayores. |
| `Schema Admins` | Modificar el schema de AD. Usar solo cuando sea necesario. |
| `Backup Operators` | Pueden hacer backup/restore sin ser admins. |
| `Remote Desktop Users` | Pueden conectarse via RDP. |
| `Server Operators` | Pueden gestionar servicios, discos y shares en DCs. |

### 5.2 Asignar grupos de rol a grupos built-in

**Vía GUI — Active Directory Users and Computers:**

1. Expande `corp.local > Builtin`
2. Doble clic en **Remote Desktop Users** → pestaña **Members** → Add
   → agrega `GG_ROL_SysAdmin` y `GG_ROL_HelpDesk_L2` → OK
3. Doble clic en **Server Operators** → Members → Add
   → agrega `GG_ROL_SysAdmin` → OK

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
Add-ADGroupMember -Identity "Remote Desktop Users" -Members "GG_ROL_SysAdmin","GG_ROL_HelpDesk_L2"
Add-ADGroupMember -Identity "Server Operators" -Members "GG_ROL_SysAdmin"
```

</details>

> **Nunca agregues usuarios directamente a `Domain Admins` para trabajo diario.** Crea grupos de rol con los permisos mínimos necesarios.

---

## Parte 6: GPO con Restricted Groups

Controla quién puede estar en el grupo local `Administrators` de todos los equipos del dominio.

### 6.1 Crear el GPO

**Vía GUI — Group Policy Management:**

1. Crea un GPO en la OU `_Corporativo` → nombre: `CORP - Restricted Groups Maquinas`
2. Edita el GPO → navega a:
   ```
   Computer Configuration > Policies > Windows Settings
     > Security Settings > Restricted Groups
   ```
3. Clic derecho → **Add Group** → escribe `BUILTIN\Administrators` → OK
4. En la ventana de configuración del grupo:
   - **Members of this group**: agrega `CORP\Domain Admins` y `CORP\GG_ROL_SysAdmin`
   - **This group is a member of**: déjalo vacío
5. OK

> Esto revierte automáticamente cualquier cambio manual al grupo `Administrators` local en el próximo `gpupdate`. Solo los grupos autorizados permanecen.

---

## Parte 7: Verificación Final

### 7.1 Verificar membresías desde la GUI

**Vía GUI — Active Directory Users and Computers:**

1. Doble clic en el usuario `mrrhh` → pestaña **Member Of** → verás todos sus grupos directos
2. Para ver membresías anidadas: en la pestaña Member Of, no se muestran grupos de grupos.  
   Usa el comando de PowerShell si necesitas ver la cadena completa.

<details>
<summary>⚡ PowerShell — verificación de membresías incluyendo grupos anidados</summary>

```powershell
# Ver miembros de un grupo
Get-ADGroupMember -Identity "GG_RRHH" | Select-Object Name, SamAccountName, ObjectClass

# Ver grupos directos de un usuario
Get-ADUser "mrrhh" -Properties MemberOf | Select-Object -ExpandProperty MemberOf

# Ver todos los grupos (incluyendo anidados) de un usuario
$user = "mrrhh"
$nested = @()
$queue = [System.Collections.Queue]::new()
(Get-ADUser $user -Properties MemberOf).MemberOf | ForEach-Object { $queue.Enqueue($_) }
while ($queue.Count -gt 0) {
    $g = $queue.Dequeue()
    if ($nested -notcontains $g) {
        $nested += $g
        (Get-ADGroup $g -Properties MemberOf).MemberOf | ForEach-Object { $queue.Enqueue($_) }
    }
}
$nested | ForEach-Object { (Get-ADGroup $_).Name }
```

</details>

### 7.2 Verificar acceso a recursos desde el cliente

1. En el cliente, inicia sesión como `mrrhh`
2. Abre el Explorador → en la barra de direcciones escribe `\\192.168.100.10\RRHH`
   → debe abrir y permitir crear archivos
3. Intenta acceder a `\\192.168.100.10\Contabilidad` → debe mostrar **Access Denied**
4. Cierra sesión e inicia como `jtecnico`
5. Ambas carpetas deben ser accesibles (por ser miembro de `GG_ROL_Admins_Sistemas`)

### 7.3 Verificar permisos NTFS

**Vía GUI:**

1. En el DC, clic derecho en `C:\Shares\RRHH` → **Properties** → **Security** → **Advanced**
2. Verifica las entradas: `DL_FileServer_RRHH_RW` con Modify, `DL_FileServer_RRHH_RO` con Read

<details>
<summary>⚡ PowerShell — verificación por consola</summary>

```powershell
icacls "C:\Shares\RRHH"
# Debe mostrar:
# CORP\DL_FileServer_RRHH_RW:(OI)(CI)(M)
# CORP\DL_FileServer_RRHH_RO:(OI)(CI)(RX)
# NT AUTHORITY\SYSTEM:(OI)(CI)(F)
# CORP\Domain Admins:(OI)(CI)(F)
```

</details>

---

## Troubleshooting Común

| Problema | Causa | Solución |
|---|---|---|
| Usuario puede acceder aunque no debería | Token de seguridad desactualizado | Cerrar sesión y volver a iniciar — el token se regenera |
| No se pueden ver los shares | Share permission faltante o firewall | Verificar en Server Manager → File and Storage → Shares |
| Delegación no funciona | ACE aplicada en OU incorrecta | En ADUC → View → Advanced Features → verificar Security de la OU |
| Restricted Groups revierte cambios correctos | El GPO está configurado incorrectamente | Revisar los miembros autorizados en el GPO |
| Grupos anidados no dan acceso | Dirección AGDLP incorrecta | El Global Group va **dentro** del Domain Local, nunca al revés |

---

## Resumen de Estructura de Grupos

```
_Admin
└── Grupos
    ├── GG_Departamentos
    │   ├── GG_IT
    │   ├── GG_RRHH
    │   ├── GG_Contabilidad
    │   └── GG_Gerencia
    ├── GG_Roles
    │   ├── GG_ROL_HelpDesk_L1
    │   ├── GG_ROL_HelpDesk_L2
    │   ├── GG_ROL_SysAdmin
    │   ├── GG_ROL_Admins_Help_Desk
    │   └── GG_ROL_Admins_Sistemas
    └── DL_Recursos
        ├── DL_FileServer_RRHH_RW
        ├── DL_FileServer_RRHH_RO
        ├── DL_FileServer_IT_RW
        └── DL_FileServer_Contabilidad_RW
```

---

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué diferencia hay entre Security Group y Distribution Group en AD?**
> `Security Group` se usa para asignar permisos a recursos (carpetas, impresoras, GPOs). `Distribution Group` solo sirve para listas de correo en Exchange; no puede recibir permisos NTFS ni GPOs.

**2. ¿Qué es AGDLP y por qué es la estrategia recomendada de Microsoft?**
> Account → Global Group → Domain Local Group → Permission. Los usuarios se meten en Global Groups (por rol/departamento), los Global Groups en Domain Local Groups (por recurso), y los DL Groups reciben los permisos NTFS. Esto permite escalar en entornos multi-dominio y cambiar permisos a nivel de grupo, no usuario por usuario.

**3. ¿Qué tipos de alcance de grupo existen y cuándo usas cada uno?**
> `Universal`: puede contener cuentas de cualquier dominio del bosque; úsalos con moderación pues se replican al Global Catalog. `Global`: cuentas del mismo dominio; ideal para agrupar usuarios por departamento. `Domain Local`: puede contener cuentas de cualquier dominio; ideal para asignar permisos a recursos.

**4. ¿Cómo delegas administración de una OU a un técnico sin darle permisos de Domain Admin?**
> Clic derecho en la OU en ADUC → "Delegate Control" → asignar las tareas específicas (crear/eliminar usuarios, resetear contraseñas, etc.) al usuario o grupo técnico. Esto aplica permisos ACL en el objeto de AD sin elevar privilegios globales.

**5. ¿Qué es RBAC y cómo lo implementas en AD?**
> Role-Based Access Control: cada rol tiene un grupo de seguridad; los usuarios se añaden al grupo de su rol; los grupos reciben los permisos. Cambiar los permisos de un rol solo requiere modificar el grupo, no cada usuario individualmente.

**6. ¿Cuál es la diferencia entre permisos de Share y permisos NTFS?**
> Los permisos de Share aplican cuando se accede por red; los NTFS aplican siempre (red y local). El acceso efectivo es la intersección de ambos (el más restrictivo gana). La práctica recomendada es dar `Full Control` en Share y gestionar todo con NTFS.

---

## Próximo Paso

**Lab 04 — Gestión Avanzada de Usuarios: Fine-Grained Password Policies, MSAs y Automatización**  
Aprenderás a crear políticas de contraseña diferenciadas por grupo, Managed Service Accounts, y automatizar la creación masiva de usuarios.
