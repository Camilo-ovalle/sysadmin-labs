---
title: 'Lab DNS — DNS en Windows Server'
description: Instalación y configuración del rol DNS en Windows Server 2022. Zonas directas e inversas, registros, forwarders, integración con AD y diagnóstico.
sidebar:
  label: 'Lab DNS: Windows DNS Server'
  badge:
    text: Intermedio
    variant: caution
---

# Lab DNS — DNS en Windows Server (on-premise)

**Prerequisito:** DC con AD DS configurado (Labs 01–04). El DC ya tiene DNS instalado por defecto; este lab lo profundiza y lo amplía a un segundo servidor.  
**Duración estimada:** 2–3 horas  
**Dificultad:** Intermedio

---

## 🏗️ ¿Qué es DNS y por qué es crítico en un dominio?

**Domain Name System (DNS)** traduce nombres a IPs. En un entorno AD es absolutamente crítico:

- Los clientes necesitan resolver `corp.local` para encontrar el DC
- Kerberos usa DNS para encontrar el KDC
- Si DNS falla → los usuarios no pueden iniciar sesión, las GPOs no se aplican, los equipos no encuentran el dominio

```
Cliente Windows
    │ "¿Qué IP tiene dc01.corp.local?"
    ▼
Servidor DNS (el DC)
    │ Busca en zona corp.local → A record → 192.168.100.10
    ▼
Cliente recibe 192.168.100.10 → conecta al DC
```

---

## 🖥️ Parte 1: Verificar y Configurar DNS en el DC Existente

El DC ya tiene el rol DNS instalado cuando promoviste el dominio. Vamos a revisarlo y configurarlo correctamente.

### 1.1 Abrir la consola DNS

```
Server Manager → Tools → DNS
```

O desde PowerShell:
```powershell
dnsmgmt.msc
```

### 1.2 Estructura de zonas en corp.local

En la consola DNS deberías ver:

```
DC01 (Servidor DNS)
├── Forward Lookup Zones
│   ├── _msdcs.corp.local   ← Zonas especiales de AD (SRV records)
│   └── corp.local          ← Tu zona principal
└── Reverse Lookup Zones
    └── 100.168.192.in-addr.arpa  ← Zona inversa (IP → nombre)
```

### 1.3 Verificar registros SRV (críticos para AD)

Los registros SRV permiten que los clientes encuentren los servicios del dominio:

```powershell
# Verificar registros SRV del dominio
nslookup -type=srv _ldap._tcp.corp.local
nslookup -type=srv _kerberos._tcp.corp.local
nslookup -type=srv _gc._tcp.corp.local
```

Si estos registros no existen, el dominio no funciona correctamente. Para regenerarlos:

```powershell
# En el DC, forzar re-registro de registros DNS
ipconfig /registerdns
net stop netlogon && net start netlogon
```

---

## 🗂️ Parte 2: Tipos de Zonas DNS

### Zonas de búsqueda directa (Forward Lookup Zones)
Traducen **nombre → IP**

### Zonas de búsqueda inversa (Reverse Lookup Zones)
Traducen **IP → nombre** — muchos servicios y herramientas de diagnóstico las usan

### Tipos de zona por almacenamiento

| Tipo | Almacenamiento | Cuándo usar |
|---|---|---|
| **Primary** | Archivo .dns en el servidor | Servidor maestro, solo uno por zona |
| **Secondary** | Copia de solo lectura desde Primary | Redundancia, distribución de carga |
| **AD-Integrated** | Base de datos de AD (NTDS.dit) | **Recomendado en dominios AD**: replica automáticamente entre todos los DCs |
| **Stub** | Solo SOA, NS y glue records | Delegar zonas a otro servidor DNS |

> **Buena práctica:** En entornos AD, usa siempre zonas **AD-Integrated**. Se replican automáticamente a todos los DCs sin configuración adicional.

---

## 📝 Parte 3: Tipos de Registros DNS

### Registros más importantes

| Tipo | Función | Ejemplo |
|---|---|---|
| **A** | Nombre → IPv4 | `dc01.corp.local` → `192.168.100.10` |
| **AAAA** | Nombre → IPv6 | `dc01.corp.local` → `::1` |
| **PTR** | IP → Nombre (inverso) | `192.168.100.10` → `dc01.corp.local` |
| **CNAME** | Alias (nombre → nombre) | `www.corp.local` → `iis01.corp.local` |
| **MX** | Servidor de correo | `corp.local` → `mail01.corp.local` (priority 10) |
| **SRV** | Servicio y puerto | `_ldap._tcp.corp.local` → puerto 389 en dc01 |
| **NS** | Servidor de nombres autorizado | `corp.local` NS → `dc01.corp.local` |
| **SOA** | Start of Authority | Info del servidor maestro y TTL |
| **TXT** | Texto libre | SPF, DMARC, verificaciones de dominio |

### 3.1 Crear un registro A manualmente

En la consola DNS → Forward Lookup Zones → `corp.local` → clic derecho → **New Host (A)**:

- Name: `webserver01`
- IP: `192.168.100.50`
- ✅ Create associated pointer (PTR) record

```powershell
# Equivalente en PowerShell
Add-DnsServerResourceRecordA -ZoneName "corp.local" -Name "webserver01" -IPv4Address "192.168.100.50" -CreatePtr
```

### 3.2 Crear un registro CNAME

```powershell
Add-DnsServerResourceRecordCName -ZoneName "corp.local" -Name "www" -HostNameAlias "webserver01.corp.local"
```

### 3.3 Crear una zona inversa

En la consola DNS → Reverse Lookup Zones → New Zone:

- Zone type: **Primary zone** (o AD-Integrated)
- Network ID: `192.168.100`

```powershell
Add-DnsServerPrimaryZone -NetworkID "192.168.100.0/24" -ReplicationScope "Forest"
```

---

## 🔀 Parte 4: Forwarders y Resolución Externa

Los **forwarders** indican al DNS local adónde enviar las consultas que no puede resolver (ej: `google.com`).

### 4.1 Configurar forwarders

En la consola DNS → propiedades del servidor → pestaña **Forwarders**:

Agrega los servidores DNS de reenvío (por ejemplo, DNS de tu ISP o públicos):

```
8.8.8.8   (Google DNS)
1.1.1.1   (Cloudflare)
```

```powershell
# Agregar forwarders via PowerShell
Add-DnsServerForwarder -IPAddress "8.8.8.8","1.1.1.1"
Get-DnsServerForwarder
```

### 4.2 Conditional Forwarders (para dominios híbridos)

Si tienes un dominio adicional (ej: `azure.corp.local`) en otro servidor DNS:

```powershell
# Reenviar consultas de azure.corp.local al servidor 10.0.0.4
Add-DnsServerConditionalForwarderZone -Name "azure.corp.local" -MasterServers "10.0.0.4"
```

Esto es clave en entornos híbridos con Azure DNS.

---

## 🔍 Parte 5: Diagnóstico DNS

### 5.1 Herramientas de diagnóstico

```powershell
# Consulta básica
nslookup dc01.corp.local

# Consultar un servidor específico
nslookup dc01.corp.local 192.168.100.10

# Consulta de tipo específico
nslookup -type=MX corp.local
nslookup -type=SRV _ldap._tcp.corp.local

# PowerShell moderno (recomendado)
Resolve-DnsName -Name "dc01.corp.local" -Type A
Resolve-DnsName -Name "corp.local" -Type SRV -Server "192.168.100.10"

# Ver cache DNS del cliente
Get-DnsClientCache

# Limpiar cache DNS del cliente
Clear-DnsClientCache

# Registrar el equipo en DNS
ipconfig /registerdns
```

```cmd
# CMD clásico
ipconfig /displaydns       -- ver cache local
ipconfig /flushdns         -- limpiar cache
```

### 5.2 Diagnóstico completo del DNS del DC

```powershell
# Verificar el rol DNS del DC
dcdiag /test:dns /v

# Ver todos los registros de una zona
Get-DnsServerResourceRecord -ZoneName "corp.local" -RRType "A"

# Ver estadísticas del servicio DNS
Get-DnsServerStatistics

# Ver Event Viewer de DNS
Get-EventLog -LogName "DNS Server" -Newest 20
```

### 5.3 Problema: el cliente no resuelve corp.local

```
1. Verificar que el DNS del cliente apunta a la IP del DC: ipconfig /all
2. Ping al DC: ping 192.168.100.10
3. Ping por nombre: ping dc01.corp.local
4. Si ping por IP funciona pero por nombre no → problema DNS
5. nslookup dc01.corp.local 192.168.100.10 → consulta directa al DC
6. Revisar que el servicio DNS esté corriendo en el DC: Get-Service DNS
```

---

## 🔄 Parte 6: DNS Dinámico (DDNS)

Active Directory registra y actualiza automáticamente los registros DNS de los equipos del dominio cuando se les asigna IP por DHCP.

### Configurar actualización dinámica en la zona

En la consola DNS → propiedades de la zona `corp.local` → **Dynamic updates**: `Secure only` (recomendado para zonas AD-Integrated).

```powershell
Set-DnsServerPrimaryZone -Name "corp.local" -DynamicUpdate "Secure"
```

### Forzar actualización desde el cliente

```powershell
# Registrar el equipo en DNS inmediatamente
ipconfig /registerdns

# Verificar desde el DC
Get-DnsServerResourceRecord -ZoneName "corp.local" -Name "WKSTN-01"
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué pasaría si el servidor DNS deja de funcionar en un dominio AD?**
> Los clientes no podrían resolver `corp.local`, por lo que no encontrarían el DC. Kerberos fallaría → nadie puede hacer login. Las GPOs dejan de aplicarse (el cliente no encuentra `sysvol.corp.local`). Los servicios que dependen de AD (Exchange, SCCM, SharePoint) también fallan.

**2. ¿Qué diferencia hay entre una zona Primary, Secondary y AD-Integrated?**
> Primary: el servidor con la copia de escritura, un solo servidor es autorizado. Secondary: copia de solo lectura desde el Primary, útil para redundancia pero requiere transferencia de zona. AD-Integrated: almacena la zona en AD y replica automáticamente a todos los DCs; es la mejor opción en entornos AD porque tiene replicación multi-master y seguridad integrada.

**3. ¿Qué son los registros SRV y por qué son importantes en AD?**
> Los SRV records permiten que los clientes encuentren servicios del dominio (LDAP en puerto 389, Kerberos en 88, Global Catalog en 3268). Sin registros SRV, los clientes Windows no pueden encontrar el DC aunque tengan el nombre del dominio. Se crean automáticamente al instalar AD, registrados por el servicio Netlogon.

**4. ¿Qué es un Conditional Forwarder y cuándo lo usarías?**
> Reenvía consultas de un dominio específico a un servidor DNS específico, en lugar de usar los forwarders generales. Se usa en entornos híbridos: las consultas de `corp.local` van al DNS on-prem, las de `azure.corp.local` van al DNS de Azure, y las del resto van a internet. Evita que consultas internas salgan a internet.

**5. ¿Cómo diagnosticarías que un equipo cliente no puede resolver nombres del dominio?**
> 1. `ipconfig /all` → verificar que el DNS preferido apunta al DC. 2. `nslookup dc01.corp.local` → si falla, el problema es DNS. 3. `ping 192.168.100.10` → si esto funciona, la red está bien pero DNS no. 4. `nslookup dc01.corp.local 192.168.100.10` → consulta directa al servidor. 5. En el DC: `Get-Service DNS` y revisar Event Viewer → DNS Server.

**6. ¿Qué es el TTL en DNS y cómo afecta los cambios?**
> Time To Live: tiempo en segundos que otros servidores y clientes cachean el registro. Si tienes TTL=3600 y cambias una IP, los clientes seguirán usando la IP vieja hasta 1 hora. Antes de un cambio planificado, reduce el TTL a 300s con antelación; después del cambio, auméntalo de nuevo a 3600s.

**7. ¿Qué diferencia hay entre `nslookup` y `Resolve-DnsName`?**
> `nslookup` es la herramienta clásica (disponible en Linux y Windows) pero interactiva y con sintaxis poco amigable. `Resolve-DnsName` es el cmdlet PowerShell moderno, devuelve objetos manipulables en pipeline, tiene mejor soporte de tipos de registro y es el estándar recomendado en entornos Windows modernos.
