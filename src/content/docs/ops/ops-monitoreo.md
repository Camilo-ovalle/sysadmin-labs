---
title: 'Ops — Monitoreo: DataDog, SentinelOne y ThousandEyes'
description: Herramientas de monitoreo empresarial usadas en el trabajo diario de SysAdmin. DataDog para infraestructura, SentinelOne para seguridad de endpoints, y Cisco ThousandEyes para visibilidad de red.
sidebar:
  label: 'Ops: Monitoreo'
  badge:
    text: Intermedio
    variant: caution
---

# Monitoreo Empresarial — DataDog, SentinelOne y ThousandEyes

**Duración estimada:** 1–2 horas de estudio  
**Dificultad:** Intermedio  
**Tipo:** Guía conceptual + comandos de referencia

---

## 📊 DataDog — Monitoreo de Infraestructura

**DataDog** es una plataforma de observabilidad que consolida métricas, logs, trazas y alertas de toda la infraestructura en un solo lugar.

### ¿Qué monitorea DataDog?

```
┌─────────────────────────────────────────────────────┐
│                   DataDog Platform                   │
├──────────────┬──────────────┬───────────────────────┤
│ Infraestructura│    Logs      │    APM / Trazas       │
│ CPU, RAM, Disco│ Logs de app  │ Rendimiento de app    │
│ Red, procesos  │ Logs de sist.│ Latencia, errores     │
├──────────────┴──────────────┴───────────────────────┤
│ Alertas │ Dashboards │ Anomaly Detection │ SLOs      │
└─────────────────────────────────────────────────────┘
```

### Componentes clave

| Componente | Descripción |
|---|---|
| **DataDog Agent** | Proceso instalado en cada servidor/VM que recolecta y envía métricas |
| **Integrations** | Plugins preconstruidos para MySQL, IIS, AD, Windows, Linux, AWS, etc. |
| **Dashboards** | Visualización personalizable de métricas |
| **Monitors (Alertas)** | Notificaciones cuando una métrica supera un umbral |
| **Log Management** | Ingesta, parseo y búsqueda de logs |
| **NPM (Network Performance)** | Monitoreo de tráfico de red entre servicios |

### Instalar el DataDog Agent

```powershell
# Windows Server — Instalar via PowerShell
$DD_AGENT_MAJOR_VERSION=7
$DD_API_KEY="tu-api-key-aqui"
$DD_SITE="datadoghq.com"

# Descargar e instalar
(New-Object System.Net.WebClient).DownloadFile(
    "https://s3.amazonaws.com/ddagent-windows-stable/datadog-agent-7-latest.amd64.msi",
    "C:\dd-agent.msi"
)
Start-Process -Wait msiexec -ArgumentList '/qn /i C:\dd-agent.msi APIKEY=$DD_API_KEY SITE=$DD_SITE'
```

```bash
# Linux (Ubuntu/Debian) — Instalar via script oficial
DD_AGENT_MAJOR_VERSION=7 DD_API_KEY="tu-api-key" DD_SITE="datadoghq.com" \
    bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"

# Verificar estado del agente
sudo systemctl status datadog-agent
sudo datadog-agent status

# Ver métricas que el agente está recolectando
sudo datadog-agent check cpu
sudo datadog-agent check disk
```

### Configuración del agente

```yaml
# /etc/datadog-agent/datadog.yaml (Linux) o C:\ProgramData\Datadog\datadog.yaml (Windows)
api_key: tu-api-key
site: datadoghq.com
hostname: dc01.corp.local
tags:
  - env:production
  - team:sysadmin
  - location:bogota
```

### Ejemplo de monitor/alerta

En DataDog UI: **Monitors → New Monitor → Metric**:
- Metric: `system.disk.in_use`
- From: `host:dc01`
- Alert threshold: > 85%
- Warning threshold: > 75%
- Notify: `@slack-alerts-sysadmin`

### Comandos de diagnóstico DataDog

```powershell
# Windows
& "C:\Program Files\Datadog\Datadog Agent\bin\agent.exe" status
& "C:\Program Files\Datadog\Datadog Agent\bin\agent.exe" check windows_service

# Ver logs del agente
Get-Content "C:\ProgramData\Datadog\logs\agent.log" -Tail 50
```

```bash
# Linux
sudo datadog-agent status
sudo datadog-agent flare    # Recolecta diagnóstico para soporte
sudo journalctl -u datadog-agent -f    # Ver logs en tiempo real
```

---

## 🛡️ SentinelOne — EDR / Seguridad de Endpoints

**SentinelOne** es una solución EDR (Endpoint Detection and Response) / XDR que protege endpoints contra malware, ransomware y amenazas avanzadas usando IA.

### ¿Qué hace SentinelOne?

```
┌─────────────────────────────────────────────────────┐
│               SentinelOne Console                    │
├──────────────────────────────────────────────────────┤
│ Threat Detection  │ Threat Intelligence  │ Forensics │
│ (AI/ML)          │ (IOCs, CVEs)         │ (Timeline)│
├──────────────────────────────────────────────────────┤
│  S1 Agent en cada endpoint (Windows, Mac, Linux)    │
│  - Monitoreo de procesos en tiempo real             │
│  - Análisis estático + dinámico de ejecutables      │
│  - Rollback automático en caso de ransomware        │
│  - Aislamiento de endpoint comprometido             │
└─────────────────────────────────────────────────────┘
```

### Capacidades clave para SysAdmin

| Capacidad | Descripción |
|---|---|
| **Threat Detection** | Detecta malware, ransomware, exploits sin firmas (IA) |
| **Rollback** | En Windows, puede revertir archivos cifrados por ransomware |
| **Device Isolation** | Aisla un endpoint de la red manteniendo comunicación con la consola |
| **Remote Shell** | Consola remota al endpoint comprometido desde la plataforma |
| **Inventory** | Inventario de hardware/software, usuarios, procesos, conexiones |
| **Vulnerability Assessment** | Lista de CVEs conocidas en el software instalado |

### Vista de endpoints para SysAdmin

En la consola SentinelOne (Sentinel Management Console → Endpoints):

```
Información por endpoint:
  ├── OS Version, Build Number
  ├── Agent version y estado (conectado/desconectado)
  ├── Último usuario logueado
  ├── Conexiones de red activas
  ├── Procesos en ejecución
  └── Amenazas detectadas + estado (activo/mitigado/resuelto)
```

### Instalación del agente S1

```powershell
# Windows - instalación silenciosa
msiexec /i SentinelOne-installer.msi /quiet `
    SITE_TOKEN="tu-site-token" `
    /L*V "C:\s1-install.log"

# Verificar estado del agente
Get-Service -Name SentinelAgent
```

```bash
# Linux (Ubuntu)
sudo dpkg -i SentinelOne-agent.deb
sudo sentinelctl management token set <site-token>
sudo sentinelctl control start
sudo sentinelctl status    # Ver estado del agente
```

### Respuesta a incidentes con SentinelOne

```
Flujo típico de respuesta:
1. Alerta en consola: "Ransomware detected on WKSTN-05"
2. Revisar detalles: árbol de proceso (qué ejecutó qué)
3. Aislar equipo: Endpoint → Actions → Network Isolation
4. Investigar: Remote Shell → revisar archivos y procesos
5. Mitigar: Kill Process + Quarantine File
6. Si hay ransomware: Actions → Rollback (restaura archivos cifrados)
7. Documentar: crear ticket en ITSM con evidencia
```

---

## 🌐 Cisco ThousandEyes — Visibilidad de Red End-to-End

**ThousandEyes** monitorea la experiencia de red desde el punto de vista del usuario, no solo del datacenter. Permite ver dónde está la degradación en el camino completo hasta un servicio.

### ¿Qué problema resuelve?

Sin ThousandEyes:
> "La app Teams está lenta, ¿es nuestra red, la de Microsoft, o el equipo del usuario?"

Con ThousandEyes:
> "El 80% de la latencia está en el salto entre el ISP y el datacenter de Microsoft en Miami — es un problema del proveedor, no nuestro."

### Tipos de agentes ThousandEyes

| Tipo | Descripción | Dónde se instala |
|---|---|---|
| **Enterprise Agent** | Agente en la red corporativa | VM o contenedor en el datacenter |
| **Endpoint Agent** | Agente en el endpoint del usuario | PC/Mac del empleado |
| **Cloud Agent** | Agentes de Cisco en internet | 200+ ubicaciones globales |

### Tipos de tests

| Test | Mide | Caso de uso |
|---|---|---|
| **Network - Agent to Server** | Latencia, pérdida, jitter hacia un host | Monitorear DC, servidor SAP |
| **Network - Agent to Agent** | Latencia entre sitios de la empresa | Monitorear WAN entre oficinas |
| **HTTP Server** | Disponibilidad y performance de URL | Monitorear portales internos |
| **Page Load** | Tiempo de carga completa de página web | Monitorear apps web SaaS |
| **DNS Server** | Latencia y correctitud de resolución DNS | Verificar DNS interno/externo |
| **BGP** | Cambios en rutas BGP hacia un prefijo | Detectar problemas de routing externo |

### Información que ves en ThousandEyes

```
Test: HTTP a teams.microsoft.com desde WKSTN-01 (Bogotá)

Saltos de red:
  1. WKSTN-01 → Gateway (0.5ms)
  2. Gateway → Router ISP (2ms)
  3. ISP Router → ISP backbone (8ms)
  4. ISP → Peering point Miami (45ms) ← ⚠️ SPIKE AQUÍ
  5. Peering → Microsoft Network (48ms)
  6. Microsoft CDN → Response (50ms)

Resultado: 95ms total | Pérdida de paquetes: 2% en salto 4
```

### Uso típico en SysAdmin

```
Escenarios comunes:
1. Usuario reporta "Teams lento"
   → Abrir ThousandEyes → revisar test de Teams desde Endpoint Agent del usuario
   → Ver si el problema es local (red office) o en tránsito (ISP/MS)

2. Monitoreo proactivo de apps críticas
   → Dashboard con disponibilidad y latencia de: SAP, Teams, M365, VPN
   → Alertas cuando latencia supera SLA

3. Validación antes/después de cambio de red
   → Comparar baseline antes del cambio con métricas post-cambio
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué es DataDog y cómo lo has usado?**
> DataDog es una plataforma de observabilidad cloud que consolida métricas de infraestructura, logs, APM y alertas. Lo he usado para monitorear servidores Windows y Linux (CPU, disco, memoria), configurar alertas por umbrales, revisar logs correlacionados de múltiples fuentes, y crear dashboards de visibilidad del entorno para el equipo de operaciones.

**2. ¿Qué es SentinelOne y en qué se diferencia de un antivirus tradicional?**
> SentinelOne es una plataforma EDR/XDR que usa IA para detectar comportamientos maliciosos, no solo firmas conocidas. A diferencia de un antivirus tradicional (basado en firmas, reactivo), SentinelOne detecta amenazas zero-day por comportamiento, puede hacer rollback automático de archivos cifrados por ransomware, permite aislar endpoints remotamente y ofrece forensics detallados del árbol de procesos del ataque.

**3. ¿Qué información obtienes de SentinelOne sobre los endpoints de la empresa?**
> Desde la consola: estado del agente (conectado/desconectado), OS version, último usuario logueado, procesos en ejecución, conexiones de red activas, software instalado con CVEs conocidos, historial de amenazas detectadas y mitigadas. Es útil tanto para seguridad como para inventario de activos.

**4. Un usuario reporta que Teams está muy lento. ¿Cómo usarías ThousandEyes para diagnosticarlo?**
> Abrir el Endpoint Agent del usuario en ThousandEyes, revisar el test de Teams → ver el path trace (hop by hop). Si la latencia alta está en los primeros saltos (dentro de la red corporativa) → problema interno. Si está en el ISP o en la red de Microsoft → problema externo, fuera de nuestro control. Con esta información puedo decirle al usuario la causa raíz en minutos en lugar de pasarse horas revisando la red interna.

**5. ¿Qué diferencia hay entre monitoring y observability?**
> Monitoring: recopilar y alertar sobre métricas predefinidas conocidas (CPU > 90%, servicio caído). Observability: capacidad de entender el estado interno de un sistema a partir de sus salidas (métricas, logs, trazas). Monitoring dice "algo está mal". Observability dice "por qué está mal" — permite responder preguntas que no anticipaste cuando diseñaste el sistema.
