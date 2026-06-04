---
title: "Lab 04 — Usuarios Avanzado"
description: Fine-Grained Password Policies, Managed Service Accounts (gMSA), creación masiva de usuarios desde CSV y auditoría de cuentas.
sidebar:
  label: "Lab 04: Usuarios Avanzado"
  badge:
    text: Intermedio
    variant: caution
---

# Lab 04 — Gestión Avanzada de Usuarios: Fine-Grained Passwords, MSAs y Automatización

**Prerequisito:** Labs 02 y 03 completados (OUs, grupos y usuarios de prueba creados).  
**Duración estimada:** 2-3 horas  
**Dificultad:** Intermedio-Avanzado

---

## Objetivos del Laboratorio

- Crear Fine-Grained Password Policies (PSO) para diferentes grupos
- Implementar Managed Service Accounts (MSA / gMSA) para servicios
- Crear usuarios en masa desde un CSV
- Configurar plantillas de usuario con atributos estándar
- Auditar actividad de cuentas y logins fallidos
- Gestionar cuentas deshabilitadas y limpieza del AD

---

## Parte 1: Fine-Grained Password Policies (PSO)

La **Default Domain Policy** aplica una sola política de contraseñas a todo el dominio. Las **Fine-Grained Password Policies** permiten políticas distintas por grupo o usuario individual.

**Ejemplo real:** Admins → 16 caracteres, expira cada 60 días. Usuarios normales → 12 caracteres, 90 días.

### 1.1 Verificar el nivel funcional del dominio

Las PSO requieren **Domain Functional Level 2008 o superior**.

**Vía GUI — Active Directory Domains and Trusts (`domain.msc`):**

1. Abre **Active Directory Domains and Trusts** desde Administrative Tools
2. Clic derecho sobre `corp.local` → **Raise Domain Functional Level**
3. Verifica que esté en **Windows Server 2016** o superior
4. Si necesitas subir el nivel, selecciona la versión y confirma

<details>
<summary>⚡ PowerShell — verificación y cambio del functional level</summary>

```powershell
Get-ADDomain | Select-Object DomainMode
Get-ADForest | Select-Object ForestMode

# Si necesitas subir el nivel:
Set-ADDomainMode -Identity "corp.local" -DomainMode Windows2016Domain
```

</details>

### 1.2 Crear las PSOs

> **Herramienta GUI para PSOs:** Las PSOs **no se pueden crear desde ADUC**. Debes usar el **Active Directory Administrative Center (ADAC)** — que viene incluido en Windows Server desde 2012.

**Vía GUI — Active Directory Administrative Center (`dsac.exe`):**

1. Abre **Active Directory Administrative Center** desde Administrative Tools
2. En el panel izquierdo, navega a `corp (local) > System > Password Settings Container`
3. En el panel derecho, clic en **New** → **Password Settings**
4. Completa el formulario para la **PSO de Administradores**:

| Campo | Valor |
|---|---|
| Name | `PSO_Administradores` |
| Precedence | `10` |
| Enforce minimum password length | Habilitado → `16` |
| Enforce password history | Habilitado → `15` |
| Password must meet complexity requirements | Habilitado |
| Maximum password age | Habilitado → `60 days` |
| Minimum password age | Habilitado → `1 day` |
| Enforce account lockout policy | Habilitado → Threshold: `3`, Duration: `30 min` |

5. En la sección **Directly Applies To** (al final del formulario) → **Add** → agrega los grupos `Domain Admins` y `GG_ROL_SysAdmin` → OK
6. OK para guardar

7. Repite el proceso para la **PSO de Usuarios Generales** con estos valores:

| Campo | Valor |
|---|---|
| Name | `PSO_UsuariosGenerales` |
| Precedence | `20` |
| Minimum password length | `12` |
| Password history | `10` |
| Maximum password age | `90 days` |
| Lockout threshold | `5` intentos, duración `15 min` |

8. En **Directly Applies To** agrega: `GG_IT`, `GG_RRHH`, `GG_Contabilidad`

9. Repite para la **PSO de Cuentas de Servicio**:

| Campo | Valor |
|---|---|
| Name | `PSO_CuentasServicio` |
| Precedence | `5` |
| Minimum password length | `20` |
| Password history | `24` |
| Maximum password age | **Deshabilitado** (contraseña nunca expira) |
| Enforce account lockout | **Deshabilitado** (no bloquear cuentas de servicio) |

<details>
<summary>⚡ PowerShell — creación de PSOs en un solo bloque</summary>

```powershell
New-ADFineGrainedPasswordPolicy `
    -Name "PSO_Administradores" -Precedence 10 `
    -MinPasswordLength 16 -PasswordHistoryCount 15 `
    -MaxPasswordAge "60.00:00:00" -MinPasswordAge "1.00:00:00" `
    -ComplexityEnabled $true -ReversibleEncryptionEnabled $false `
    -LockoutThreshold 3 -LockoutDuration "00:30:00" `
    -LockoutObservationWindow "00:30:00" `
    -Description "Política estricta para cuentas administrativas"

New-ADFineGrainedPasswordPolicy `
    -Name "PSO_UsuariosGenerales" -Precedence 20 `
    -MinPasswordLength 12 -PasswordHistoryCount 10 `
    -MaxPasswordAge "90.00:00:00" -MinPasswordAge "1.00:00:00" `
    -ComplexityEnabled $true -ReversibleEncryptionEnabled $false `
    -LockoutThreshold 5 -LockoutDuration "00:15:00" `
    -LockoutObservationWindow "00:15:00" `
    -Description "Política estándar para usuarios corporativos"

New-ADFineGrainedPasswordPolicy `
    -Name "PSO_CuentasServicio" -Precedence 5 `
    -MinPasswordLength 20 -PasswordHistoryCount 24 `
    -MaxPasswordAge "0" -MinPasswordAge "0" `
    -ComplexityEnabled $true -ReversibleEncryptionEnabled $false `
    -LockoutThreshold 0 `
    -Description "Sin expiración para cuentas de servicio"

# Asignar a los grupos
Add-ADFineGrainedPasswordPolicySubject -Identity "PSO_Administradores" `
    -Subjects "Domain Admins","GG_ROL_SysAdmin"
Add-ADFineGrainedPasswordPolicySubject -Identity "PSO_UsuariosGenerales" `
    -Subjects "GG_IT","GG_RRHH","GG_Contabilidad"
```

</details>

### 1.3 Verificar qué PSO aplica a un usuario

**Vía GUI — Active Directory Administrative Center:**

1. En ADAC, navega a la OU del usuario (ej: `_Corporativo > IT > Usuarios`)
2. Doble clic en el usuario `jtecnico`
3. En el panel de detalles, desplázate hasta la sección **Password Settings** — verás la PSO efectiva

> **Regla de precedencia:** si un usuario pertenece a dos grupos con PSOs distintas, aplica la de **número menor** (menor Precedence = mayor prioridad).

<details>
<summary>⚡ PowerShell — verificación por consola</summary>

```powershell
# PSO efectiva de un usuario
Get-ADUserResultantPasswordPolicy -Identity "jtecnico"

# Todas las PSOs del dominio
Get-ADFineGrainedPasswordPolicy -Filter * | Select-Object Name, Precedence, MinPasswordLength

# A quién se aplica una PSO
Get-ADFineGrainedPasswordPolicySubject -Identity "PSO_Administradores"
```

</details>

---

## Parte 2: Managed Service Accounts (gMSA)

Las cuentas de servicio tradicionales tienen un problema: la contraseña expira y hay que cambiarla manualmente en cada servicio. Las **Group Managed Service Accounts (gMSA)** resuelven esto: AD rota la contraseña automáticamente cada 30 días y el servidor recupera la contraseña sin que ningún administrador necesite conocerla.

### 2.1 Crear la KDS Root Key

Este es un **prerequisito único** por bosque. Solo se hace una vez.

> Este paso **requiere PowerShell** — no existe opción GUI para crear la KDS Root Key.

```powershell
# En el DC — efectiva de inmediato (solo para labs)
Add-KdsRootKey -EffectiveImmediately

# Verificar que se creó
Get-KdsRootKey
```

> En producción usa `Add-KdsRootKey -EffectiveTime ((Get-Date).AddHours(-10))` y espera al menos 10 horas antes de crear gMSAs, para que la clave se replique a todos los DCs.

### 2.2 Crear una gMSA

**Vía GUI — Active Directory Users and Computers:**

1. Habilita la vista avanzada: menú **View** → **Advanced Features**
2. Navega a `_Admin > Cuentas de Servicio`
3. Clic derecho → **New** → **Other...** → busca y selecciona **msDS-GroupManagedServiceAccount** → OK
4. Completa los campos básicos:
   - `cn` (nombre): `gmsa_Backup`
   - `sAMAccountName`: `gmsa_Backup`  
5. Para configurar los atributos avanzados (DNSHostName, PrincipalsAllowedToRetrieveManagedPassword), necesitas editar los atributos directamente en el **Attribute Editor** o usar PowerShell

> La creación avanzada de gMSAs con todos los parámetros es más eficiente y confiable via PowerShell:

<details>
<summary>⚡ PowerShell — creación completa de gMSA</summary>

```powershell
New-ADServiceAccount `
    -Name "gmsa_Backup" `
    -DNSHostName "gmsa-backup.corp.local" `
    -PrincipalsAllowedToRetrieveManagedPassword "GG_ROL_SysAdmin" `
    -Description "Cuenta de servicio para el agente de backup" `
    -Path "OU=Cuentas de Servicio,OU=_Admin,DC=corp,DC=local"

# Verificar
Get-ADServiceAccount -Identity "gmsa_Backup" -Properties *
```

</details>

### 2.3 Instalar y usar la gMSA en el servidor del servicio

En el servidor donde correrá el servicio (no en el DC):

```powershell
# Instalar la gMSA en este servidor
Install-ADServiceAccount -Identity "gmsa_Backup"

# Verificar que el servidor puede recuperar la contraseña
Test-ADServiceAccount -Identity "gmsa_Backup"
```

**Asignar la gMSA a un servicio de Windows — Vía GUI (`services.msc`):**

1. Abre **services.msc**
2. Doble clic en el servicio que usará la cuenta
3. Pestaña **Log On** → selecciona **This account**
4. Escribe el nombre: `corp\gmsa_Backup$` (nota el `$` al final — es obligatorio)
5. Deja **ambos campos de contraseña en blanco** — se gestiona automáticamente
6. Apply → si pide confirmar, acepta → reinicia el servicio

---

## Parte 3: Creación de Usuarios desde CSV (Bulk Creation)

### 3.1 Crear el archivo CSV

**Vía GUI — Bloc de notas o Excel:**

1. Abre el Bloc de notas o Excel
2. Si usas Excel: la primera fila son los encabezados, cada fila siguiente es un usuario
3. Guarda como `C:\Scripts\usuarios_nuevos.csv` (en formato CSV si usas Excel)

El archivo debe tener este formato:

```csv
FirstName,LastName,Department,Title,Manager,Office
Carlos,Garcia,IT,Técnico de Soporte,jtecnico,Madrid
Ana,Martinez,RRHH,Coordinadora RRHH,mrrhh,Madrid
Luis,Rodriguez,Contabilidad,Analista Contable,pcontador,Madrid
Sofia,Lopez,IT,Desarrolladora,jtecnico,Barcelona
Diego,Fernandez,RRHH,Asistente RRHH,mrrhh,Barcelona
Elena,Sanchez,Gerencia,Directora de Operaciones,,Madrid
Roberto,Torres,IT,Administrador de Redes,jtecnico,Madrid
```

> Para importaciones pequeñas (menos de 20 usuarios), ADUC permite crearlos manualmente uno por uno. Para volúmenes grandes, el script es la única opción práctica.

### 3.2 Crear la carpeta de scripts

**Vía GUI — Explorador de archivos:**

1. Ve a `C:\`
2. Clic derecho → **New** → **Folder** → nombre: `Scripts`

### 3.3 Script de creación masiva

Crea el archivo `C:\Scripts\Create-BulkUsers.ps1`:

```powershell
param(
    [Parameter(Mandatory)]
    [string]$CsvPath,
    [string]$DefaultPassword = "Bienvenido2024!",
    [string]$Domain = "corp.local",
    [switch]$WhatIf
)

$ErrorActionPreference = "Continue"
$logFile = "C:\Scripts\bulk_users_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

function Write-Log {
    param($Message, $Level = "INFO")
    $entry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')][$Level] $Message"
    Write-Host $entry
    Add-Content -Path $logFile -Value $entry
}

$ouMap = @{
    "IT"           = "OU=Usuarios,OU=IT,OU=_Corporativo,DC=corp,DC=local"
    "RRHH"         = "OU=Usuarios,OU=RRHH,OU=_Corporativo,DC=corp,DC=local"
    "Contabilidad" = "OU=Usuarios,OU=Contabilidad,OU=_Corporativo,DC=corp,DC=local"
    "Gerencia"     = "OU=Usuarios,OU=IT,OU=_Corporativo,DC=corp,DC=local"
}

$groupMap = @{
    "IT"="GG_IT"; "RRHH"="GG_RRHH"; "Contabilidad"="GG_Contabilidad"; "Gerencia"="GG_Gerencia"
}

$securePassword = ConvertTo-SecureString $DefaultPassword -AsPlainText -Force
$users = Import-Csv -Path $CsvPath
$results = @()

Write-Log "Iniciando creación masiva. Total: $($users.Count)"

foreach ($user in $users) {
    $sam = ($user.FirstName[0] + $user.LastName).ToLower() -replace '\s', ''
    $displayName = "$($user.FirstName) $($user.LastName)"
    $ou = $ouMap[$user.Department]
    
    if (-not $ou) {
        Write-Log "Departamento desconocido: $($user.Department)" "WARN"
        continue
    }
    
    if (Get-ADUser -Filter "SamAccountName -eq '$sam'" -ErrorAction SilentlyContinue) {
        Write-Log "$sam ya existe. Saltando." "WARN"
        $results += [PSCustomObject]@{Name=$displayName; SamAccount=$sam; Status="Ya existia"}
        continue
    }
    
    try {
        if (-not $WhatIf) {
            New-ADUser -Name $displayName -GivenName $user.FirstName -Surname $user.LastName `
                -SamAccountName $sam -UserPrincipalName "$sam@$Domain" `
                -DisplayName $displayName -Department $user.Department `
                -Title $user.Title -Office $user.Office `
                -Path $ou -AccountPassword $securePassword `
                -Enabled $true -ChangePasswordAtLogon $true
            
            if ($groupMap[$user.Department]) {
                Add-ADGroupMember -Identity $groupMap[$user.Department] -Members $sam
            }
            Write-Log "Creado: $displayName ($sam)"
        } else {
            Write-Log "[WHATIF] Crearía: $displayName en $ou"
        }
        $results += [PSCustomObject]@{Name=$displayName; SamAccount=$sam; Status="Creado"}
    }
    catch {
        Write-Log "Error creando $displayName : $_" "ERROR"
        $results += [PSCustomObject]@{Name=$displayName; SamAccount=$sam; Status="Error"}
    }
}

Write-Log "Creados: $(($results|Where Status -eq 'Creado').Count) | Errores: $(($results|Where Status -eq 'Error').Count)"
$results | Export-Csv "C:\Scripts\resultado_$(Get-Date -Format 'yyyyMMdd').csv" -NoTypeInformation
$results | Format-Table -AutoSize
```

### 3.4 Ejecutar el script

```powershell
# Modo prueba (no crea nada, solo muestra lo que haría)
.\Create-BulkUsers.ps1 -CsvPath "C:\Scripts\usuarios_nuevos.csv" -WhatIf

# Ejecución real
.\Create-BulkUsers.ps1 -CsvPath "C:\Scripts\usuarios_nuevos.csv"
```

---

## Parte 4: Plantillas de Usuario

Las plantillas permiten crear nuevos usuarios copiando los atributos estándar de un usuario modelo.

### 4.1 Crear un usuario plantilla

**Vía GUI — Active Directory Users and Computers:**

1. Navega a `_Admin` (OU principal)
2. Clic derecho → **New** → **User**
3. Nombre: `_Plantilla_IT` / Logon name: `_plantilla_it` → Siguiente
4. Contraseña: cualquiera → desmarca todo → **marca "Account is disabled"** → Finish
5. Doble clic en el usuario creado → completa los atributos que quieres que hereden los nuevos usuarios:
   - Pestaña **General**: Company, Description
   - Pestaña **Address**: Street, City, State, ZIP, Country
   - Pestaña **Organization**: Department, Company, Manager

### 4.2 Crear un nuevo usuario copiando la plantilla

**Vía GUI — Active Directory Users and Computers:**

1. Clic derecho sobre `_plantilla_it` → **Copy**
2. Se abre un asistente similar al de creación de usuario
3. Completa: nombre, apellido, y usuario de inicio de sesión del nuevo usuario
4. Establece contraseña → Finish
5. El nuevo usuario hereda los atributos de la plantilla y queda en la **misma OU**

> **Nota importante:** La copia de usuario en ADUC hereda: Department, Company, Address, Group memberships y la descripción. No hereda atributos personalizados ni Title.

<details>
<summary>⚡ PowerShell — copiar plantilla con atributos completos</summary>

```powershell
function New-UserFromTemplate {
    param(
        [string]$TemplateSamAccount,
        [string]$FirstName,
        [string]$LastName,
        [string]$Password
    )
    
    $template = Get-ADUser $TemplateSamAccount -Properties *
    $sam = ($FirstName[0] + $LastName).ToLower() -replace '\s', ''
    $securePass = ConvertTo-SecureString $Password -AsPlainText -Force
    $ouPath = ($template.DistinguishedName -replace '^CN=[^,]+,', '')
    
    New-ADUser -Name "$FirstName $LastName" -GivenName $FirstName -Surname $LastName `
        -SamAccountName $sam -UserPrincipalName "$sam@corp.local" `
        -Department $template.Department -Company $template.Company `
        -City $template.City -Office $template.Office `
        -Path $ouPath -AccountPassword $securePass `
        -Enabled $true -ChangePasswordAtLogon $true
    
    Write-Host "Usuario creado: $sam"
}

New-UserFromTemplate -TemplateSamAccount "_plantilla_it" `
    -FirstName "Pablo" -LastName "Nuevo" -Password "Temp2024!"
```

</details>

---

## Parte 5: Auditoría de Cuentas

### 5.1 Buscar y desbloquear cuentas

**Vía GUI — Active Directory Users and Computers:**

1. En el menú **Action** → **Find** (o Ctrl+F)
2. En **Find:** selecciona **Custom Search**
3. Pestaña **Advanced** → en el campo LDAP query escribe:
   ```
   (&(objectClass=user)(lockoutTime>=1))
   ```
4. Clic en **Find Now** → verás todas las cuentas bloqueadas
5. Clic derecho sobre una cuenta bloqueada → **Properties** → pestaña **Account** → desmarca **Unlock account**

<details>
<summary>⚡ PowerShell — búsqueda y desbloqueo masivo</summary>

```powershell
# Ver todas las cuentas bloqueadas
Search-ADAccount -LockedOut | Select-Object Name, SamAccountName, BadLogonCount, LastLogonDate

# Desbloquear una cuenta
Unlock-ADAccount -Identity "mrrhh"

# Desbloquear todas las bloqueadas (usar con precaución)
Search-ADAccount -LockedOut | Unlock-ADAccount
```

</details>

### 5.2 Buscar cuentas inactivas

**Vía GUI — Active Directory Users and Computers:**

1. **Action** → **Find**
2. En **Find:** selecciona **Users, Contacts, and Groups**
3. Pestaña **Advanced** → LDAP query:
   ```
   (&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=2)(lastLogonTimestamp<=132000000000000000))
   ```
   > El valor de lastLogonTimestamp en este formato es complejo. Usa PowerShell para una búsqueda más precisa por fecha.

<details>
<summary>⚡ PowerShell — búsqueda precisa de inactivos</summary>

```powershell
$inactiveDate = (Get-Date).AddDays(-90)
Get-ADUser -Filter {LastLogonDate -lt $inactiveDate -and Enabled -eq $true} `
    -Properties LastLogonDate, Department | 
    Select-Object Name, SamAccountName, Department, LastLogonDate |
    Sort-Object LastLogonDate |
    Format-Table -AutoSize
```

</details>

### 5.3 Deshabilitar y mover cuentas inactivas

**Vía GUI — Active Directory Users and Computers:**

Para deshabilitar una cuenta:
1. Clic derecho en el usuario → **Disable Account**

Para moverla a la OU de deshabilitados:
1. Clic derecho → **Move** → selecciona `_Admin > Deshabilitados`
   (Crea la OU `Deshabilitados` dentro de `_Admin` si no existe)

2. Doble clic en el usuario → en el campo **Description** agrega: `[DESHABILITADO 2024-MM-DD]`

<details>
<summary>⚡ PowerShell — automatizar la deshabilitación masiva</summary>

```powershell
$inactiveDate = (Get-Date).AddDays(-90)
$disabledOU = "OU=Deshabilitados,OU=_Admin,DC=corp,DC=local"

if (-not (Get-ADOrganizationalUnit -Filter "DistinguishedName -eq '$disabledOU'" -ErrorAction SilentlyContinue)) {
    New-ADOrganizationalUnit -Name "Deshabilitados" -Path "OU=_Admin,DC=corp,DC=local"
}

Get-ADUser -Filter {LastLogonDate -lt $inactiveDate -and Enabled -eq $true} `
    -Properties LastLogonDate, Description | ForEach-Object {
    
    Set-ADUser $_ -Description "[DESHABILITADO $(Get-Date -Format 'yyyy-MM-dd')] $($_.Description)"
    Disable-ADAccount -Identity $_
    Move-ADObject -Identity $_.DistinguishedName -TargetPath $disabledOU
    Write-Host "Procesado: $($_.Name)"
}
```

</details>

### 5.4 Ver eventos de seguridad — Event Viewer

**Vía GUI — Event Viewer (`eventvwr.msc`):**

1. Abre **Event Viewer** en el DC
2. Navega a `Windows Logs > Security`
3. En el panel derecho clic en **Filter Current Log**
4. En **Event IDs** escribe los IDs que quieres ver:
   - `4625` — Login fallido
   - `4720` — Cuenta creada
   - `4723` — Cambio de contraseña
   - `4740` — Cuenta bloqueada
5. OK → verás solo esos eventos

<details>
<summary>⚡ PowerShell — consulta programática de eventos</summary>

```powershell
# Logins fallidos últimas 24h
Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4625; StartTime=(Get-Date).AddHours(-24)} |
    Select-Object TimeCreated,
        @{N="Account";E={$_.Properties[5].Value}},
        @{N="FailureReason";E={$_.Properties[8].Value}},
        @{N="SourceIP";E={$_.Properties[19].Value}} |
    Sort-Object TimeCreated -Descending | Format-Table -AutoSize

# Cuentas creadas últimos 7 días
Get-WinEvent -FilterHashtable @{LogName="Security"; Id=4720; StartTime=(Get-Date).AddDays(-7)} |
    Select-Object TimeCreated,
        @{N="NewUser";E={$_.Properties[0].Value}},
        @{N="CreatedBy";E={$_.Properties[4].Value}} |
    Format-Table -AutoSize
```

</details>

### 5.5 Script de reset de contraseña para Help Desk

```powershell
function Reset-UserPassword {
    param(
        [Parameter(Mandatory)]
        [string]$SamAccountName,
        [string]$TempPassword = "Temporal2024!"
    )
    
    $user = Get-ADUser $SamAccountName -Properties LockedOut
    if (-not $user) { Write-Error "Usuario $SamAccountName no encontrado"; return }
    
    Set-ADAccountPassword -Identity $SamAccountName `
        -NewPassword (ConvertTo-SecureString $TempPassword -AsPlainText -Force) -Reset
    Set-ADUser -Identity $SamAccountName -ChangePasswordAtLogon $true
    
    if ($user.LockedOut) {
        Unlock-ADAccount -Identity $SamAccountName
        Write-Host "Cuenta desbloqueada."
    }
    
    Write-Host "Contraseña reseteada para $($user.Name)"
    Write-Host "Contraseña temporal: $TempPassword"
}

# Uso
Reset-UserPassword -SamAccountName "mrrhh"
```

---

## Verificación Final del Lab

```powershell
# 1. PSO efectiva por usuario
foreach ($u in @("jtecnico","mrrhh","pcontador")) {
    $pso = Get-ADUserResultantPasswordPolicy -Identity $u
    Write-Host "$u → PSO: $(if ($pso) { $pso.Name } else { 'Default Domain Policy' })"
}

# 2. gMSAs en el dominio
Get-ADServiceAccount -Filter * | Select-Object Name, Enabled, PasswordLastSet

# 3. Distribución de usuarios por departamento
Get-ADUser -Filter * -Properties Department |
    Group-Object Department |
    Select-Object Name, Count | Sort-Object Name
```

---

## Troubleshooting Común

| Problema | Causa | Solución |
|---|---|---|
| PSO no aparece en ADAC | El nivel funcional del dominio es < 2008 | Subir el functional level primero |
| PSO no aplica a un usuario | Usuario no está en el grupo asignado | Verificar `Get-ADFineGrainedPasswordPolicySubject` |
| gMSA no se puede instalar | KDS Root Key muy reciente | En labs usar `-EffectiveImmediately`; en prod esperar 10h |
| `Test-ADServiceAccount` falla | Servidor no autorizado | Agregar la cuenta del servidor a `PrincipalsAllowedToRetrieveManagedPassword` |
| Script CSV falla en "OU not found" | Path de OU incorrecto | Verificar con `Get-ADOrganizationalUnit -Filter *` |

---

---

## 🎤 Preguntas de Entrevista

**1. ¿Para qué sirven las Fine-Grained Password Policies (PSO)?**
> Permiten tener políticas de contraseña diferentes por grupo o usuario dentro del mismo dominio. Ejemplo: administradores con contraseña de 16 chars y expiración de 60 días, usuarios normales con 12 chars y 90 días.

**2. ¿Qué es una gMSA y cuándo la usarías en lugar de una cuenta de servicio normal?**
> Group Managed Service Account: AD gestiona automáticamente su contraseña (120 chars aleatorios, rota cada 30 días) sin que nadie la conozca. Se usa para servicios Windows (IIS, SQL Agent, SCCM) donde antes ponías una cuenta con contraseña fija que nunca cambiabas por miedo a romper el servicio.

**3. ¿Cómo crearías 200 usuarios en AD de forma automatizada?**
> Preparando un CSV con los campos (Name, SamAccountName, OU, Department, etc.) y usando un script PowerShell con `Import-Csv` + `New-ADUser` en un loop. Ejemplo: `Import-Csv users.csv | ForEach-Object { New-ADUser -Name $_.Name -Path $_.OU ... }`.

**4. ¿Cómo auditarías logins fallidos en AD?**
> Habilitando la política "Audit Logon Events" en GPO → Computer Configuration → Windows Settings → Security Settings → Advanced Audit Policy. Luego revisar Event Viewer en el DC → Security → Event ID 4625 (login fallido) o Event ID 4740 (cuenta bloqueada).

**5. ¿Qué harías si un usuario dice que su cuenta está bloqueada?**
> 1. `Search-ADAccount -LockedOut` para encontrar cuentas bloqueadas. 2. Identificar en qué DC se bloqueó con `Get-ADUser -Identity <usuario> -Properties LockedOut,BadLogonCount,BadPasswordTime`. 3. `Unlock-ADAccount -Identity <usuario>`. 4. Si se repite, revisar el equipo del usuario por malware o credenciales cachadas incorrectas.

**6. ¿Cómo limpias cuentas inactivas de AD?**
> `Search-ADAccount -AccountInactive -TimeSpan 90` para listar cuentas sin login en 90 días. Las deshabilitas primero (`Disable-ADAccount`), las mueves a una OU "Deshabilitados" y después de 30 días las eliminas. Nunca borrar directamente sin un período de gracia.

---

## Próximo Paso

**Lab 05 — Instalación y Configuración de SCCM/MECM**  
El salto más grande de la serie. Prepararás el entorno, instalarás SQL Server, extenderás el schema de AD e instalarás Microsoft Endpoint Configuration Manager.
