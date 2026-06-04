---
title: 'Script PS — PowerShell para SysAdmin'
description: PowerShell para administración de sistemas Windows. Fundamentos, módulo ActiveDirectory, automatización de usuarios y GPOs, recolección de logs con Get-WinEvent, y scripts de soporte.
sidebar:
  label: 'Script: PowerShell'
  badge:
    text: Intermedio
    variant: caution
---

# PowerShell para SysAdmin — De Cmdlets a Automatización

**Prerequisito:** Laboratorios de AD (Labs 01–04) — los scripts de este lab asumen AD DS funcional.  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🚀 Fundamentos de PowerShell

PowerShell trabaja con **objetos**, no solo texto. Cada cmdlet devuelve objetos que puedes manipular, filtrar y exportar.

### Sintaxis básica: Verb-Noun

```powershell
Get-Service                     # Obtener servicios
Start-Service -Name "DNS"       # Iniciar servicio
Stop-Process -Name "notepad"    # Detener proceso
Set-Location -Path "C:\Windows" # Cambiar directorio (equivalente a cd)
Get-Content -Path "C:\log.txt"  # Leer archivo (equivalente a cat)
```

### Pipeline: conectar cmdlets

```powershell
# Filtrar servicios detenidos y ordenarlos por nombre
Get-Service | Where-Object { $_.Status -eq "Stopped" } | Sort-Object Name

# Obtener los 5 procesos que más CPU usan
Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, CPU, WorkingSet

# Exportar resultados a CSV
Get-Service | Export-Csv -Path "C:\services-report.csv" -NoTypeInformation
```

### Variables y tipos

```powershell
$nombre = "Camilo"
$numero = 42
$lista = @("item1", "item2", "item3")
$tabla = @{
    Nombre = "Camilo"
    Cargo = "SysAdmin"
    Ciudad = "Bogotá"
}

# Acceder a propiedades
$tabla.Nombre         # Camilo
$lista[0]             # item1
$lista.Count          # 3
```

### Estructuras de control

```powershell
# Condicional
if ($numero -gt 10) {
    Write-Host "Mayor que 10"
} elseif ($numero -eq 10) {
    Write-Host "Es 10"
} else {
    Write-Host "Menor que 10"
}

# Bucle foreach
foreach ($item in $lista) {
    Write-Host "Procesando: $item"
}

# Bucle for
for ($i = 1; $i -le 10; $i++) {
    Write-Host "Iteración $i"
}

# While
$contador = 0
while ($contador -lt 5) {
    Write-Host "Contador: $contador"
    $contador++
}
```

### Funciones

```powershell
function Crear-Usuario {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Nombre,
        [string]$OU = "OU=Usuarios,DC=corp,DC=local",
        [string]$Contrasena = "Temp@1234!"
    )
    
    $securePass = ConvertTo-SecureString $Contrasena -AsPlainText -Force
    
    New-ADUser `
        -Name $Nombre `
        -SamAccountName $Nombre.ToLower().Replace(" ", ".") `
        -Path $OU `
        -AccountPassword $securePass `
        -Enabled $true
    
    Write-Host "✅ Usuario '$Nombre' creado en $OU"
}

# Uso
Crear-Usuario -Nombre "Juan Perez" -OU "OU=Contabilidad,DC=corp,DC=local"
```

---

## 🏢 Módulo ActiveDirectory

El módulo `ActiveDirectory` viene con las RSAT (Remote Server Administration Tools) o con el rol AD DS.

```powershell
# Instalar módulo (en cliente Windows con RSAT)
Add-WindowsCapability -Online -Name Rsat.ActiveDirectory.DS-LDS.Tools~~~~0.0.1.0

# Verificar que está disponible
Get-Module -ListAvailable -Name ActiveDirectory
Import-Module ActiveDirectory
```

### Gestión de usuarios

```powershell
# Crear usuario
New-ADUser `
    -Name "Ana Lopez" `
    -GivenName "Ana" `
    -Surname "Lopez" `
    -SamAccountName "a.lopez" `
    -UserPrincipalName "a.lopez@corp.local" `
    -Department "Contabilidad" `
    -Title "Analista Contable" `
    -Path "OU=Contabilidad,DC=corp,DC=local" `
    -AccountPassword (ConvertTo-SecureString "Temp@2024!" -AsPlainText -Force) `
    -ChangePasswordAtLogon $true `
    -Enabled $true

# Modificar usuario
Set-ADUser -Identity "a.lopez" -Department "Finanzas" -Title "Senior Analista"

# Deshabilitar usuario (cuando alguien se va)
Disable-ADAccount -Identity "a.lopez"
Move-ADObject -Identity "CN=Ana Lopez,OU=Contabilidad,DC=corp,DC=local" `
    -TargetPath "OU=Deshabilitados,DC=corp,DC=local"

# Resetear contraseña
Set-ADAccountPassword -Identity "a.lopez" `
    -NewPassword (ConvertTo-SecureString "NuevoClave@2024!" -AsPlainText -Force) `
    -Reset

# Desbloquear cuenta
Unlock-ADAccount -Identity "a.lopez"

# Buscar usuarios
Get-ADUser -Filter { Department -eq "Contabilidad" } -Properties Department, Title |
    Select-Object Name, SamAccountName, Department, Title

# Usuarios inactivos (sin login en 90 días)
Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 |
    Where-Object { $_.ObjectClass -eq "user" } |
    Select-Object Name, LastLogonDate, DistinguishedName
```

### Gestión de grupos

```powershell
# Crear grupo
New-ADGroup `
    -Name "GG-Contabilidad" `
    -GroupScope Global `
    -GroupCategory Security `
    -Path "OU=Grupos,DC=corp,DC=local" `
    -Description "Usuarios del departamento de Contabilidad"

# Agregar miembro
Add-ADGroupMember -Identity "GG-Contabilidad" -Members "a.lopez","j.garcia"

# Ver miembros
Get-ADGroupMember -Identity "GG-Contabilidad" | Select-Object Name, SamAccountName

# Ver grupos de un usuario
Get-ADPrincipalGroupMembership -Identity "a.lopez" | Select-Object Name

# Quitar miembro
Remove-ADGroupMember -Identity "GG-Contabilidad" -Members "a.lopez" -Confirm:$false
```

### Creación masiva desde CSV

```powershell
# Estructura del CSV (usuarios.csv):
# Nombre,Apellido,Departamento,OU
# Juan,Perez,Contabilidad,"OU=Contabilidad,DC=corp,DC=local"
# Maria,Garcia,IT,"OU=IT,DC=corp,DC=local"

$usuarios = Import-Csv -Path "C:\usuarios.csv" -Delimiter ","

foreach ($u in $usuarios) {
    $nombre = "$($u.Nombre) $($u.Apellido)"
    $sam = "$($u.Nombre.ToLower()).$($u.Apellido.ToLower())"
    $upn = "$sam@corp.local"
    
    # Verificar si ya existe
    if (Get-ADUser -Filter { SamAccountName -eq $sam } -ErrorAction SilentlyContinue) {
        Write-Warning "⚠️ Usuario $sam ya existe, omitiendo."
        continue
    }
    
    New-ADUser `
        -Name $nombre `
        -GivenName $u.Nombre `
        -Surname $u.Apellido `
        -SamAccountName $sam `
        -UserPrincipalName $upn `
        -Department $u.Departamento `
        -Path $u.OU `
        -AccountPassword (ConvertTo-SecureString "Temp@2024!" -AsPlainText -Force) `
        -ChangePasswordAtLogon $true `
        -Enabled $true
    
    Write-Host "✅ Creado: $nombre ($sam)"
}
```

---

## 📊 Recolección de Logs con Get-WinEvent

`Get-WinEvent` es la herramienta moderna para consultar logs del Event Viewer de Windows.

### Logs importantes para SysAdmin

| Log | Eventos clave | ID de evento |
|---|---|---|
| **Security** | Login exitoso | 4624 |
| **Security** | Login fallido | 4625 |
| **Security** | Cuenta bloqueada | 4740 |
| **Security** | Cambio de contraseña | 4723, 4724 |
| **Security** | Creación de usuario | 4720 |
| **Security** | Eliminación de usuario | 4726 |
| **Security** | Modificación de grupo | 4728, 4729 |
| **System** | Servicio iniciado/detenido | 7036 |
| **Application** | Error de aplicación | 1000 |

### Consultas con Get-WinEvent

```powershell
# Logins fallidos en las últimas 24 horas
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4625
    StartTime = (Get-Date).AddHours(-24)
} | Select-Object TimeCreated, 
    @{N='Usuario'; E={$_.Properties[5].Value}},
    @{N='IP_Origen'; E={$_.Properties[19].Value}},
    Message

# Cuentas bloqueadas hoy
Get-WinEvent -FilterHashtable @{
    LogName = 'Security'
    Id = 4740
    StartTime = (Get-Date).Date
} | Select-Object TimeCreated, @{N='Cuenta'; E={$_.Properties[0].Value}}

# Errores del sistema en las últimas 2 horas
Get-WinEvent -FilterHashtable @{
    LogName = 'System'
    Level = 2  # Error
    StartTime = (Get-Date).AddHours(-2)
} | Select-Object TimeCreated, Id, ProviderName, Message | Format-Table -AutoSize

# Ver logs de múltiples equipos remotos
$equipos = @("WKSTN-01", "WKSTN-02", "DC01")
foreach ($equipo in $equipos) {
    Get-WinEvent -ComputerName $equipo -FilterHashtable @{
        LogName = 'System'; Level = 2
        StartTime = (Get-Date).AddHours(-1)
    } -ErrorAction SilentlyContinue |
    Add-Member -NotePropertyName "Equipo" -NotePropertyValue $equipo -PassThru
}
```

### Script de recolección automática de logs (herramienta real)

Este es el tipo de script que reduce la recolección de logs de 30 a 5 minutos:

```powershell
# Collect-SystemLogs.ps1
# Recolecta logs de error de múltiples servidores y genera un reporte HTML

param(
    [string[]]$Servidores = @("DC01", "SCCM01", "WKSTN-01"),
    [int]$HorasAtras = 24,
    [string]$RutaReporte = "C:\Reportes\logs-$(Get-Date -Format 'yyyyMMdd-HHmm').html"
)

$inicio = Get-Date
$resultados = @()

foreach ($servidor in $Servidores) {
    Write-Progress -Activity "Recolectando logs" -Status "Procesando $servidor" `
        -PercentComplete (($Servidores.IndexOf($servidor) / $Servidores.Count) * 100)
    
    try {
        $eventos = Get-WinEvent -ComputerName $servidor -FilterHashtable @{
            LogName = @('System', 'Application')
            Level = @(1, 2)  # Critical y Error
            StartTime = (Get-Date).AddHours(-$HorasAtras)
        } -ErrorAction Stop
        
        foreach ($evento in $eventos) {
            $resultados += [PSCustomObject]@{
                Servidor     = $servidor
                Tiempo       = $evento.TimeCreated
                Log          = $evento.LogName
                Proveedor    = $evento.ProviderName
                EventId      = $evento.Id
                Nivel        = switch ($evento.Level) { 1 {"Crítico"} 2 {"Error"} }
                Mensaje      = $evento.Message.Substring(0, [Math]::Min(200, $evento.Message.Length))
            }
        }
        Write-Host "✅ $servidor`: $($eventos.Count) eventos" -ForegroundColor Green
    }
    catch {
        Write-Warning "❌ No se pudo conectar a $servidor`: $_"
        $resultados += [PSCustomObject]@{
            Servidor  = $servidor
            Tiempo    = Get-Date
            Log       = "CONNECTION"
            Proveedor = "Script"
            EventId   = 0
            Nivel     = "Error"
            Mensaje   = "No se pudo conectar: $_"
        }
    }
}

# Generar reporte HTML
$html = @"
<html><head><title>Reporte de Logs</title>
<style>
body {font-family: Arial; font-size: 12px;}
table {border-collapse: collapse; width: 100%;}
th {background: #336699; color: white; padding: 5px;}
td {border: 1px solid #ccc; padding: 4px;}
tr:nth-child(even) {background: #f9f9f9;}
.critico {color: red; font-weight: bold;}
.error {color: orange;}
</style></head>
<body>
<h2>Reporte de Logs — $(Get-Date -Format 'dd/MM/yyyy HH:mm')</h2>
<p>Servidores: $($Servidores -join ', ') | Período: últimas $HorasAtras horas | Total eventos: $($resultados.Count)</p>
$($resultados | ConvertTo-Html -Fragment | Out-String)
</body></html>
"@

New-Item -ItemType Directory -Path (Split-Path $RutaReporte) -Force | Out-Null
$html | Out-File -FilePath $RutaReporte -Encoding UTF8

$duracion = (Get-Date) - $inicio
Write-Host "✅ Reporte generado en: $RutaReporte (en $([Math]::Round($duracion.TotalSeconds))s)"
Start-Process $RutaReporte  # Abre el reporte en el navegador
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué diferencia hay entre PowerShell y CMD (Command Prompt)?**
> CMD es el intérprete clásico de comandos, trabaja con texto. PowerShell trabaja con objetos .NET: los cmdlets devuelven objetos que puedes filtrar, ordenar y transformar con el pipeline. PowerShell tiene acceso a todo el framework .NET, WMI, COM objects y módulos como ActiveDirectory. Para administración de sistemas Windows modernos, PowerShell es claramente superior.

**2. Escribiste una herramienta en PowerShell que redujo la recolección de logs de 30 a 5 minutos. ¿Cómo funciona?**
> El script usa `Get-WinEvent` con `FilterHashtable` para consultar Event Viewer en múltiples servidores remotos simultáneamente (o en bucle), filtrando por niveles de error y rango de tiempo. Los resultados se consolidan en un array de objetos y se exportan a un reporte HTML o CSV. La automatización elimina el trabajo manual de conectarse a cada servidor individualmente y copiar/pegar logs.

**3. ¿Cómo crearías 100 usuarios en AD desde un CSV con PowerShell?**
> `Import-Csv usuarios.csv | ForEach-Object { New-ADUser -Name "$($_.Nombre) $($_.Apellido)" -SamAccountName $_.Sam -Path $_.OU -AccountPassword (ConvertTo-SecureString "Temp@2024!" -AsPlainText -Force) -Enabled $true }`. Siempre incluir validación para no crear duplicados (`Get-ADUser` antes de `New-ADUser`) y logging de resultados.

**4. ¿Cómo detectarías con PowerShell qué cuentas de AD llevan más de 90 días sin iniciar sesión?**
> `Search-ADAccount -AccountInactive -TimeSpan 90.00:00:00 | Where-Object {$_.ObjectClass -eq 'user'} | Select-Object Name, LastLogonDate, DistinguishedName`. Esto devuelve usuarios que no han hecho login en 90 días. El siguiente paso sería deshabilitarlos con `Disable-ADAccount`.

**5. ¿Qué es el pipeline en PowerShell y por qué es poderoso?**
> El pipeline (`|`) pasa los objetos de salida de un cmdlet como entrada al siguiente. Es poderoso porque: 1) Encadena operaciones complejas en una línea. 2) Trabaja con objetos reales, no texto — no necesitas parsear strings. 3) Es lazy (procesa objeto por objeto, no carga todo en memoria). Ejemplo: `Get-ADUser -Filter * | Where-Object {!$_.Enabled} | Remove-ADUser` — filtra y borra usuarios deshabilitados en una cadena.

**6. ¿Cómo ejecutarías un script de PowerShell en múltiples equipos remotamente?**
> Con `Invoke-Command`: `Invoke-Command -ComputerName @("PC01","PC02","PC03") -ScriptBlock { Get-Service | Where-Object {$_.Status -eq "Stopped"} }`. Requiere WinRM habilitado en los destinos (`Enable-PSRemoting -Force`). Para entornos grandes, también se puede usar `PsSession` para conexiones persistentes o distribuir via GPO/SCCM.
