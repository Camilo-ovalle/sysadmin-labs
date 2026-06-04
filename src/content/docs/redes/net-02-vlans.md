---
title: 'Lab NET-02 — VLANs y Routing Inter-VLAN'
description: Conceptos de VLANs 802.1Q, segmentación de red, routing inter-VLAN, configuración práctica en VirtualBox con pfSense/OPNsense, y VLAN tagging.
sidebar:
  label: 'NET-02: VLANs'
  badge:
    text: Intermedio
    variant: caution
---

# Lab NET-02 — VLANs y Routing Inter-VLAN

**Prerequisito:** Lab NET-01 completado. Familiaridad con IPs y subredes.  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🏗️ ¿Qué es una VLAN?

Una **VLAN (Virtual LAN)** segmenta una red física en múltiples redes lógicas aisladas, como si fueran switches físicos separados pero en el mismo hardware.

### Sin VLANs
```
[PC Contabilidad]──┐
[PC IT]────────────┼──[Switch]──[Router]──Internet
[PC RRHH]──────────┘
  └── Todos en el mismo broadcast domain
  └── Un PC infectado puede ver el tráfico de todos los demás
```

### Con VLANs
```
[PC Contabilidad] ──── VLAN 10 (192.168.10.x) ─┐
[PC IT]           ──── VLAN 20 (192.168.20.x) ──┼──[Switch VLAN]──[Router L3]──Internet
[PC RRHH]         ──── VLAN 30 (192.168.30.x) ─┘
  └── Tráfico aislado por VLAN
  └── Solo el router permite tráfico entre VLANs (con control)
```

### Beneficios de las VLANs
- **Seguridad**: aislar departamentos (Finanzas no puede ver IT)
- **Rendimiento**: reducir dominios de broadcast
- **Gestión**: políticas diferentes por VLAN (QoS, DHCP scope, firewall rules)
- **Flexibilidad**: usuarios del mismo departamento en pisos diferentes → misma VLAN

---

## 📡 Estándar 802.1Q — VLAN Tagging

Para que el tráfico de múltiples VLANs viaje por el mismo cable (enlace troncal), se usa el estándar **IEEE 802.1Q**: se añade una etiqueta (tag) de 4 bytes a la trama Ethernet con el ID de VLAN (1–4094).

### Puertos Access vs Trunk

| Tipo | Descripción | Conecta a |
|---|---|---|
| **Access port** | Solo pertenece a una VLAN, sin tag | Equipos de usuario (PC, impresoras) |
| **Trunk port** | Transporta múltiples VLANs etiquetadas | Entre switches, o switch→router |

```
PC Contabilidad ──[access port VLAN 10]── Switch ──[trunk port]── Router
```

---

## 🛠️ Lab Práctico: VLANs en VirtualBox con pfSense

### Arquitectura del lab

```
Red: 192.168.10.0/24 (VLAN 10 - Contabilidad)
Red: 192.168.20.0/24 (VLAN 20 - IT)
Red: 192.168.100.0/24 (Gestión / DC)

VM pfSense    → Router/Firewall inter-VLAN
VM WKSTN-10   → Simula VLAN 10 (Contabilidad)
VM WKSTN-20   → Simula VLAN 20 (IT)
VM DC01       → En red de gestión
```

> **Nota VirtualBox:** En VirtualBox, las redes internas (`Internal Network`) actúan como VLANs separadas. Puedes crear `intnet-vlan10`, `intnet-vlan20`, etc. pfSense actúa como el router inter-VLAN.

### Paso 1: Crear las redes en VirtualBox

Para cada VM (WKSTN-10, WKSTN-20), en Configuración → Red:
- Adaptador 1: **Internal Network** → Name: `intnet-vlan10` (o `intnet-vlan20`)

Para pfSense:
- Adaptador 1: NAT (para internet)
- Adaptador 2: Internal Network → `intnet-vlan10`
- Adaptador 3: Internal Network → `intnet-vlan20`
- Adaptador 4: Internal Network → `intnet-corp` (red de gestión)

### Paso 2: Instalar y configurar pfSense

1. Descarga la ISO de pfSense Community Edition de `pfsense.org`
2. Crea una VM: 1 vCPU, 1 GB RAM, los 4 adaptadores
3. Instala pfSense siguiendo el asistente
4. Configura las interfaces en la consola pfSense:
   - WAN: em0 (NAT de VirtualBox)
   - LAN: em1 → renombrar a VLAN10 → IP: `192.168.10.1/24`
5. Agrega interfaces adicionales:
   - em2 → VLAN20 → IP: `192.168.20.1/24`
   - em3 → CORP → IP: `192.168.100.1/24`

### Paso 3: Configurar los clientes

**WKSTN-10 (Contabilidad)**:
```powershell
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress "192.168.10.100" -PrefixLength 24 -DefaultGateway "192.168.10.1"
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "192.168.100.10"
```

**WKSTN-20 (IT)**:
```powershell
New-NetIPAddress -InterfaceAlias "Ethernet" -IPAddress "192.168.20.100" -PrefixLength 24 -DefaultGateway "192.168.20.1"
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "192.168.100.10"
```

### Paso 4: Verificar aislamiento de VLANs

Desde WKSTN-10, intenta hacer ping a WKSTN-20:
```cmd
ping 192.168.20.100
```

Con pfSense sin reglas de firewall entre VLANs, el ping debería **fallar** (VLANs aisladas). Esto demuestra el aislamiento de seguridad.

### Paso 5: Configurar routing inter-VLAN en pfSense

En pfSense Web GUI (`https://192.168.10.1`):
1. **Firewall → Rules → VLAN10**: agrega regla "Pass" de VLAN10 a VLAN20 (o de forma más restrictiva, solo los puertos necesarios)
2. Ahora el ping de WKSTN-10 a WKSTN-20 debería funcionar

---

## 🔧 VLANs en Linux (netplan / ip command)

En Linux puedes crear interfaces VLAN virtuales sobre una interfaz física:

```bash
# Crear subinterfaz VLAN 10 sobre eth0
ip link add link eth0 name eth0.10 type vlan id 10
ip addr add 192.168.10.1/24 dev eth0.10
ip link set eth0.10 up

# Ver interfaces VLAN
ip -d link show type vlan
```

**Configuración permanente con netplan** (Ubuntu Server):

```yaml
# /etc/netplan/01-netcfg.yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
  vlans:
    eth0.10:
      id: 10
      link: eth0
      addresses: [192.168.10.1/24]
    eth0.20:
      id: 20
      link: eth0
      addresses: [192.168.20.1/24]
```

```bash
netplan apply
```

---

## 📊 Subnetting Rápido

Para diseñar VLANs necesitas asignar subredes correctamente:

| Prefijo | Máscara | Hosts disponibles | Uso típico |
|---|---|---|---|
| `/30` | 255.255.255.252 | 2 | Links punto a punto |
| `/29` | 255.255.255.248 | 6 | Segmentos pequeños |
| `/28` | 255.255.255.240 | 14 | Grupos pequeños |
| `/27` | 255.255.255.224 | 30 | Grupos medianos |
| `/24` | 255.255.255.0 | 254 | VLAN departamental típica |
| `/23` | 255.255.254.0 | 510 | VLANs grandes |
| `/22` | 255.255.252.0 | 1022 | Redes corporativas grandes |

### Ejemplo de diseño de VLANs corporativas

```
VLAN 10  192.168.10.0/24   Contabilidad    (hasta 254 hosts)
VLAN 20  192.168.20.0/24   IT              (hasta 254 hosts)
VLAN 30  192.168.30.0/24   RRHH            (hasta 254 hosts)
VLAN 40  192.168.40.0/24   Gerencia        (hasta 254 hosts)
VLAN 50  192.168.50.0/24   Wi-Fi empleados (hasta 254 hosts)
VLAN 60  192.168.60.0/24   Wi-Fi visitantes (hasta 254 hosts)
VLAN 99  192.168.99.0/24   Management/Gestión
VLAN 100 192.168.100.0/24  Servidores
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué es una VLAN y para qué sirve?**
> Una VLAN es una segmentación lógica de una red física en múltiples redes virtuales aisladas. Sirve para: separar departamentos por seguridad (Finanzas no ve el tráfico de IT), reducir dominios de broadcast, aplicar políticas diferentes por segmento, y separar tráfico de usuarios, servidores y gestión sin necesitar hardware físico separado.

**2. ¿Qué diferencia hay entre un puerto access y un puerto trunk?**
> Access: pertenece a una sola VLAN, no añade etiquetas 802.1Q, se conecta a dispositivos finales (PCs). Trunk: transporta tráfico de múltiples VLANs etiquetadas con 802.1Q, se conecta entre switches o entre switch y router. El tráfico no etiquetado en un trunk pertenece a la "native VLAN".

**3. ¿Qué es el estándar 802.1Q?**
> Es el estándar IEEE para VLAN tagging. Añade una etiqueta de 4 bytes a la trama Ethernet que incluye el VLAN ID (1–4094) y la prioridad 802.1p (QoS). Permite que un solo enlace físico (trunk) transporte tráfico de múltiples VLANs identificado por etiqueta.

**4. ¿Cómo permitirías que equipos de la VLAN 10 se comuniquen con equipos de la VLAN 20?**
> Las VLANs están aisladas a capa 2; para comunicarlas necesitas routing de capa 3. Opciones: 1) Router-on-a-stick: una sola interfaz del router con subinterfaces 802.1Q para cada VLAN. 2) Switch L3: el switch tiene capacidad de routing y enruta entre VLANs internamente. 3) Firewall (como pfSense): actúa como router inter-VLAN con control de acceso.

**5. Tienes un servidor en la VLAN de servidores que necesitan acceder todos los departamentos. ¿Cómo lo implementas?**
> El servidor tiene IP en VLAN 100 (servidores). En el router/firewall, creas reglas que permiten el tráfico de cada VLAN departamental hacia la IP del servidor en el puerto necesario (ej: 443 para HTTPS). El tráfico entre VLANs pasa por el router, donde puedes auditarlo y controlarlo.

**6. ¿Qué es la "native VLAN" en un trunk 802.1Q?**
> El tráfico no etiquetado que llega a un puerto trunk se asigna a la native VLAN. Por defecto es VLAN 1 en switches Cisco. Por seguridad, se recomienda cambiar la native VLAN a una VLAN no utilizada para evitar ataques de VLAN hopping.

**7. ¿Cómo crearías una VLAN de visitantes Wi-Fi aislada de la red corporativa?**
> 1. Crear VLAN 60 en el switch (ej: `192.168.60.0/24`). 2. Configurar el Access Point para emitir un SSID de visitantes en VLAN 60. 3. El puerto del AP en el switch es trunk (para poder mandar la VLAN 60 etiquetada). 4. En el firewall, la VLAN 60 solo tiene acceso a internet (sin acceso a VLANs corporativas). 5. Un scope DHCP separado para la VLAN 60 en el servidor DHCP.
