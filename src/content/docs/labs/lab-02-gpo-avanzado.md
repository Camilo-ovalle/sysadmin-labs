---
title: "Lab 02 — GPO Avanzado"
description: GPOs de seguridad para usuarios y máquinas, Loopback Processing, Security Filtering, AppLocker y diagnóstico con gpresult.
sidebar:
  label: "Lab 02: GPO Avanzado"
  badge:
    text: Intermedio
    variant: caution
---

# Lab 02 — GPO Avanzado: Políticas para Usuarios y Máquinas

**Prerequisito:** Tener el Lab 01 completado (DC funcional con AD DS, dominio `corp.local`, OUs base y al menos 1 cliente unido al dominio).

**Duración estimada:** 3-4 horas  
**Dificultad:** Intermedio

---

## Objetivos del Laboratorio

- Aplicar GPOs de seguridad reales en usuarios y máquinas
- Entender la diferencia entre `Computer Configuration` y `User Configuration`
- Usar Loopback Processing para forzar políticas de usuario según la máquina
- Aplicar Security Filtering para que una política aplique solo a ciertos grupos
- Entender GPO Precedence, herencia y bloqueo
- Usar `gpresult` y RSOP para diagnosticar políticas

---

## Arquitectura del Lab

```
Red interna: 192.168.100.0/24

┌────────────────────────────┐
│  DC — corp.local           │
│  Windows Server 2022       │
│  IP: 192.168.100.10        │
│  Roles: AD DS + DNS + GPMC │
└────────────┬───────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────┴──────┐  ┌──────┴─────┐
│  WKSTN-01 │  │  WKSTN-02  │
│  Win 10/11│  │  Win 10/11 │
│  OU: IT   │  │  OU: RRHH  │
└───────────┘  └────────────┘
```

**Estructura de OUs recomendada para este lab:**

```
corp.local
├── _Corporativo
│   ├── IT
│   │   ├── Computadoras
│   │   └── Usuarios
│   ├── RRHH
│   │   ├── Computadoras
│   │   └── Usuarios
│   ├── Contabilidad
│   │   ├── Computadoras
│   │   └── Usuarios
│   └── Servidores
└── _Admin
    └── Cuentas de Servicio
```

> **Nota:** Los guiones bajos (`_`) hacen que estas OUs aparezcan primero en la lista, facilitando la navegación.

---

## Parte 1: Configurar la Estructura de OUs

### 1.1 Crear la jerarquía de OUs

**Vía GUI — Active Directory Users and Computers (`dsa.msc`):**

1. En el DC, abre el menú inicio → **Windows Administrative Tools** → **Active Directory Users and Computers**
2. Clic derecho sobre `corp.local` → **New** → **Organizational Unit**
3. Nombre: `_Corporativo` → marca **Protect container from accidental deletion** → OK
4. Repite para crear `_Admin` directamente bajo `corp.local`
5. Clic derecho sobre `_Corporativo` → **New** → **Organizational Unit** → crea: `IT`, `RRHH`, `Contabilidad`, `Servidores`
6. Dentro de `IT`: clic derecho → **New** → **OU** → `Computadoras`, luego `Usuarios`
7. Repite el paso 6 dentro de `RRHH` y `Contabilidad`
8. Dentro de `_Admin`: crea la OU `Cuentas de Servicio`

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
# Ejecutar en PowerShell (DC) como administrador
New-ADOrganizationalUnit -Name "_Corporativo" -Path "DC=corp,DC=local" -ProtectedFromAccidentalDeletion $true
New-ADOrganizationalUnit -Name "_Admin" -Path "DC=corp,DC=local" -ProtectedFromAccidentalDeletion $true

$ouBase = "OU=_Corporativo,DC=corp,DC=local"
foreach ($dept in @("IT", "RRHH", "Contabilidad", "Servidores")) {
    New-ADOrganizationalUnit -Name $dept -Path $ouBase -ProtectedFromAccidentalDeletion $true
}

foreach ($dept in @("IT", "RRHH", "Contabilidad")) {
    $ouPath = "OU=$dept,$ouBase"
    New-ADOrganizationalUnit -Name "Computadoras" -Path $ouPath
    New-ADOrganizationalUnit -Name "Usuarios" -Path $ouPath
}

New-ADOrganizationalUnit -Name "Cuentas de Servicio" -Path "OU=_Admin,DC=corp,DC=local"
```

</details>

### 1.2 Crear usuarios de prueba

**Vía GUI — Active Directory Users and Computers:**

1. Expande `_Corporativo > IT > Usuarios`
2. Clic derecho en la OU `Usuarios` → **New** → **User**
3. Completa los campos:
   - First name: `Juan` / Last name: `Tecnico`
   - User logon name: `jtecnico`
4. Siguiente → establece contraseña `P@ssw0rd2024!` → desmarca "User must change password at next logon" para el lab → Finish
5. Repite el proceso en `RRHH > Usuarios` para `mrrhh` (Maria RRHH)
6. Repite en `Contabilidad > Usuarios` para `pcontador` (Pedro Contador)

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
$password = ConvertTo-SecureString "P@ssw0rd2024!" -AsPlainText -Force

New-ADUser -Name "Juan Tecnico" -GivenName "Juan" -Surname "Tecnico" `
    -SamAccountName "jtecnico" -UserPrincipalName "jtecnico@corp.local" `
    -Path "OU=Usuarios,OU=IT,OU=_Corporativo,DC=corp,DC=local" `
    -AccountPassword $password -Enabled $true

New-ADUser -Name "Maria RRHH" -GivenName "Maria" -Surname "RRHH" `
    -SamAccountName "mrrhh" -UserPrincipalName "mrrhh@corp.local" `
    -Path "OU=Usuarios,OU=RRHH,OU=_Corporativo,DC=corp,DC=local" `
    -AccountPassword $password -Enabled $true

New-ADUser -Name "Pedro Contador" -GivenName "Pedro" -Surname "Contador" `
    -SamAccountName "pcontador" -UserPrincipalName "pcontador@corp.local" `
    -Path "OU=Usuarios,OU=Contabilidad,OU=_Corporativo,DC=corp,DC=local" `
    -AccountPassword $password -Enabled $true
```

</details>

### 1.3 Mover los equipos clientes a sus OUs

**Vía GUI — Active Directory Users and Computers:**

1. Expande el contenedor `Computers` — ahí están los equipos recién unidos al dominio
2. Clic derecho sobre `WKSTN-01` → **Move**
3. En el árbol selecciona: `corp.local > _Corporativo > IT > Computadoras` → OK
4. Repite para `WKSTN-02` → moverlo a `_Corporativo > RRHH > Computadoras`

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
Move-ADObject -Identity "CN=WKSTN-01,CN=Computers,DC=corp,DC=local" `
    -TargetPath "OU=Computadoras,OU=IT,OU=_Corporativo,DC=corp,DC=local"

Move-ADObject -Identity "CN=WKSTN-02,CN=Computers,DC=corp,DC=local" `
    -TargetPath "OU=Computadoras,OU=RRHH,OU=_Corporativo,DC=corp,DC=local"
```

</details>

---

## Parte 2: GPO de Seguridad para Cuentas (Password Policy)

> **Importante:** La **Default Domain Policy** se edita solo para la password policy base que aplica a todos. Para políticas por grupo usa **Fine-Grained Password Policies** (Lab 04).

### 2.1 Editar la Default Domain Policy

**Vía GUI — Group Policy Management (`gpmc.msc`):**

1. En el DC, abre **Group Policy Management**
2. Expande `Bosque: corp.local > Dominios > corp.local`
3. Clic derecho en **Default Domain Policy** → **Edit**
4. Navega a:
   ```
   Computer Configuration
     └── Policies
          └── Windows Settings
               └── Security Settings
                    └── Account Policies
                         └── Password Policy
   ```

Configura los siguientes valores (doble clic en cada política → Define this policy setting → ingresa el valor):

| Política | Valor recomendado |
|---|---|
| Enforce password history | 10 contraseñas |
| Maximum password age | 90 días |
| Minimum password age | 1 día |
| Minimum password length | 12 caracteres |
| Password must meet complexity requirements | Enabled |
| Store passwords using reversible encryption | Disabled |

5. En el mismo árbol, ve a **Account Lockout Policy**:

| Política | Valor |
|---|---|
| Account lockout duration | 15 minutos |
| Account lockout threshold | 5 intentos inválidos |
| Reset account lockout counter after | 15 minutos |

### 2.2 Verificar la política

En el cliente, después de `gpupdate /force`:
```cmd
net accounts
```
Debe mostrar los valores configurados.

---

## Parte 3: GPO para Máquinas (Computer Configuration)

Crearemos un GPO que se aplique a **todas las máquinas** de la OU `_Corporativo`.

### 3.1 Crear el GPO base de máquinas

**Vía GUI — Group Policy Management:**

1. Clic derecho sobre la OU `_Corporativo` → **Create a GPO in this domain, and Link it here**
2. Nombre: `CORP - Configuracion Base Maquinas` → OK
3. Clic derecho en el GPO recién creado → **Edit**

### 3.2 Configuraciones de seguridad para máquinas

Todas las siguientes configuraciones se hacen dentro del editor del GPO `CORP - Configuracion Base Maquinas`:

**a) Deshabilitar AutoPlay/AutoRun:**
```
Computer Configuration > Policies > Administrative Templates
  > Windows Components > AutoPlay Policies
  > Turn off Autoplay
```
→ Doble clic → **Enabled** → en el menú desplegable selecciona **All drives** → OK

**b) Deshabilitar USB Storage:**
```
Computer Configuration > Policies > Administrative Templates
  > System > Removable Storage Access
  > All Removable Storage classes: Deny all access
```
→ Doble clic → **Enabled** → OK

**c) Configurar NTP (sincronización de tiempo):**
```
Computer Configuration > Policies > Administrative Templates
  > System > Windows Time Service > Time Providers
  > Configure Windows NTP Client
```
→ Doble clic → **Enabled** → en `NtpServer` escribe `192.168.100.10,0x1` → en `Type` selecciona `NTP` → OK

**d) Deshabilitar SMBv1 (seguridad crítica) vía Registro:**
```
Computer Configuration > Preferences > Windows Settings > Registry
```
→ Clic derecho → **New** → **Registry Item**:

| Campo | Valor |
|---|---|
| Action | Update |
| Hive | HKEY_LOCAL_MACHINE |
| Key Path | `SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters` |
| Value name | `SMB1` |
| Value type | REG_DWORD |
| Value data | `0` (hexadecimal) |

→ OK

**e) Pantalla de bloqueo por inactividad:**
```
Computer Configuration > Policies > Windows Settings
  > Security Settings > Local Policies > Security Options
  > Interactive logon: Machine inactivity limit
```
→ Doble clic → **Define this policy setting** → escribe `900` (15 minutos en segundos) → OK

**f) Auditoría avanzada de eventos:**
```
Computer Configuration > Policies > Windows Settings
  > Security Settings > Advanced Audit Policy Configuration
  > Audit Policies
```

Habilita cada categoría haciendo doble clic → marcar **Configure the following audit events**:

| Categoría | Subcategoría | Configuración |
|---|---|---|
| Account Logon | Credential Validation | Success, Failure |
| Account Management | User Account Management | Success, Failure |
| Logon/Logoff | Logon | Success, Failure |
| Object Access | File System | Success, Failure |
| Policy Change | Audit Policy Change | Success |
| Privilege Use | Sensitive Privilege Use | Success, Failure |

---

## Parte 4: GPO para Usuarios (User Configuration)

### 4.1 GPO para RRHH — Restricciones de escritorio

**Vía GUI — Group Policy Management:**

1. Clic derecho sobre la OU `RRHH` (dentro de `_Corporativo`) → **Create a GPO in this domain, and Link it here**
2. Nombre: `RRHH - Restricciones Usuario` → OK
3. Clic derecho → **Edit** → trabaja en la sección `User Configuration`

**a) Ocultar el Panel de Control:**
```
User Configuration > Policies > Administrative Templates
  > Control Panel
  > Prohibit access to Control Panel and PC settings
```
→ Doble clic → **Enabled** → OK

**b) Deshabilitar el Símbolo del sistema:**
```
User Configuration > Policies > Administrative Templates
  > System
  > Prevent access to the command prompt
```
→ Doble clic → **Enabled** → en "Disable the command prompt script processing also" selecciona **No** → OK

**c) Deshabilitar el Administrador de Tareas:**
```
User Configuration > Policies > Administrative Templates
  > System > Ctrl+Alt+Del Options
  > Remove Task Manager
```
→ Doble clic → **Enabled** → OK

**d) Configurar fondo de pantalla corporativo:**
```
User Configuration > Policies > Administrative Templates
  > Desktop > Desktop
  > Desktop Wallpaper
```
→ Doble clic → **Enabled** → en `Wallpaper Name` escribe:
`\\corp.local\SYSVOL\corp.local\wallpaper\corporativo.jpg`  
→ en `Wallpaper Style` selecciona `Fill` → OK

> Primero copia una imagen JPG a la carpeta `\\192.168.100.10\SYSVOL\corp.local\wallpaper\` (créala si no existe).

**e) Redirigir Mis Documentos a servidor de archivos:**
```
User Configuration > Policies > Windows Settings > Folder Redirection
  > Documents > clic derecho > Properties
```
→ Setting: **Basic - Redirect everyone's folder to the same location**  
→ Target folder location: **Create a folder for each user under the root path**  
→ Root Path: `\\192.168.100.10\Redirection\`  
→ OK

> Crea la carpeta `C:\Redirection` en el DC y compártela como `Redirection`. Los permisos del share deben ser `Full Control` para `Authenticated Users` (el control real lo harán los permisos NTFS).

### 4.2 GPO para IT — Acceso ampliado y unidades de red

**Vía GUI:**

1. Clic derecho sobre la OU `IT` → **Create a GPO in this domain, and Link it here**
2. Nombre: `IT - Acceso Herramientas Admin` → OK
3. Edita el GPO → `User Configuration`

**Mapear unidades de red por login:**
```
User Configuration > Preferences > Windows Settings > Drive Maps
```
→ Clic derecho → **New** → **Mapped Drive**:

| Campo | Valor |
|---|---|
| Action | Update |
| Location | `\\192.168.100.10\IT-Share` |
| Drive Letter | I: |
| Label as | IT Resources |
| Reconnect | Marcado |

→ OK

---

## Parte 5: Loopback Processing

**Escenario:** En las máquinas de RRHH, cualquier usuario que inicie sesión (incluyendo admins) recibirá las políticas de usuario de RRHH, sin importar su OU.

**Vía GUI — dentro del GPO `RRHH - Restricciones Usuario`:**

1. Clic derecho en el GPO → **Edit**
2. Navega a:
   ```
   Computer Configuration > Policies > Administrative Templates
     > System > Group Policy
     > Configure user Group Policy loopback processing mode
   ```
3. Doble clic → **Enabled** → Mode: **Replace** → OK

**Diferencia entre modos:**
- **Merge:** Aplica políticas del usuario más las de la máquina. Las de máquina ganan en conflicto.
- **Replace:** Solo aplica las políticas de usuario del GPO vinculado a la OU de la máquina. Ignora las del usuario.

> Usa **Replace** para kioscos. Usa **Merge** cuando quieres añadir restricciones sin eliminar las del usuario.

---

## Parte 6: Security Filtering

**Escenario:** Un GPO debe aplicar solo a los miembros del grupo `GRP_Consultores`, no a todos los de la OU.

### 6.1 Crear el grupo de prueba

**Vía GUI — Active Directory Users and Computers:**

1. Clic derecho en `_Corporativo > IT` → **New** → **Group**
2. Group name: `GRP_Consultores`
3. Group scope: **Global** / Group type: **Security** → OK
4. Doble clic en el grupo recién creado → pestaña **Members** → **Add** → agrega `jtecnico` → OK

<details>
<summary>⚡ PowerShell — mismo resultado en menos pasos</summary>

```powershell
New-ADGroup -Name "GRP_Consultores" -GroupScope Global -GroupCategory Security `
    -Path "OU=IT,OU=_Corporativo,DC=corp,DC=local"
Add-ADGroupMember -Identity "GRP_Consultores" -Members "jtecnico"
```

</details>

### 6.2 Aplicar Security Filtering al GPO

**Vía GUI — Group Policy Management:**

1. Selecciona el GPO al que quieres aplicar el filtro
2. En la pestaña **Scope**, sección **Security Filtering**:
   - Selecciona `Authenticated Users` → clic en **Remove**
   - Clic en **Add** → escribe `GRP_Consultores` → OK
3. Ve a la pestaña **Delegation** → clic en **Advanced**:
   - Selecciona `Authenticated Users` → verifica que tiene **Read** = **Allow** (necesario para que el GPO se descargue)
   - **Apply Group Policy** para `Authenticated Users` = **Deny** (o sin marcar)
   - Para `GRP_Consultores`: **Apply Group Policy** = **Allow**
4. OK → confirma el cambio

> **Por qué importa:** Sin `Read` para `Authenticated Users`, los equipos ni siquiera descargan el GPO, lo que genera errores de procesamiento en el cliente.

---

## Parte 7: GPO Precedence y Block Inheritance

### 7.1 Entender el orden de aplicación

Los GPOs se aplican en este orden — **el último en aplicar tiene mayor precedencia**:

```
1. Local Group Policy (en el equipo local)
2. Site GPOs
3. Domain GPOs (Default Domain Policy)
4. OU padre → OU hijo → OU nieto (de mayor a menor)
```

Si una OU hija define el mismo valor que la OU padre, **gana la OU hija**.

### 7.2 Block Inheritance

**Vía GUI — Group Policy Management:**

1. Clic derecho sobre la OU `IT` → **Block Inheritance**
2. La OU mostrará un ícono con signo de exclamación azul

> Úsalo con precaución: puede dejar sin efecto políticas de seguridad críticas. Prefiere **Security Filtering** siempre que sea posible.

### 7.3 Enforced (No Override)

Fuerza que un GPO tenga la mayor precedencia, incluso sobre Block Inheritance.

**Vía GUI:**

1. En **Group Policy Management**, clic derecho sobre el **enlace** del GPO (no sobre el GPO en sí) → **Enforced**
2. El ícono del enlace cambia a un candado naranja

> Úsalo para políticas de seguridad corporativa que nadie debe poder sobrescribir.

---

## Parte 8: Diagnóstico y Verificación

### 8.1 Verificar en el cliente

```powershell
# Ver resumen de GPOs aplicados (usuario y máquina)
gpresult /r

# Generar reporte HTML completo
gpresult /h C:\GPOReport.html
# Abre el archivo HTML en el navegador para ver el detalle completo

# Ver solo máquina con detalle
gpresult /scope computer /v

# Ver solo usuario con detalle
gpresult /scope user /v
```

### 8.2 RSOP (Resultant Set of Policy) — GUI

**Vía GUI — Group Policy Management (desde el DC):**

1. Clic derecho sobre el dominio `corp.local` → **Group Policy Results**
2. Sigue el asistente: selecciona el equipo cliente y el usuario
3. GPMC genera un reporte HTML con todas las políticas efectivas, origen y conflictos

### 8.3 Forzar aplicación inmediata

```powershell
# Forzar todas las políticas (usuario y máquina)
gpupdate /force

# Solo políticas de máquina
gpupdate /target:computer /force

# Solo políticas de usuario
gpupdate /target:user /force
```

### 8.4 Verificar GPOs desde el DC

```powershell
# Ver herencia de GPOs en una OU
Get-GPInheritance -Target "OU=RRHH,OU=_Corporativo,DC=corp,DC=local"

# Ver todos los GPOs del dominio
Get-GPO -All | Select-Object DisplayName, GpoStatus, CreationTime
```

---

## Parte 9: GPO de Restricción de Software (AppLocker)

**Escenario:** Los usuarios de RRHH no pueden ejecutar aplicaciones desde sus carpetas personales.

### 9.1 Crear GPO con AppLocker

**Vía GUI:**

1. Crea un nuevo GPO en la OU `RRHH` → nombre: `RRHH - AppLocker`
2. Edita el GPO y navega a:
   ```
   Computer Configuration > Policies > Windows Settings
     > Security Settings > Application Control Policies > AppLocker
   ```
3. Clic derecho en **Executable Rules** → **Create Default Rules**  
   (Esto crea reglas que permiten a todos ejecutar archivos de `C:\Windows` y `C:\Program Files`)
4. Clic derecho en **Executable Rules** → **Create New Rule**:
   - Action: **Deny**
   - User or group: `Everyone`
   - Conditions: **Path**
   - Path: `%USERPROFILE%\Downloads\*`
   → Siguiente → Siguiente → **Create**

### 9.2 Habilitar el servicio Application Identity vía GPO

**Vía GUI — dentro del mismo GPO:**

```
Computer Configuration > Preferences > Control Panel Settings > Services
```
→ Clic derecho → **New** → **Service**:

| Campo | Valor |
|---|---|
| Startup type | Automatic |
| Service name | `AppIDSvc` |
| Service action | Start service |

→ OK

### 9.3 Verificar AppLocker

```powershell
# Ver reglas AppLocker efectivas en el cliente
Get-AppLockerPolicy -Effective | Test-AppLockerPolicy `
    -Path "C:\Users\mrrhh\Downloads\app.exe" -User Everyone
```

---

## Troubleshooting Común

| Problema | Causa probable | Solución |
|---|---|---|
| GPO no aplica | Equipo en OU incorrecta | Verificar en ADUC dónde está el objeto equipo |
| GPO no aplica | Security Filtering mal configurado | Verificar grupo filtrado y permiso Read |
| `gpupdate /force` falla | DNS no resuelve el dominio | Verificar DNS del cliente: `nslookup corp.local` |
| Políticas de usuario no aplican en máquina | Loopback mal configurado | Verificar que esté en Computer Config y vinculado a la OU de la máquina |
| AppLocker no bloquea | Servicio AppIDSvc no corre | Iniciar servicio manualmente o verificar el paso de GPO |
| Block Inheritance ignorado | GPO padre tiene Enforced | Esperado — es el comportamiento diseñado |

---

## Resumen de GPOs del Laboratorio

| GPO | Vinculado a | Tipo | Descripción |
|---|---|---|---|
| Default Domain Policy | corp.local | Computer | Password y lockout policy base |
| CORP - Configuracion Base Maquinas | _Corporativo | Computer | Seguridad base para todas las máquinas |
| RRHH - Restricciones Usuario | OU RRHH | User + Computer | Restricciones UI + Loopback Processing |
| IT - Acceso Herramientas Admin | OU IT | User | Unidades de red y acceso ampliado |
| RRHH - AppLocker | OU RRHH | Computer | Bloqueo de ejecución desde carpetas personales |

---

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué es el Loopback Processing y cuándo lo usarías?**
> Permite que las políticas de `User Configuration` del GPO vinculado a la OU del *equipo* (no del usuario) se apliquen al usuario que inicia sesión en ese equipo. Caso real: kioscos, salas de reunión o laboratorios donde quieres políticas restrictivas independientemente de qué usuario inicia sesión.

**2. ¿Cuál es la diferencia entre Loopback Replace y Loopback Merge?**
> `Replace`: solo se aplican las políticas de usuario del GPO del equipo, descartando las del usuario. `Merge`: se combinan ambas; si hay conflicto, gana la del equipo.

**3. ¿Qué es Security Filtering en GPO?**
> Limita a qué objetos (usuarios, equipos, grupos) aplica una GPO dentro de su alcance. Por defecto aplica a "Authenticated Users". Al filtrar por un grupo de seguridad, solo los miembros de ese grupo reciben la política.

**4. Si enlazas una GPO a un dominio y también a una OU hija, y hay conflicto, ¿quién gana?**
> La GPO de la OU, porque el orden de precedencia LSDOU da más peso a las OUs más cercanas al objeto. A mayor profundidad de OU, mayor prioridad.

**5. ¿Cómo bloqueas la herencia de GPOs en una OU?**
> Clic derecho en la OU en GPMC → "Block Inheritance". Las GPOs del dominio y sitios superiores no llegarán. Las GPOs con "Enforced" (forzadas) sí penetran el bloqueo.

**6. ¿Qué es AppLocker y en qué se diferencia de SRP (Software Restriction Policies)?**
> AppLocker (Windows 7+) usa reglas por publisher, path o hash de archivo; es más granular, auditable y soporta reglas por usuario/grupo. SRP es la versión anterior, menos flexible. AppLocker requiere licencia Enterprise.

**7. ¿Cómo diagnosticarías por qué una GPO no se aplica a un equipo?**
> 1. `gpresult /h report.html` en el cliente → ver si la GPO aparece en "Denied GPOs" y el motivo. 2. Verificar que el equipo está en la OU correcta. 3. Revisar Security Filtering. 4. Comprobar que SYSVOL replica correctamente con `repadmin /showrepl`. 5. Revisar Event Viewer → Group Policy en el cliente.

---

## Próximo Paso

**Lab 03 — Grupos AD y Control de Acceso Basado en Roles (RBAC)**  
Aprenderás la estrategia AGDLP, crear grupos departamentales, delegar control en OUs y gestionar permisos de recursos compartidos.
