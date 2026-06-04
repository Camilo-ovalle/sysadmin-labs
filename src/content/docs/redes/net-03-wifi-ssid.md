---
title: 'Lab NET-03 — Wi-Fi, SSIDs y Seguridad Inalámbrica'
description: Creación y gestión de SSIDs, bandas de frecuencia, protocolos de seguridad Wi-Fi (WPA2/WPA3), VLAN tagging de SSIDs, y configuración empresarial con autenticación 802.1X.
sidebar:
  label: 'NET-03: Wi-Fi y SSIDs'
  badge:
    text: Intermedio
    variant: caution
---

# Lab NET-03 — Wi-Fi, SSIDs y Seguridad Inalámbrica

**Prerequisito:** Lab NET-02 (VLANs) recomendado para entender el contexto de VLAN tagging.  
**Duración estimada:** 1–2 horas (mayormente conceptual + comandos)  
**Dificultad:** Intermedio

---

## 📡 Fundamentos Wi-Fi

### Estándares 802.11

| Estándar | Banda | Velocidad máx. | Nombre marketing | Notas |
|---|---|---|---|---|
| 802.11b | 2.4 GHz | 11 Mbps | Wi-Fi 1 | Legacy, no usar |
| 802.11a | 5 GHz | 54 Mbps | Wi-Fi 2 | Legacy |
| 802.11g | 2.4 GHz | 54 Mbps | Wi-Fi 3 | Legacy |
| 802.11n | 2.4/5 GHz | 600 Mbps | **Wi-Fi 4** | MIMO, muy extendido |
| 802.11ac | 5 GHz | 3.5 Gbps | **Wi-Fi 5** | MU-MIMO, el más común hoy |
| 802.11ax | 2.4/5/6 GHz | 9.6 Gbps | **Wi-Fi 6/6E** | OFDMA, mayor eficiencia |

### Bandas de frecuencia

| Banda | Ventajas | Desventajas |
|---|---|---|
| **2.4 GHz** | Mayor alcance, penetra paredes | Más interferencia (microondas, vecinos), menos canales |
| **5 GHz** | Más velocidad, menos interferencia | Menor alcance, menor penetración |
| **6 GHz** (Wi-Fi 6E) | Más canales, menos congestionado | Menor alcance, solo dispositivos nuevos |

### Canales Wi-Fi

En 2.4 GHz hay canales superpuestos. Solo **1, 6 y 11** son no superpuestos (en entornos denses, usar solo estos).  
En 5 GHz hay más canales disponibles y mayor separación (36, 40, 44, 48, 52...).

---

## 🔐 Protocolos de Seguridad Wi-Fi

### Evolución de la seguridad inalámbrica

| Protocolo | Año | Estado | Notas |
|---|---|---|---|
| **WEP** | 1999 | ❌ Roto | Nunca usar — se crackea en minutos |
| **WPA** | 2003 | ❌ Deprecado | TKIP con vulnerabilidades |
| **WPA2-Personal** | 2004 | ✅ Aceptable | PSK (contraseña compartida), AES-CCMP |
| **WPA2-Enterprise** | 2004 | ✅ **Recomendado** | 802.1X + RADIUS, credenciales por usuario |
| **WPA3-Personal** | 2018 | ✅ Mejor | SAE (Simultaneous Authentication of Equals), sin diccionario |
| **WPA3-Enterprise** | 2018 | ✅ **Mejor** | 192-bit de seguridad, certificados obligatorios |

### WPA2-Personal vs WPA2-Enterprise

**WPA2-Personal (PSK)**:
- Una sola contraseña para todos
- Si un empleado se va, hay que cambiar la contraseña para todos
- No hay logs de quién se conectó con qué dispositivo

**WPA2-Enterprise (802.1X)**:
- Cada usuario se autentica con sus credenciales de AD
- Logs individuales por usuario
- Si alguien se va, deshabilitas su cuenta AD → pierde acceso al Wi-Fi automáticamente
- Requiere un servidor RADIUS (puede ser NPS en Windows Server)

---

## 🏢 SSIDs en Entorno Empresarial

### Diseño típico de SSIDs corporativos

```
SSID: CORP-EMPLOYEES    → VLAN 50 → WPA2-Enterprise (802.1X/RADIUS)
SSID: CORP-GUESTS       → VLAN 60 → WPA2-Personal (contraseña rotativa)
SSID: CORP-VOICE        → VLAN 70 → WPA2-Enterprise (teléfonos IP)
SSID: CORP-IOT          → VLAN 80 → WPA2-Enterprise (dispositivos IoT)
```

Cada SSID está mapeado a una VLAN. El AP etiqueta el tráfico con el VLAN ID correspondiente al SSID desde el que llegó.

### Flujo de VLAN tagging con múltiples SSIDs

```
[Laptop] → conecta a "CORP-EMPLOYEES" (SSID)
    ↓
[AP] etiqueta el tráfico como VLAN 50
    ↓ (trunk 802.1Q)
[Switch] → reenvía tráfico de VLAN 50
    ↓
[Router/Firewall] → enruta VLAN 50 a internet + servidores corporativos
```

---

## 🔧 Configuración Práctica: NPS como Servidor RADIUS (WPA2-Enterprise)

Para hacer WPA2-Enterprise en Windows Server, necesitas el rol **NPS (Network Policy Server)**.

### Instalar NPS

```powershell
Install-WindowsFeature NPAS -IncludeManagementTools
```

### Configurar NPS como RADIUS server

1. **NPS → RADIUS Clients and Servers → RADIUS Clients**: agregar el Access Point con su IP y un shared secret (contraseña entre AP y NPS)
2. **NPS → Policies → Network Policies**: crear política que permita a usuarios del grupo "Domain Users" (o un grupo específico de Wi-Fi) conectarse
3. En el Access Point, configurar WPA2-Enterprise con:
   - Authentication: 802.1X / EAP
   - RADIUS Server: IP del servidor NPS
   - RADIUS Port: 1812 (autenticación), 1813 (accounting)
   - Shared Secret: el mismo configurado en NPS

### Comandos de diagnóstico NPS

```powershell
# Ver intentos de autenticación en Event Viewer
Get-WinEvent -LogName "Security" | Where-Object {$_.Id -in 6272, 6273, 6274} | Select-Object -First 20

# 6272 = acceso concedido
# 6273 = acceso denegado
# 6274 = solicitud descartada
```

---

## 🐧 Lab Práctico: Crear un Access Point Virtual con `hostapd` (Linux)

Si tienes un servidor Linux con tarjeta Wi-Fi que soporta modo AP (Access Point):

```bash
# Instalar hostapd
sudo apt install hostapd

# Crear configuración básica
sudo nano /etc/hostapd/hostapd.conf
```

```ini
# /etc/hostapd/hostapd.conf
interface=wlan0
driver=nl80211
ssid=MiLabWifi
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0

# WPA2-Personal
auth_algs=1
wpa=2
wpa_passphrase=MiContraseñaSegura123
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
```

```bash
# Iniciar hostapd
sudo hostapd /etc/hostapd/hostapd.conf

# Como servicio
sudo systemctl enable hostapd
sudo systemctl start hostapd
```

> **Nota:** La mayoría de tarjetas Wi-Fi USB/PCIe en máquinas virtuales no soportan modo AP (modo monitor/managed sí, modo master/AP no). Este lab es más viable en hardware físico o en una Raspberry Pi.

---

## 🔍 Diagnóstico de Wi-Fi en Windows

```cmd
:: Ver redes Wi-Fi disponibles
netsh wlan show networks mode=bssid

:: Ver perfil Wi-Fi guardado
netsh wlan show profiles

:: Ver contraseña de un perfil guardado
netsh wlan show profile name="CORP-EMPLOYEES" key=clear

:: Exportar todos los perfiles Wi-Fi
netsh wlan export profile folder=C:\wifi-backup

:: Ver interfaces Wi-Fi
netsh wlan show interfaces

:: Ver estadísticas de la conexión actual
netsh wlan show interface

:: Ver drivers y capabilities
netsh wlan show drivers
```

```powershell
# PowerShell - Ver conexiones de red incluyendo Wi-Fi
Get-NetAdapter | Where-Object {$_.MediaType -eq "802.11"}

# Ver signal strength actual
(Get-NetAdapter | Where-Object {$_.MediaType -eq "802.11"}).LinkSpeed
```

---

## 📋 Conceptos Clave para la Entrevista

### BSS, SSID, BSSID, ESSID

| Término | Definición |
|---|---|
| **SSID** | Nombre de la red Wi-Fi (ej: "CORP-EMPLOYEES") |
| **BSSID** | MAC address del Access Point (identifica un AP específico) |
| **ESSID** | Extended SSID: varios APs con el mismo SSID forman un ESS (roaming) |
| **BSS** | Basic Service Set: un solo AP con sus clientes |
| **ESS** | Extended Service Set: múltiples APs con el mismo SSID |

### Roaming Wi-Fi

Cuando caminas por la oficina, tu laptop se conecta automáticamente al AP con mejor señal que emite el mismo SSID. Esto es posible porque todos los APs tienen el mismo SSID y están en el mismo ESS. El controlador de APs (WLC - Wireless LAN Controller) gestiona el handoff.

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre WPA2-Personal y WPA2-Enterprise?**
> Personal (PSK): una sola contraseña compartida por todos los usuarios. Enterprise: cada usuario se autentica con sus credenciales individuales (Active Directory vía RADIUS/NPS). Enterprise es más seguro porque permite revocar acceso por usuario, auditar quién se conectó cuándo, y evitar el problema de rotar la contraseña cuando alguien se va.

**2. Un empleado se va de la empresa. ¿Cómo evitas que siga teniendo acceso al Wi-Fi?**
> Si usas WPA2-Enterprise con 802.1X y RADIUS integrado con AD: deshabilitar la cuenta en Active Directory es suficiente — el empleado no podrá autenticarse en el Wi-Fi. Si usas WPA2-Personal (PSK), tendrías que cambiar la contraseña para todos los demás empleados, lo cual es operacionalmente costoso.

**3. ¿Cómo implementarías una red Wi-Fi de visitantes aislada de la red corporativa?**
> 1. Crear VLAN 60 dedicada para visitantes con su propio scope DHCP. 2. Configurar en el AP un SSID "GUESTS" mapeado a VLAN 60. 3. En el firewall, la VLAN 60 solo tiene salida a internet (bloquear acceso a VLANs corporativas). 4. WPA2-Personal con contraseña que rotas regularmente, o un portal cautivo. 5. Limitar el ancho de banda para no saturar la red corporativa.

**4. ¿Qué diferencia hay entre las bandas 2.4 GHz y 5 GHz?**
> 2.4 GHz: mayor alcance, mejor penetración de paredes, pero más interferencia (microondas, otros routers vecinos) y menos canales no superpuestos (1, 6 y 11). 5 GHz: mayor velocidad, menos interferencia, más canales disponibles, pero menor alcance y peor penetración de obstáculos.

**5. ¿Qué es el VLAN tagging de SSIDs y para qué se usa?**
> Cuando un usuario se conecta a un SSID, el AP etiqueta todo el tráfico de ese SSID con el VLAN ID correspondiente (802.1Q) antes de enviarlo al switch. Así, un solo AP puede servir múltiples SSIDs (CORP, GUESTS, VOICE) cada uno en su propia VLAN, con políticas de seguridad y routing separadas.

**6. ¿Qué es el roaming Wi-Fi y cómo funciona en entornos empresariales?**
> Cuando un usuario se mueve por el edificio, su dispositivo busca APs con el mismo SSID y mejor señal, y cambia de AP sin interrumpir la conexión. En entornos enterprise, todos los APs se gestionan con un Wireless LAN Controller (WLC) que coordina el handoff y mantiene la sesión del usuario activa durante el traspaso.
