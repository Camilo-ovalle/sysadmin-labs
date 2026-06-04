---
title: Arquitectura y Ruta de Labs
description: Infraestructura del laboratorio corp.local, requisitos de hardware y ruta completa de las 8 fases de laboratorios progresivos para preparación de entrevista SysAdmin.
sidebar:
  label: Arquitectura y Ruta
  order: 1
---

## Infraestructura Base

```
Red: 192.168.100.0/24

DC01      192.168.100.10    Windows Server 2022   AD DS + DNS + DHCP + GPMC
SCCM01    192.168.100.20    Windows Server 2022   SCCM + SQL Server
WKSTN-01  192.168.100.100   Windows 10/11         Cliente dominio (OU: Contabilidad)
WKSTN-02  192.168.100.101   Windows 10/11         Cliente dominio (OU: IT)
UBUNTU01  192.168.100.50    Ubuntu Server 24.04   Lab Linux / Scripting (Fase 8)

Dominio: corp.local
Hipervisor: VirtualBox (Oracle) — en Windows 10/11 host
```

---

## Ruta de Aprendizaje — 8 Fases

### 🏢 Fase 1 — Active Directory y GPO (Núcleo Windows)

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [Lab 01](/labs/lab-01-ad-gpo/) | AD DS + GPOs base + instalación forzada de extensión Chrome | Básico | 2–3 h |
| [Lab 02](/labs/lab-02-gpo-avanzado/) | GPO avanzado: seguridad, Loopback Processing, AppLocker | Intermedio | 3–4 h |
| [Lab 03](/labs/lab-03-grupos-rbac/) | Grupos AD + AGDLP + RBAC + File Server + delegación | Intermedio | 2–3 h |
| [Lab 04](/labs/lab-04-usuarios-avanzado/) | Fine-Grained Passwords + gMSA + automatización masiva | Intermedio | 2–3 h |

### 🌐 Fase 2 — Servicios de Red en Windows Server

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [DNS Windows](/redes/win-dns/) | Zonas, registros, forwarders, DNS dinámico, integración AD | Intermedio | 2–3 h |
| [DHCP Windows](/redes/win-dhcp/) | Scopes, reservas, opciones, relay DHCP por VLAN, failover | Intermedio | 2–3 h |

### 🔌 Fase 3 — Networking

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [NET-01](/redes/net-01-osi-diagnostico/) | Modelo OSI (7+capa 8), IPs estáticas/dinámicas, diagnóstico de red | Básico | 1–2 h |
| [NET-02](/redes/net-02-vlans/) | VLANs 802.1Q, routing inter-VLAN, práctica con pfSense | Intermedio | 2–3 h |
| [NET-03](/redes/net-03-wifi-ssid/) | SSIDs, WPA2/3, VLANs de Wi-Fi, WPA2-Enterprise con NPS | Intermedio | 1–2 h |
| [NET-04](/redes/net-04-firewalls/) | Cisco ASA, Palo Alto, pfSense práctico, NAT, ACLs | Avanzado | 2–3 h |

### ☁️ Fase 4 — Dominio Híbrido y Cloud

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [Híbrido: Entra ID](/hibrido/hibrido-entra/) | AD + Entra ID, Azure AD Connect, Hybrid Join, BitLocker | Avanzado | 3–4 h |
| [Cloud: AWS](/cloud/cloud-aws/) | VPC, EC2, S3, IAM, Security Groups — fundamentos AWS | Intermedio | 2–3 h |
| [Cloud: Azure](/cloud/cloud-azure/) | VNet, VM, NSG, Blob Storage, comparación AWS↔Azure | Intermedio | 1–2 h |

### 🖥️ Fase 5 — SCCM / MECM

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [Lab 05](/labs/lab-05-sccm-instalacion/) | Instalación SCCM/MECM + SQL + prerrequisitos + boundaries | Avanzado | 4–6 h |
| [Lab 06](/labs/lab-06-sccm-software/) | SCCM: despliegue de software + Collections + Detection Methods | Avanzado | 3–4 h |
| [Lab 07](/labs/lab-07-sccm-patches/) | SCCM: Patch Management + SUP + WSUS + ADR + Maintenance Windows | Avanzado | 4–5 h |
| [Lab 08](/labs/lab-08-sccm-osd/) | SCCM: OSD + PXE + Task Sequences + USMT | Experto | 6–8 h |

### ⌨️ Fase 6 — Scripting y Automatización

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [PowerShell](/scripting/ps-powershell/) | Módulo AD, automatización masiva, Get-WinEvent, herramienta de logs | Intermedio | 2–3 h |
| [Bash](/scripting/bash-scripting/) | Variables, bucles, grep/awk/sed, cron, herramienta de logs 30→5 min | Intermedio | 2–3 h |

### 📊 Fase 7 — Operaciones

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [Monitoreo](/ops/ops-monitoreo/) | DataDog, SentinelOne, Cisco ThousandEyes — uso y comandos | Intermedio | 1–2 h |
| [Backups y Rollback](/ops/ops-backups/) | Regla 3-2-1, backup AD, rollback de cambios, DR | Intermedio | 1–2 h |
| [ITIL v4](/ops/ops-itil/) | Incidentes, requerimientos, problemas, cambios, capa 8 OSI | Básico | 1–2 h |

### 🐧 Fase 8 — Linux (Fase Final)

| Lab | Tema | Dificultad | Tiempo |
|---|---|---|---|
| [Linux: Administración](/linux/linux-administracion/) | Usuarios, grupos, permisos, systemd, paquetes APT, procesos | Intermedio | 2–3 h |

---

## Requisitos de Hardware

### Fases 1–2 (AD + Servicios de Red Windows)
- 1 DC + 1–2 clientes
- RAM total: **6–8 GB**
- Sin necesidad de internet (todo local)

### Fases 3–4 (Networking + Cloud)
- Mismo entorno base + pfSense VM (512 MB RAM)
- Para Cloud: solo cuenta AWS/Azure (labs conceptuales)

### Fase 5 (SCCM)
- 1 DC + 1 servidor SCCM + 2 clientes
- RAM total: **16 GB mínimo**, 20 GB recomendado
- Acceso a internet para sincronizar actualizaciones

### Fase 8 (Linux)
- Ubuntu Server VM: 2 GB RAM, 20 GB disco
- Se puede correr junto con el DC con 8 GB de RAM total en el host

---

## Comandos de Diagnóstico Rápido

```powershell
# AD — Ver replicación del dominio
repadmin /showrepl

# AD — Verificar estado del dominio
dcdiag /test:dns /test:replications /test:netlogon

# GPO — Forzar aplicación y ver resultado
gpupdate /force
gpresult /h C:\GPOReport.html

# DNS — Diagnóstico
nslookup dc01.corp.local
Resolve-DnsName -Name "dc01.corp.local" -Type A
dcdiag /test:dns /v

# DHCP — Ver leases activos
Get-DhcpServerv4Lease -ScopeId "192.168.100.0"

# Diagnóstico de red
Test-NetConnection -ComputerName "dc01.corp.local" -Port 389  # LDAP
Test-NetConnection -ComputerName "dc01.corp.local" -Port 88   # Kerberos
ipconfig /all && ipconfig /flushdns

# SCCM — Forzar ciclos en el cliente
$triggers = @(
    "{00000000-0000-0000-0000-000000000021}",  # Machine Policy
    "{00000000-0000-0000-0000-000000000001}",  # Hardware Inventory
    "{00000000-0000-0000-0000-000000000121}",  # Application Evaluation
    "{00000000-0000-0000-0000-000000000113}",  # Software Update Scan
    "{00000000-0000-0000-0000-000000000108}"   # Software Update Deployment
)
$triggers | ForEach-Object {
    Invoke-WmiMethod -Namespace root\ccm -Class SMS_Client -Name TriggerSchedule -ArgumentList $_
}
```

```bash
# Linux — Diagnóstico de servicios
systemctl status nginx
journalctl -u ssh -n 50
ss -tlnp

# Linux — Red
ip addr show
ip route show
ping -c 4 192.168.100.10
nslookup dc01.corp.local 192.168.100.10
```
