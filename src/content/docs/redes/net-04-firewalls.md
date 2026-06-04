---
title: 'Lab NET-04 — Firewalls: Cisco ASA, Palo Alto y pfSense'
description: Conceptos de firewalls, configuración inicial (Cisco ASA y Palo Alto), reglas de acceso, NAT, acceso de gestión vía SSH/HTTPS, y práctica con pfSense/OPNsense en VirtualBox.
sidebar:
  label: 'NET-04: Firewalls'
  badge:
    text: Avanzado
    variant: danger
---

# Lab NET-04 — Firewalls: Cisco ASA, Palo Alto y pfSense

**Prerequisito:** Labs NET-01, NET-02 completados. Familiaridad con IPs, VLANs y subredes.  
**Duración estimada:** 2–3 horas (pfSense práctico + teoría Cisco/Palo Alto)  
**Dificultad:** Avanzado

---

## 🔥 ¿Qué es un Firewall y qué tipos existen?

Un **firewall** controla el tráfico de red entre zonas con diferentes niveles de confianza, permitiendo o bloqueando conexiones según políticas.

### Tipos de firewall

| Tipo | Características | Ejemplo |
|---|---|---|
| **Stateless (packet filter)** | Analiza paquetes individualmente sin contexto | `iptables` básico, ACLs de router |
| **Stateful (SPI)** | Rastrea el estado de las conexiones, entiende TCP sessions | Cisco ASA, pfSense |
| **Application-layer / NGFW** | Inspección hasta capa 7 (apps), IPS, URL filtering | Palo Alto NGFW, Fortinet FortiGate |
| **WAF** | Específico para tráfico HTTP/HTTPS | F5, Cloudflare |

### Zonas típicas de un firewall

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   OUTSIDE    │    │     DMZ      │    │    INSIDE    │
│  (Internet)  │───▶│  (Servidores │───▶│  (LAN corp)  │
│  Trust: 0    │    │   públicos)  │    │  Trust: 100  │
└──────────────┘    │  Trust: 50   │    └──────────────┘
                    └──────────────┘
```

- **Inside/Trust**: red interna corporativa — máxima confianza
- **DMZ**: servidores accesibles desde internet (web, email, DNS público) — confianza media
- **Outside/Untrust**: internet — confianza mínima

---

## 🔵 Cisco ASA — Conceptos y Comandos

### Interfaz de gestión inicial

El Cisco ASA se configura principalmente por CLI (SSH o consola serial). Acceso inicial:

```bash
# Puerto de consola → serial (cable rollover) → terminal
# Baudios: 9600, 8N1

# O SSH si ya está configurado
ssh admin@192.168.1.1
```

### Configuración inicial de Cisco ASA

```cisco
! Entrar en modo privilegiado
enable
! Contraseña enable

! Entrar en modo configuración
configure terminal

! Configurar interfaces
interface GigabitEthernet0/0
 nameif outside
 security-level 0
 ip address 203.0.113.1 255.255.255.252
 no shutdown

interface GigabitEthernet0/1
 nameif inside
 security-level 100
 ip address 192.168.100.1 255.255.255.0
 no shutdown

interface GigabitEthernet0/2
 nameif dmz
 security-level 50
 ip address 172.16.0.1 255.255.255.0
 no shutdown
```

> **Security Level en ASA**: 0–100. El tráfico fluye libremente de zonas de **mayor** a **menor** nivel de seguridad (inside→outside es libre por defecto). Para el sentido contrario necesitas reglas explícitas.

### Access Control Lists (ACLs) en ASA

```cisco
! Crear ACL para permitir HTTP/HTTPS desde internet a servidor en DMZ
access-list OUTSIDE_IN extended permit tcp any host 172.16.0.10 eq 80
access-list OUTSIDE_IN extended permit tcp any host 172.16.0.10 eq 443

! Aplicar ACL a la interfaz outside (tráfico entrante)
access-group OUTSIDE_IN in interface outside

! Permitir tráfico específico desde inside a outside (si security level < 100)
access-list INSIDE_OUT extended permit ip 192.168.100.0 255.255.255.0 any
access-group INSIDE_OUT in interface inside
```

### NAT en Cisco ASA

```cisco
! PAT (Overload NAT): toda la red interna sale con la IP del outside
object network INSIDE_NET
 subnet 192.168.100.0 255.255.255.0
 nat (inside,outside) dynamic interface

! Static NAT: servidor web en DMZ visible desde internet
object network WEBSERVER_DMZ
 host 172.16.0.10
 nat (dmz,outside) static 203.0.113.5
```

### Habilitar SSH en ASA (gestión remota)

```cisco
! Crear clave RSA
crypto key generate rsa modulus 2048

! Permitir SSH desde la red de gestión
ssh 192.168.100.0 255.255.255.0 inside
ssh timeout 30

! Configurar AAA para autenticación local
username admin password MiContraseñaSegura privilege 15
aaa authentication ssh console LOCAL
```

### Comandos de diagnóstico Cisco ASA

```cisco
show interface ip brief           ! Ver IPs de todas las interfaces
show route                        ! Tabla de rutas
show conn                         ! Conexiones activas
show access-list                  ! Ver ACLs y contadores de hits
show nat                          ! Ver traducciones NAT activas
show logging                      ! Ver logs del firewall
debug icmp trace                  ! Debuggear tráfico ICMP en tiempo real
packet-tracer input inside tcp 192.168.100.100 12345 8.8.8.8 80
! Simular un paquete y ver si es permitido/bloqueado
```

---

## 🟠 Palo Alto NGFW — Conceptos y Acceso Inicial

### Arquitectura Palo Alto

Palo Alto usa un modelo de **zonas de seguridad** (similar a ASA) pero con inspección de capa 7 por aplicación (App-ID) y usuario (User-ID).

- **App-ID**: identifica la aplicación real (no solo el puerto) — puede detectar Facebook aunque use puerto 443
- **User-ID**: asocia IPs con usuarios de AD para aplicar políticas por usuario
- **Content-ID**: inspección de contenido, IPS, antivirus, URL filtering

### Acceso inicial a Palo Alto

```bash
# Acceso inicial via HTTPS al puerto de gestión
https://192.168.1.1
# Usuario: admin / Contraseña: admin (cambiar inmediatamente)

# SSH para CLI
ssh admin@192.168.1.1
```

### Flujo de configuración básica en Palo Alto

1. **Network → Interfaces**: asignar interfaces a zonas (untrust/trust/dmz)
2. **Network → Zones**: crear zonas y asignar interfaces
3. **Policies → Security**: crear reglas de seguridad (zona origen → zona destino → aplicación → acción)
4. **Policies → NAT**: configurar NAT si es necesario
5. **Commit**: **todos los cambios requieren un `commit` para activarse**

### Comandos CLI de Palo Alto

```bash
# Ver modo configuración / operativo
> show system info
> show interface all
> show routing route
> show session all
> show counter global filter severity drop

# Para configurar
# configure (entrar en modo config)
# commit (aplicar cambios)
# show running-config
```

### Regla de seguridad básica en Palo Alto

Las reglas se aplican de arriba hacia abajo, primera que coincide gana:

```
Regla 1: Allow-Users-Internet
  Fuente: zona trust | VLAN 10, 20, 30
  Destino: zona untrust | any
  Aplicación: web-browsing, ssl, dns
  Acción: Allow | Log

Regla 2: Block-All
  Fuente: any
  Destino: any
  Aplicación: any
  Acción: Deny | Log
```

---

## 🟢 Lab Práctico: pfSense en VirtualBox

pfSense es un firewall open source basado en FreeBSD. Ideal para practicar los conceptos antes de aplicarlos en Cisco/Palo Alto.

### Instalación rápida

1. Descargar ISO de `pfsense.org` (Community Edition)
2. Crear VM: 1 vCPU, 1 GB RAM
3. Red: Adaptador 1 (WAN) = NAT, Adaptador 2 (LAN) = Internal Network
4. Instalar siguiendo el asistente
5. Acceder a GUI: `https://192.168.1.1` (user: admin / pass: pfsense)

### Reglas de firewall en pfSense

En `Firewall → Rules → LAN`:

- pfSense por defecto permite todo el tráfico desde LAN → WAN
- Para bloquear: agrega reglas en la interfaz de origen

Ejemplo: bloquear acceso a redes sociales desde VLAN de usuarios:

```
Rule 1 (Block Social Media):
  Interface: LAN
  Source: LAN subnet
  Destination: Alias "SocialMedia" (IPs de Facebook, Instagram, etc.)
  Protocol: TCP
  Ports: 80, 443
  Action: Block

Rule 2 (Allow All):
  Interface: LAN
  Source: LAN subnet
  Destination: any
  Action: Pass
```

### NAT en pfSense

pfSense hace NAT automáticamente (Outbound NAT automático). Para Static NAT (Port Forward):

`Firewall → NAT → Port Forward`:
- Interface: WAN
- Destination: WAN address
- Destination Port: 443
- Redirect target IP: 192.168.100.50 (servidor web interno)
- Redirect target port: 443

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre un firewall stateful y uno stateless?**
> Stateless (packet filter): examina cada paquete independientemente sin recordar conexiones previas. Más rápido pero menos inteligente. Stateful: rastrea el estado de las conexiones TCP (SYN, ESTABLISHED, FIN) y permite automáticamente el tráfico de retorno de conexiones establecidas. Los firewalls modernos son todos stateful.

**2. ¿Cómo configurarías el acceso inicial a un Cisco ASA o Palo Alto recién instalado?**
> Cisco ASA: conectar por cable de consola (serial/USB), baudios 9600, configurar la interfaz de gestión con IP estática, habilitar SSH (`crypto key generate rsa`, `ssh <red> <máscara> <interfaz>`, usuario local). Palo Alto: la interfaz de gestión (MGT) viene con IP 192.168.1.1; conectar directo por cable, acceder por HTTPS, cambiar contraseña inmediatamente, luego configurar IP de gestión definitiva.

**3. ¿Qué es NAT y para qué se usa en un firewall?**
> Network Address Translation: traduce IPs privadas (RFC 1918) a IPs públicas para que los equipos internos puedan comunicarse con internet. PAT (Port Address Translation / Overload NAT): múltiples IPs privadas salen con una sola IP pública diferenciadas por puerto — es lo que usa tu router de casa. Static NAT: mapea una IP pública a una IP privada fija (para servidores que deben ser accesibles desde internet).

**4. Explica qué es una DMZ y qué se pone ahí.**
> La DMZ (DeMilitarized Zone) es una zona de red semi-confiable entre internet y la red interna. Se ponen los servidores accesibles desde internet: servidores web, servidores de correo, DNS público, proxies. La DMZ permite que si un servidor es comprometido, el atacante no llega directamente a la red interna (hay una segunda línea de defensa del firewall).

**5. ¿Cuál es la diferencia entre un NGFW y un firewall clásico?**
> Un NGFW (Next-Generation Firewall) como Palo Alto añade: App-ID (identificar aplicaciones por comportamiento, no solo por puerto), User-ID (políticas por usuario de AD, no solo por IP), IPS (prevención de intrusiones integrada), URL filtering, SSL inspection (descifrar HTTPS para inspeccionarlo), y sandboxing de malware.

**6. ¿Cómo harías rollback de un cambio de firewall que dejó caer la conectividad?**
> En Cisco ASA: `copy startup-config running-config` para volver a la config guardada, o `reload in 15` antes de hacer el cambio (si no cancelas en 15 min, reinicia solo). En Palo Alto: `revert to running config` en GUI si no hiciste commit; si ya hiciste commit, ir a Device → Setup → Operations → Revert to last saved. Siempre trabajar con ventanas de mantenimiento y un segundo acceso de gestión independiente.

**7. Has trabajado con Cisco Firewall y Palo Alto en tu experiencia. ¿Cuál preferirías y por qué?**
> Palo Alto es superior en visibilidad y seguridad moderna (App-ID, User-ID, threat prevention integrado). Cisco ASA es más maduro, ampliamente desplegado y tiene una CLI muy conocida en la industria. Para un entorno nuevo, Palo Alto; para entornos existentes con inversión en Cisco, ASA o la nueva línea Firepower/FTD (que añade NGFW sobre la base ASA).
