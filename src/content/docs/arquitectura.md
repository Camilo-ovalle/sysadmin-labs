---
title: Arquitectura y Ruta de Labs
description: Infraestructura del laboratorio corp.local, requisitos de hardware y ruta completa de los 8 laboratorios progresivos.
sidebar:
  label: Arquitectura y Ruta
  order: 1
---

## Infraestructura Base

```
Red: 192.168.100.0/24

DC        192.168.100.10    Windows Server 2022   AD DS + DNS + GPMC
SCCM01    192.168.100.20    Windows Server 2022   SCCM + SQL Server
WKSTN-01  192.168.100.100   Windows 10/11         Cliente dominio
WKSTN-02  192.168.100.101   Windows 10/11         Cliente dominio

Dominio: corp.local
```

## Ruta de Laboratorios

| # | Tema | Dificultad | Tiempo est. |
|---|------|-----------|-------------|
| [Lab 01](/labs/lab-01-ad-gpo/) | AD DS + GPOs base + Chrome | Básico | 2–3 h |
| [Lab 02](/labs/lab-02-gpo-avanzado/) | GPO avanzado: seguridad, Loopback, AppLocker | Intermedio | 3–4 h |
| [Lab 03](/labs/lab-03-grupos-rbac/) | Grupos AD + AGDLP + RBAC + File Server | Intermedio | 2–3 h |
| [Lab 04](/labs/lab-04-usuarios-avanzado/) | Fine-Grained Passwords + gMSA + automatización | Intermedio | 2–3 h |
| [Lab 05](/labs/lab-05-sccm-instalacion/) | Instalación SCCM/MECM + SQL + prerrequisitos | Avanzado | 4–6 h |
| [Lab 06](/labs/lab-06-sccm-software/) | SCCM: despliegue de software + Collections | Avanzado | 3–4 h |
| [Lab 07](/labs/lab-07-sccm-patches/) | SCCM: Patch Management + SUP + WSUS + ADR | Avanzado | 4–5 h |
| [Lab 08](/labs/lab-08-sccm-osd/) | SCCM: OSD + PXE + Task Sequences + USMT | Experto | 6–8 h |

## Requisitos de Hardware

### Fase 1 — Labs 01–04 (solo AD/GPO)

- 1 DC + 1–2 clientes
- RAM total: **6–8 GB**
- Sin necesidad de internet (todo local)

### Fase 2 — Labs 05–08 (SCCM)

- 1 DC + 1 servidor SCCM + 2 clientes
- RAM total: **16 GB mínimo**, 20 GB recomendado
- Acceso a internet para sincronizar actualizaciones y descargar prerrequisitos

## Comandos de Diagnóstico Rápido

```powershell
# AD — Ver replicación del dominio
repadmin /showrepl

# AD — Verificar estado del dominio
dcdiag /test:dns /test:replications /test:netlogon

# GPO — Forzar aplicación y ver resultado
gpupdate /force
gpresult /h C:\GPOReport.html

# SCCM — Forzar todos los ciclos en el cliente
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

# SCCM — Ver logs en tiempo real
Get-Content "C:\Windows\CCM\Logs\AppEnforce.log" -Tail 30 -Wait
```
