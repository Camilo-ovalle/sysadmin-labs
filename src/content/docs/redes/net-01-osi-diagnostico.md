---
title: 'Lab NET-01 — Modelo OSI y Diagnóstico de Red'
description: Modelo OSI de 7 capas (+ capa 8), herramientas de diagnóstico de red en Windows y Linux, IPs estáticas y dinámicas, y resolución de problemas paso a paso.
sidebar:
  label: 'NET-01: OSI y Diagnóstico'
  badge:
    text: Básico
    variant: success
---

# Lab NET-01 — Modelo OSI y Diagnóstico de Red

**Prerequisito:** Tener el entorno base montado (DC + al menos 1 cliente).  
**Duración estimada:** 1–2 horas  
**Dificultad:** Básico

---

## 🏗️ El Modelo OSI — Las 7 Capas (+ la Capa 8)

El modelo OSI (**Open Systems Interconnection**) es el marco de referencia para entender cómo viajan los datos en una red. Cada capa tiene responsabilidades claras:

| Capa | Nombre | Protocolo/Ejemplos | ¿Qué hace? |
|---|---|---|---|
| **7** | Aplicación | HTTP, HTTPS, DNS, FTP, SMTP | Interfaz con el usuario y las aplicaciones |
| **6** | Presentación | SSL/TLS, cifrado, compresión | Codificación, cifrado, formato de datos |
| **5** | Sesión | NetBIOS, RPC, SMB | Establece, mantiene y termina sesiones |
| **4** | Transporte | **TCP, UDP** | Segmentación, control de flujo, puertos |
| **3** | Red | **IP, ICMP, OSPF, BGP** | Enrutamiento entre redes (IP addresses) |
| **2** | Enlace de datos | Ethernet, Wi-Fi, VLANs (802.1Q) | Tramas entre dispositivos en la misma red |
| **1** | Física | Cables, fibra, señal Wi-Fi | Bits sobre el medio físico |
| **8** | Personas | El usuario final 😄 | El error más difícil de depurar |

### Mnemónico para recordar las capas (de 7 a 1)
> **A**ll **P**eople **S**eem **T**o **N**eed **D**ata **P**rocessing

---

## 🔗 Encapsulación y Desencapsulación

Cuando envías un paquete, cada capa añade su encabezado (encapsulación). Al recibirlo, se van quitando de la capa más baja hacia arriba (desencapsulación).

```
Capa 7: HTTP Request (datos)
Capa 4: [TCP Header | datos]           ← Segmento
Capa 3: [IP Header | Segmento]         ← Paquete  
Capa 2: [Eth Header | Paquete | FCS]   ← Trama
Capa 1: bits sobre el cable
```

**Herramienta clave para ver esto:** Wireshark captura tramas de Capa 2 y te permite ver todas las capas.

---

## 🌐 IPs Estáticas vs Dinámicas

### IP Estática
Asignada manualmente. Nunca cambia. Recomendada para: DCs, servidores, impresoras, dispositivos de red.

**Windows Server (netsh o PowerShell):**
```powershell
# Configurar IP estática
New-NetIPAddress `
    -InterfaceAlias "Ethernet" `
    -IPAddress "192.168.100.10" `
    -PrefixLength 24 `
    -DefaultGateway "192.168.100.1"

# Configurar DNS
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "192.168.100.10","8.8.8.8"
```

**Windows con netsh (clásico):**
```cmd
netsh interface ip set address "Ethernet" static 192.168.100.10 255.255.255.0 192.168.100.1
netsh interface ip set dns "Ethernet" static 192.168.100.10
```

### IP Dinámica (DHCP)
El cliente solicita IP al servidor DHCP. Recomendada para: workstations, laptops.

```powershell
# Cambiar a DHCP
Set-NetIPInterface -InterfaceAlias "Ethernet" -Dhcp Enabled
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ResetServerAddresses
```

---

## 🔧 Herramientas de Diagnóstico de Red

### `ipconfig` — Información de red básica (Windows)

```cmd
ipconfig                  :: IP, máscara, gateway de todas las interfaces
ipconfig /all             :: Todo: MAC, DHCP server, lease time, DNS
ipconfig /flushdns        :: Limpiar cache DNS local
ipconfig /registerdns     :: Re-registrar el equipo en DNS
ipconfig /release         :: Liberar IP (DHCP)
ipconfig /renew           :: Solicitar nueva IP (DHCP)
```

### `ping` — Verificar conectividad (ICMP)

```cmd
:: Diagnóstico básico: capas 3 y 4 (red e ICMP)
ping 192.168.100.10              :: ¿Hay conectividad de red?
ping dc01.corp.local             :: ¿Hay conectividad + resolución DNS?
ping -t 192.168.100.10           :: Ping continuo (Ctrl+C para parar)
ping -n 100 192.168.100.10       :: 100 pings para detectar pérdida de paquetes
```

```powershell
# PowerShell equivalente
Test-Connection -ComputerName "dc01.corp.local" -Count 4
Test-Connection -ComputerName "192.168.100.10" -Count 100 | 
    Select-Object -Property StatusCode, ResponseTime | 
    Measure-Object -Property ResponseTime -Average -Maximum
```

> ⚠️ Si `ping` falla, puede ser: host apagado, firewall bloqueando ICMP, o problema de red. **No asumas** que el host está caído solo por ping fallido.

### `tracert` / `traceroute` — Ver la ruta de los paquetes

```cmd
:: Windows: tracert
tracert 8.8.8.8            :: Ver todos los saltos hasta Google DNS
tracert dc01.corp.local    :: Ver ruta hasta el DC
```

```powershell
# PowerShell moderno
Test-NetConnection -ComputerName "8.8.8.8" -TraceRoute
```

**Interpretación:**
- Cada línea = un salto (router)
- `* * *` = el router no responde a ICMP (no necesariamente problema)
- Latencia alta en un salto específico = posible cuello de botella

### `nslookup` — Diagnóstico DNS

```cmd
nslookup dc01.corp.local              :: Resolver nombre → IP
nslookup 192.168.100.10               :: Resolver IP → nombre (PTR)
nslookup -type=MX corp.local          :: Registros MX
nslookup -type=SRV _ldap._tcp.corp.local :: Registros SRV de AD
nslookup dc01.corp.local 8.8.8.8      :: Consultar servidor DNS específico
```

### `netsh` — Configuración y diagnóstico de red (Windows)

```cmd
:: Ver configuración de interfaces
netsh interface show interface
netsh interface ip show config

:: Ver tabla de enrutamiento
netsh interface ip show route

:: Diagnóstico de firewall
netsh advfirewall show allprofiles

:: Rastrear reglas de firewall
netsh advfirewall firewall show rule name=all

:: Estadísticas de red
netsh interface ip show ipstats
```

### `route` — Ver y modificar la tabla de enrutamiento

```cmd
route print                :: Ver tabla de rutas completa
route add 10.0.0.0 MASK 255.0.0.0 192.168.100.1    :: Agregar ruta estática
route delete 10.0.0.0     :: Eliminar ruta
```

### `Test-NetConnection` — Herramienta todo-en-uno (PowerShell)

```powershell
# Verificar conectividad básica
Test-NetConnection -ComputerName "dc01.corp.local"

# Verificar un puerto específico (ej: 389 LDAP, 443 HTTPS, 3389 RDP)
Test-NetConnection -ComputerName "dc01.corp.local" -Port 389
Test-NetConnection -ComputerName "192.168.100.10" -Port 445

# Traceroute con PowerShell
Test-NetConnection -ComputerName "8.8.8.8" -TraceRoute
```

### `arp` — Tabla ARP (Capa 2 → Capa 3)

```cmd
arp -a                    :: Ver tabla ARP completa (IP → MAC)
arp -a 192.168.100.10     :: Ver entrada específica
```

La tabla ARP muestra la correspondencia entre IPs y MACs en la red local. Útil para:
- Detectar conflictos de IP (misma IP, dos MACs diferentes)
- Verificar que el gateway sea accesible a capa 2

---

## 🩺 Metodología de Diagnóstico de Red

Cuando un usuario reporta "no tengo internet" o "no puedo acceder al servidor", sigue este proceso de abajo hacia arriba (Capa 1 → 7):

```
Paso 1 (Capa 1-2): ¿Hay cable/Wi-Fi conectado?
    ipconfig /all → ¿hay IP asignada?
    
Paso 2 (Capa 3): ¿Hay conectividad de red?
    ping 127.0.0.1       → ¿funciona el stack TCP/IP local?
    ping 192.168.100.1   → ¿llego al gateway?
    ping 8.8.8.8         → ¿salgo a internet?
    
Paso 3 (Capa 3-4): ¿Hay enrutamiento correcto?
    route print          → ¿la tabla de rutas tiene el default gateway?
    tracert 8.8.8.8      → ¿dónde se corta la ruta?
    
Paso 4 (Capa 7 - DNS): ¿Resuelvo nombres?
    ping google.com      → si falla pero ping 8.8.8.8 funciona → problema DNS
    nslookup google.com  → ¿responde el servidor DNS configurado?
    
Paso 5 (Capa 4 - Puerto): ¿El servicio específico está disponible?
    Test-NetConnection -ComputerName server -Port 443
```

### Caso práctico: "No puedo conectarme al DC"

```powershell
# 1. ¿El equipo tiene IP en la red correcta?
ipconfig /all

# 2. ¿Llego al DC por red?
ping 192.168.100.10

# 3. ¿El DC resuelve por nombre?
nslookup dc01.corp.local

# 4. ¿El servicio LDAP está escuchando?
Test-NetConnection -ComputerName "dc01.corp.local" -Port 389   # LDAP
Test-NetConnection -ComputerName "dc01.corp.local" -Port 88    # Kerberos
Test-NetConnection -ComputerName "dc01.corp.local" -Port 445   # SMB/SYSVOL

# 5. ¿El firewall bloquea?
netsh advfirewall show allprofiles | Select-String "State"
```

---

## 🎤 Preguntas de Entrevista

**1. Explica las 7 capas del modelo OSI y da un ejemplo de protocolo por capa.**
> Capa 7 (Aplicación): HTTP, DNS, SMTP. Capa 6 (Presentación): TLS/SSL, cifrado. Capa 5 (Sesión): SMB, RPC. Capa 4 (Transporte): TCP (confiable, con confirmación), UDP (sin confirmación, más rápido). Capa 3 (Red): IP, ICMP, enrutamiento. Capa 2 (Enlace): Ethernet, MAC addresses, VLANs. Capa 1 (Física): cable, señal eléctrica/óptica.

**2. ¿En qué capa del modelo OSI operan los switches y los routers?**
> Los switches gestionados modernos operan en Capa 2 (MAC addresses, VLANs) y los switches L3 también en Capa 3 (routing entre VLANs). Los routers operan en Capa 3 (routing IP entre redes). Los firewalls modernos (stateful) llegan hasta Capa 4 y los NGFW hasta Capa 7.

**3. ¿Cuál es la diferencia entre TCP y UDP?**
> TCP (Transmission Control Protocol): orientado a conexión (handshake 3-way), garantiza entrega y orden de paquetes, control de flujo. Usado para HTTP, HTTPS, SMTP, FTP. UDP (User Datagram Protocol): sin conexión, no garantiza entrega, más rápido y con menor overhead. Usado para DNS, VoIP, video streaming, juegos online.

**4. Un usuario dice "no tengo internet". ¿Cuál es tu proceso de diagnóstico?**
> Metodología OSI de abajo hacia arriba: 1) `ipconfig /all` → ¿tiene IP? Si no: problema DHCP/Capa 1-2. 2) `ping 127.0.0.1` → ¿funciona el stack local? 3) `ping gateway` → ¿llego al router? 4) `ping 8.8.8.8` → ¿salgo a internet? Si esto funciona pero `ping google.com` falla → problema DNS. 5) `nslookup google.com` → verificar resolución.

**5. ¿Cuándo usas `tracert` y qué información obtienes?**
> `tracert` muestra cada salto (router) en la ruta hasta el destino con su latencia. Se usa para identificar dónde se corta la conectividad (el último salto con respuesta es el punto de falla) y para detectar cuellos de botella o latencia alta en un nodo específico.

**6. ¿Qué hace `ipconfig /flushdns` y cuándo lo usarías?**
> Limpia el cache DNS local del cliente. Se usa cuando: después de cambiar un registro DNS en el servidor (el cliente puede tener cacheado el valor viejo), cuando un sitio web no resuelve correctamente, o después de cambiar el servidor DNS del equipo.

**7. ¿Qué es la tabla ARP y para qué sirve?**
> Address Resolution Protocol: traduce IPs (Capa 3) a MACs (Capa 2). Cuando quieres enviar datos a 192.168.100.10, tu equipo consulta la tabla ARP para saber la MAC correspondiente. Si no está, hace un broadcast ARP. `arp -a` muestra todas las entradas en cache. Es útil para detectar conflictos de IP (dos equipos con la misma IP aparecerán con MACs diferentes).
