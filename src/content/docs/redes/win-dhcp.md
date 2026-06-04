---
title: 'Lab DHCP — DHCP en Windows Server'
description: Instalación y configuración del rol DHCP en Windows Server 2022. Scopes, reservas, opciones, relay DHCP para VLANs, failover y autorización en AD.
sidebar:
  label: 'Lab DHCP: Windows DHCP Server'
  badge:
    text: Intermedio
    variant: caution
---

# Lab DHCP — DHCP en Windows Server

**Prerequisito:** DC con AD DS y DNS configurados. Es recomendable tener DNS funcionando (Lab DNS) antes de este lab, ya que DHCP puede actualizar registros DNS dinámicamente.  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🏗️ ¿Cómo funciona DHCP?

**Dynamic Host Configuration Protocol** asigna automáticamente IPs, máscara, gateway y DNS a los clientes, eliminando la gestión manual de IPs.

```
Cliente (sin IP)          Servidor DHCP
    │                          │
    │──── DHCPDISCOVER ────────▶│  Broadcast: "¿hay un servidor DHCP?"
    │◀─── DHCPOFFER ───────────│  "Sí, te ofrezco 192.168.100.50"
    │──── DHCPREQUEST ─────────▶│  "Acepto esa IP"
    │◀─── DHCPACK ─────────────│  "Confirmado, es tuya por 8 días"
```

El proceso se conoce como **DORA**: Discover → Offer → Request → Acknowledge.

---

## 🖥️ Parte 1: Instalar el Rol DHCP

### 1.1 Agregar el rol

```powershell
# PowerShell (recomendado)
Install-WindowsFeature DHCP -IncludeManagementTools

# O via Server Manager → Add Roles and Features → DHCP Server
```

### 1.2 Autorizar el servidor DHCP en Active Directory

**Importante:** en un entorno AD, un servidor DHCP debe estar **autorizado** para funcionar. Esto evita que equipos no autorizados actúen como servidores DHCP rogue.

```powershell
# Autorizar el servidor DHCP (reemplaza con tu IP y nombre de servidor)
Add-DhcpServerInDC -DnsName "DC01.corp.local" -IPAddress "192.168.100.10"

# Verificar autorización
Get-DhcpServerInDC
```

O desde la consola: **DHCP** → clic derecho en el servidor → **Authorize**.

### 1.3 Configurar seguridad post-instalación

```powershell
# Agrega las cuentas correctas a los grupos de DHCP
netsh dhcp add securitygroups

# Reiniciar el servicio
Restart-Service DHCPServer
```

---

## 📋 Parte 2: Crear un Scope (Ámbito DHCP)

Un **scope** define el rango de IPs que el servidor puede asignar para una red/VLAN.

### 2.1 Crear el scope principal

```powershell
# Crear scope para la red 192.168.100.0/24
Add-DhcpServerv4Scope `
    -Name "Corp LAN - 192.168.100.x" `
    -StartRange "192.168.100.100" `
    -EndRange "192.168.100.200" `
    -SubnetMask "255.255.255.0" `
    -LeaseDuration "8.00:00:00" `
    -State "Active"
```

**Parámetros clave:**
- `StartRange` / `EndRange`: el rango de IPs dinámicas disponibles
- `SubnetMask`: máscara de la red
- `LeaseDuration`: tiempo que el cliente puede usar la IP antes de renovar (8 días es el estándar)

### 2.2 Exclusiones en el scope

Las IPs que ya tienes asignadas estáticamente (DCs, servidores, impresoras) **deben excluirse** del rango dinámico para evitar conflictos:

```powershell
# Excluir las IPs de servidores (10–99)
Add-DhcpServerv4ExclusionRange `
    -ScopeId "192.168.100.0" `
    -StartRange "192.168.100.10" `
    -EndRange "192.168.100.99"
```

### 2.3 Opciones del scope (DHCP Options)

Las opciones configuran qué información adicional recibe el cliente junto con la IP:

| Opción | Número | Descripción |
|---|---|---|
| **Router (Gateway)** | 003 | IP del gateway de salida |
| **DNS Servers** | 006 | IPs de los servidores DNS |
| **DNS Domain Name** | 015 | Sufijo DNS del dominio (`corp.local`) |
| **NTP Server** | 042 | Servidor de tiempo |
| **TFTP Server** | 066 | Para PXE boot (SCCM) |
| **Bootfile** | 067 | Nombre del archivo de arranque PXE |

```powershell
# Configurar opciones del scope
Set-DhcpServerv4OptionValue `
    -ScopeId "192.168.100.0" `
    -Router "192.168.100.1" `
    -DnsServer "192.168.100.10","192.168.100.11" `
    -DnsDomain "corp.local"
```

---

## 🔒 Parte 3: Reservas DHCP

Las **reservas** asignan siempre la misma IP a un equipo específico, identificado por su dirección MAC. Útil para servidores, impresoras o equipos que necesitan IP fija pero gestionada centralmente.

### 3.1 Crear una reserva

```powershell
# Reservar 192.168.100.50 para la impresora con MAC 00-11-22-33-44-55
Add-DhcpServerv4Reservation `
    -ScopeId "192.168.100.0" `
    -IPAddress "192.168.100.50" `
    -ClientId "00-11-22-33-44-55" `
    -Name "Impresora-Contabilidad" `
    -Description "HP LaserJet en sala de contabilidad"
```

### 3.2 Ver todas las reservas

```powershell
Get-DhcpServerv4Reservation -ScopeId "192.168.100.0"
```

---

## 🌐 Parte 4: DHCP por VLAN y DHCP Relay

En entornos con **múltiples VLANs**, el servidor DHCP generalmente está en una sola VLAN. Los clientes en otras VLANs no pueden llegar al servidor por broadcast (los broadcasts no cruzan routers/VLANs).

**Solución: DHCP Relay Agent (Helper Address)**

```
VLAN 10 (192.168.10.x)    VLAN 20 (192.168.20.x)
       │                         │
       │ DHCP Discover           │ DHCP Discover
       ▼                         ▼
    Router / L3 Switch ── (DHCP Relay) ──▶ Servidor DHCP (VLAN 100)
```

### 4.1 Configurar scopes para múltiples VLANs

Crea un scope separado para cada VLAN:

```powershell
# Scope VLAN 10 - Contabilidad
Add-DhcpServerv4Scope `
    -Name "VLAN10 - Contabilidad" `
    -StartRange "192.168.10.100" `
    -EndRange "192.168.10.200" `
    -SubnetMask "255.255.255.0" `
    -State "Active"

Set-DhcpServerv4OptionValue `
    -ScopeId "192.168.10.0" `
    -Router "192.168.10.1" `
    -DnsServer "192.168.100.10" `
    -DnsDomain "corp.local"

# Scope VLAN 20 - IT
Add-DhcpServerv4Scope `
    -Name "VLAN20 - IT" `
    -StartRange "192.168.20.100" `
    -EndRange "192.168.20.200" `
    -SubnetMask "255.255.255.0" `
    -State "Active"

Set-DhcpServerv4OptionValue `
    -ScopeId "192.168.20.0" `
    -Router "192.168.20.1" `
    -DnsServer "192.168.100.10" `
    -DnsDomain "corp.local"
```

### 4.2 Configurar el Relay (en el router/switch L3)

El relay se configura en el router o switch de capa 3 (no en Windows). En un router Cisco o pfSense:

```
# Cisco IOS - en la interfaz de cada VLAN
interface vlan 10
  ip helper-address 192.168.100.10    ! IP del servidor DHCP de Windows

interface vlan 20
  ip helper-address 192.168.100.10
```

En **pfSense/OPNsense**: Services → DHCP Relay → Enable, Server: `192.168.100.10`.

> En VirtualBox con redes internas separadas por VLAN, puedes simular el relay configurando pfSense como router entre las redes virtuales.

---

## 🔄 Parte 5: DHCP Failover (Alta Disponibilidad)

Con un solo servidor DHCP, si cae, los clientes no pueden renovar IPs. **DHCP Failover** sincroniza la base de datos entre dos servidores.

### 5.1 Modos de failover

| Modo | Descripción | Cuándo usar |
|---|---|---|
| **Hot Standby** | Un servidor activo, uno en espera | Un sitio con dos servidores |
| **Load Balance** | Ambos responden (default 50/50) | Alto volumen de clientes |

### 5.2 Configurar failover (requiere 2 servidores DHCP)

```powershell
# En el servidor primario (DC01)
Add-DhcpServerv4Failover `
    -Name "Corp-Failover" `
    -ScopeId "192.168.100.0" `
    -PartnerServer "DHCP02.corp.local" `
    -Mode "HotStandby" `
    -AutoStateTransition $true `
    -MaxClientLeadTime "1:00:00"
```

---

## 🔗 Parte 6: Integración DHCP con DNS Dinámico

Cuando un cliente obtiene una IP por DHCP, el servidor puede actualizar automáticamente los registros DNS:

```powershell
# Configurar actualización dinámica en el scope
Set-DhcpServerv4DnsSetting `
    -ScopeId "192.168.100.0" `
    -DynamicUpdates "Always" `
    -DeleteDnsRROnLeaseExpiry $true `
    -UpdateDnsRRForOlderClients $true
```

---

## 📊 Parte 7: Monitoreo y Diagnóstico

### 7.1 Ver leases activos

```powershell
# Ver todas las IPs asignadas
Get-DhcpServerv4Lease -ScopeId "192.168.100.0"

# Buscar una IP específica
Get-DhcpServerv4Lease -ScopeId "192.168.100.0" | Where-Object { $_.IPAddress -eq "192.168.100.150" }

# Buscar por nombre de equipo
Get-DhcpServerv4Lease -ScopeId "192.168.100.0" | Where-Object { $_.HostName -like "*WKSTN*" }
```

### 7.2 Estadísticas del scope

```powershell
# Ver estadísticas de uso del scope
Get-DhcpServerv4ScopeStatistics -ScopeId "192.168.100.0"
```

### 7.3 Diagnóstico en el cliente

```cmd
# Ver configuración IP actual (incluyendo lease DHCP)
ipconfig /all

# Liberar y renovar IP manualmente
ipconfig /release
ipconfig /renew

# Ver si hay conflicto de IP
arp -a
```

### 7.4 Logs del servidor DHCP

Los logs están en: `C:\Windows\System32\dhcp\`

```powershell
# Ver eventos DHCP en Event Viewer
Get-EventLog -LogName "DhcpAdminEvents" -Newest 20

# O vía PowerShell Eventing
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Dhcp-Client/Admin'} -MaxEvents 20
```

---

## 🎤 Preguntas de Entrevista

**1. Explica el proceso DORA de DHCP.**
> Discover: el cliente hace broadcast preguntando si hay servidor DHCP. Offer: el servidor ofrece una IP disponible. Request: el cliente acepta la oferta y la solicita formalmente. Acknowledge: el servidor confirma la asignación con la IP, máscara, gateway, DNS y tiempo de lease.

**2. ¿Qué es un DHCP Relay Agent y cuándo es necesario?**
> Los broadcasts DHCP no cruzan routers. Cuando los clientes están en una VLAN diferente al servidor DHCP, el relay agent (configurado en el router/switch L3) captura el broadcast y lo reenvía como unicast al servidor DHCP, incluyendo la subred del cliente. El servidor responde con la IP del scope correcto para esa VLAN.

**3. ¿Qué diferencia hay entre una reserva DHCP y una IP estática?**
> La reserva la gestiona el servidor DHCP centralmente: el cliente todavía usa DHCP pero siempre recibe la misma IP (asignada por MAC address). La IP estática se configura manualmente en el cliente. Las reservas son preferibles porque facilitan la gestión centralizada y evitan conflictos de IP.

**4. ¿Por qué hay que autorizar un servidor DHCP en AD?**
> Para prevenir "rogue DHCP servers": si cualquier máquina pudiera actuar como servidor DHCP, un atacante podría configurar uno y dar IPs/gateways/DNS falsos a los clientes (ataque MITM). AD solo permite operar a los servidores DHCP autorizados explícitamente por un administrador del dominio.

**5. ¿Qué opciones DHCP configuras en un scope corporativo?**
> Mínimo: opción 003 (Router/Gateway), opción 006 (DNS Servers), opción 015 (DNS Domain Name). Para entornos con PXE/SCCM también: opción 066 (TFTP Server) y opción 067 (Bootfile Name). El TTL del lease suele ser 8 días en redes fijas, 4 horas en redes Wi-Fi con alta rotación.

**6. ¿Qué harías si los clientes de una VLAN no obtienen IP por DHCP?**
> 1. Verificar que el scope para esa VLAN existe y está activo en el servidor DHCP. 2. Verificar que el relay agent está configurado en el router/switch L3 con la IP del servidor DHCP. 3. `Test-NetConnection 192.168.100.10 -Port 67` desde un equipo de la VLAN hacia el DHCP. 4. Revisar el Event Viewer en el servidor DHCP. 5. Verificar que el scope no se agotó (`Get-DhcpServerv4ScopeStatistics`).

**7. ¿Qué es el DHCP Failover y qué modos tiene?**
> Permite que dos servidores DHCP sincronicen su base de datos para alta disponibilidad. Modo Hot Standby: uno activo, uno en espera (para un solo sitio). Modo Load Balance: ambos responden (distribución configurable, por defecto 50/50), útil cuando tienes muchos clientes y quieres distribuir la carga.
