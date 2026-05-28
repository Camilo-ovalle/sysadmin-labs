# Laboratorios de Administración de Sistemas — corp.local

Serie de laboratorios progresivos para practicar SysAdmin con Windows Server, Active Directory y SCCM/MECM.

---

## Arquitectura Base

```
Red: 192.168.100.0/24

DC      192.168.100.10   Windows Server 2022   AD DS + DNS + GPMC
SCCM01  192.168.100.20   Windows Server 2022   SCCM + SQL Server
WKSTN-01 192.168.100.100 Windows 10/11         Cliente dominio
WKSTN-02 192.168.100.101 Windows 10/11         Cliente dominio

Dominio: corp.local
```

---

## Ruta de Laboratorios

| # | Archivo | Tema | Dificultad | Tiempo |
|---|---|---|---|---|
| 01 | `laboratorio_ad_gpo.md` | AD DS + GPOs base + Chrome | Básico | 2-3h |
| 02 | `lab_02_gpo_avanzado.md` | GPO avanzado: seguridad, Loopback, AppLocker | Intermedio | 3-4h |
| 03 | `lab_03_grupos_y_rbac.md` | Grupos AD + AGDLP + RBAC + File Server | Intermedio | 2-3h |
| 04 | `lab_04_usuarios_avanzado.md` | Fine-Grained Passwords + gMSA + automatización | Intermedio-Avanzado | 2-3h |
| 05 | `lab_05_sccm_instalacion.md` | Instalación SCCM/MECM + SQL + prerrequisitos | Avanzado | 4-6h |
| 06 | `lab_06_sccm_software.md` | SCCM: despliegue de software + Collections | Avanzado | 3-4h |
| 07 | `lab_07_sccm_patches.md` | SCCM: Patch Management + SUP + WSUS + ADR | Avanzado | 4-5h |
| 08 | `lab_08_sccm_osd_tasksequence.md` | SCCM: OSD + PXE + Task Sequences + USMT | Experto | 6-8h |

---

## Requisitos de Hardware por Fase

### Fase 1 — Labs 01-04 (solo AD/GPO)
- 1 DC + 1-2 clientes
- RAM total: 6-8 GB
- No necesita internet (todo local)

### Fase 2 — Labs 05-08 (SCCM)
- 1 DC + 1 SCCM Server + 2 clientes
- RAM total: 16 GB mínimo, 20 GB recomendado
- Necesita acceso a internet para sincronizar actualizaciones y descargar prerrequisitos

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
