---
title: 'Banco de Preguntas de Entrevista'
description: Preguntas y respuestas clave para la entrevista técnica de SysAdmin. Organizadas por tema y enlazadas a cada laboratorio. Repaso rápido antes de la entrevista.
sidebar:
  label: 'Banco de Preguntas'
  badge:
    text: 🎤 Entrevista
    variant: tip
---

# Banco de Preguntas de Entrevista — SysAdmin

Consolidado de todas las preguntas de entrevista de los laboratorios. Repasa este banco antes de la entrevista técnica con Isa y Eric.

> **Consejo:** No memorices las respuestas. Entiende los conceptos y habla con tu experiencia real. Si en la entrevista mencionas tu herramienta de recolección de logs, el servidor Ubuntu en casa, o los laboratorios que completaste, eso diferencia una respuesta genérica de una auténtica.

---

## 🏢 Active Directory y GPO

→ Ver labs: [Lab 01](/labs/lab-01-ad-gpo/) · [Lab 02](/labs/lab-02-gpo-avanzado/) · [Lab 03](/labs/lab-03-grupos-rbac/) · [Lab 04](/labs/lab-04-usuarios-avanzado/)

**¿Qué es Active Directory y para qué sirve?**
> Servicio de directorio de Microsoft que centraliza autenticación (Kerberos/LDAP), gestión de usuarios/equipos/políticas y recursos en un dominio. Permite administrar miles de equipos desde un punto central.

**¿Cuántos Domain Controllers necesitas en producción?**
> Mínimo 2. Sin redundancia, si el DC cae todos los logins y GPOs fallan. Se recomienda uno por sitio físico en organizaciones distribuidas.

**¿Qué diferencia hay entre una OU y un grupo?**
> OUs son contenedores para organizar objetos y aplicar GPOs. Grupos son para asignar permisos a recursos. No puedes aplicar GPOs directamente a grupos de seguridad.

**¿Qué es el orden LSDOU?**
> Local → Site → Domain → OU. El último en aplicar gana en conflictos. La GPO de OU tiene mayor prioridad que la del dominio.

**¿Qué es el Loopback Processing?**
> Aplica las políticas de `User Configuration` del GPO del equipo (no del usuario), independientemente de qué usuario inicia sesión. Útil en kioscos, salas de reunión o laboratorios.

**¿Qué es AGDLP?**
> Account → Global Group → Domain Local Group → Permission. Usuarios en Global Groups (por departamento), Global Groups en Domain Local Groups (por recurso), Domain Local Groups reciben permisos NTFS. Escala en entornos multi-dominio.

**¿Qué son las Fine-Grained Password Policies?**
> Permiten políticas de contraseña diferentes por grupo dentro del mismo dominio. Ejemplo: admins con 16 chars y 60 días, usuarios normales con 12 chars y 90 días.

**¿Qué es una gMSA?**
> Group Managed Service Account: AD gestiona automáticamente la contraseña (120 chars, rota cada 30 días). Ideal para servicios Windows (IIS, SQL Agent) donde antes ponías una cuenta con contraseña fija.

---

## 🌐 DNS

→ Ver lab: [DNS en Windows Server](/redes/win-dns/)

**¿Qué pasaría si el servidor DNS falla en un dominio AD?**
> Los clientes no resolverían `corp.local` → no encontrarían el DC → Kerberos falla → nadie puede hacer login. Las GPOs dejan de aplicarse. Todos los servicios que dependen de AD fallan.

**¿Diferencia entre zona Primary, Secondary y AD-Integrated?**
> Primary: servidor maestro con la copia de escritura. Secondary: copia de solo lectura. AD-Integrated: almacenada en AD, se replica automáticamente entre todos los DCs — es la opción recomendada en entornos AD.

**¿Qué son los registros SRV y por qué son críticos en AD?**
> Permiten que los clientes encuentren servicios del dominio (LDAP 389, Kerberos 88, Global Catalog 3268). Sin SRV records, los clientes no pueden encontrar el DC aunque resuelvan el nombre del dominio.

**¿Qué es un Conditional Forwarder?**
> Reenvía consultas de un dominio específico a un servidor DNS específico. Clave en entornos híbridos: consultas de `corp.local` → DNS on-prem, `azure.corp.local` → DNS de Azure.

**¿Cómo diagnosticas que un cliente no resuelve nombres del dominio?**
> 1. `ipconfig /all` → verificar DNS apunta al DC. 2. `ping 192.168.100.10` → conectividad de red. 3. `nslookup dc01.corp.local 192.168.100.10` → consulta directa al servidor. 4. En el DC: `Get-Service DNS` y Event Viewer → DNS Server.

---

## 📡 DHCP

→ Ver lab: [DHCP en Windows Server](/redes/win-dhcp/)

**Explica el proceso DORA.**
> Discover (broadcast del cliente) → Offer (servidor ofrece IP) → Request (cliente acepta) → Acknowledge (servidor confirma con IP, máscara, gateway, DNS y lease time).

**¿Qué es un DHCP Relay Agent?**
> Los broadcasts DHCP no cruzan routers. El relay (en el router/switch L3) reenvía el broadcast como unicast al servidor DHCP, incluyendo la subred del cliente. El servidor responde con el scope correcto para esa VLAN.

**¿Por qué hay que autorizar un servidor DHCP en AD?**
> Para prevenir "rogue DHCP servers". Si cualquier máquina pudiera actuar como DHCP, un atacante podría dar IPs/gateways/DNS falsos (ataque MITM). Solo los autorizados por un Domain Admin pueden operar.

**¿Qué opciones DHCP configuras en un scope corporativo?**
> Opción 003 (Router/Gateway), 006 (DNS Servers), 015 (DNS Domain Name). Para PXE/SCCM también: 066 (TFTP Server) y 067 (Bootfile).

---

## 🔌 Networking y OSI

→ Ver labs: [OSI y Diagnóstico](/redes/net-01-osi-diagnostico/) · [VLANs](/redes/net-02-vlans/) · [Wi-Fi/SSID](/redes/net-03-wifi-ssid/)

**Explica las 7 capas del modelo OSI.**
> 7-Aplicación (HTTP, DNS), 6-Presentación (TLS), 5-Sesión (SMB, RPC), 4-Transporte (TCP/UDP + puertos), 3-Red (IP, routing), 2-Enlace (Ethernet, MAC, VLANs), 1-Física (cables, señal).

**¿En qué capas operan switches y routers?**
> Switches: Capa 2 (MACs) y switches L3 también Capa 3. Routers: Capa 3. NGFW: hasta Capa 7.

**¿Qué diferencia hay entre TCP y UDP?**
> TCP: orientado a conexión (handshake 3-way), garantiza entrega y orden. UDP: sin conexión, más rápido, sin garantía de entrega. TCP para HTTP/S, SMTP. UDP para DNS, VoIP, video.

**Un usuario dice "no tengo internet". ¿Tu proceso de diagnóstico?**
> `ipconfig /all` → ¿tiene IP? → `ping 127.0.0.1` → `ping gateway` → `ping 8.8.8.8` (si funciona pero `ping google.com` falla → problema DNS) → `nslookup google.com`.

**¿Qué es una VLAN y para qué sirve?**
> Segmenta una red física en múltiples redes lógicas aisladas. Beneficios: seguridad (Finanzas no ve IT), reducción de dominios de broadcast, políticas diferenciadas por segmento.

**¿Qué es el estándar 802.1Q?**
> Estándar IEEE para VLAN tagging. Añade 4 bytes a la trama Ethernet con el VLAN ID (1–4094). Permite que un trunk transporte múltiples VLANs en el mismo cable.

**¿Cómo implementarías una red Wi-Fi de visitantes aislada?**
> VLAN 60 dedicada + scope DHCP separado + SSID "GUESTS" en VLAN 60 + en el firewall VLAN 60 solo accede a internet (sin acceso a VLANs corporativas) + WPA2-Personal o portal cautivo.

---

## 🔥 Firewalls

→ Ver lab: [Firewalls](/redes/net-04-firewalls/)

**¿Diferencia entre firewall stateful y stateless?**
> Stateless: examina cada paquete independientemente. Stateful: rastrea el estado de las conexiones TCP y permite automáticamente el tráfico de retorno. Los firewalls modernos son stateful.

**¿Cómo configurarías el acceso inicial a un Cisco ASA?**
> Cable de consola (serial), baudios 9600, configurar interfaz con IP estática, habilitar SSH (`crypto key generate rsa`, `ssh <red> <máscara> <interfaz>`, usuario local).

**¿Qué es NAT y para qué se usa?**
> Network Address Translation: traduce IPs privadas a públicas. PAT/Overload: múltiples IPs privadas salen con una IP pública diferenciadas por puerto. Static NAT: mapea IP pública a IP privada fija (para servidores accesibles desde internet).

**¿Qué es una DMZ?**
> Zona semi-confiable entre internet y la red interna. Aloja servidores accesibles desde internet (web, email, DNS público). Si un servidor DMZ es comprometido, el atacante no llega directamente a la LAN interna.

---

## 🔄 Dominio Híbrido y Azure/Cloud

→ Ver labs: [Dominio Híbrido](/hibrido/hibrido-entra/) · [AWS](/cloud/cloud-aws/) · [Azure](/cloud/cloud-azure/)

**¿Qué es Microsoft Entra ID y en qué se diferencia de AD on-prem?**
> Entra ID es el servicio de identidad cloud de Microsoft. AD on-prem usa LDAP/Kerberos, tiene DCs físicos y GPOs. Entra ID es PaaS: usa OAuth2/OIDC/SAML, sin DCs que administrar, se gestiona con Intune en lugar de GPOs.

**¿Qué hace Azure AD Connect / Entra Connect?**
> Sincroniza objetos de AD on-prem (usuarios, grupos) hacia Entra ID, permitiendo SSO para Microsoft 365, Teams y demás apps integradas. Soporta Password Hash Sync, Pass-through Auth, o ADFS.

**¿Qué es BitLocker y cómo gestionas las claves en empresa?**
> BitLocker cifra el disco completo (AES-256). Las claves se almacenan en AD on-prem (objeto en ADUC) o en Entra ID (portal Azure). GPO crítica: "Store BitLocker recovery in AD before enabling".

**¿Qué es una VPC y cuál es la diferencia entre subred pública y privada en AWS?**
> VPC: red privada virtual en AWS. Subred pública: tiene ruta al Internet Gateway (acceso desde internet). Subred privada: sin ruta directa a internet (para bases de datos, app servers).

**¿Diferencia entre Security Group y NACL en AWS?**
> Security Group: nivel de instancia, stateful, solo allow. NACL: nivel de subred, stateless, allow y deny con prioridades numéricas.

---

## 🖥️ SCCM / MECM

→ Ver labs: [Lab 05](/labs/lab-05-sccm-instalacion/) · [Lab 06](/labs/lab-06-sccm-software/) · [Lab 07](/labs/lab-07-sccm-patches/) · [Lab 08](/labs/lab-08-sccm-osd/)

**¿Qué es SCCM/MECM y qué problemas resuelve?**
> Centraliza despliegue de software y OS, gestión de parches, inventario de hardware/software y configuración de compliance en toda la flota Windows. Elimina la necesidad de ir equipo por equipo.

**¿Diferencia entre SCCM y Intune?**
> SCCM: on-premise, ideal para equipos en la red corporativa. Intune: cloud (Azure), ideal para equipos remotos/BYOD. En co-management se usan ambos simultáneamente.

**¿Qué es un Detection Method en SCCM?**
> Le indica a SCCM cómo verificar si una aplicación ya está instalada (clave de registro, archivo, versión MSI). Sin él, SCCM no puede saber si debe reinstalar o no.

**¿Qué es PXE Boot?**
> Pre-eXecution Environment: permite arrancar un equipo sin SO desde la red. Requiere que DHCP tenga opciones 66 (TFTP Server) y 67 (Bootfile). El equipo descarga WinPE via TFTP y ejecuta la Task Sequence.

---

## ⌨️ PowerShell y Bash

→ Ver labs: [PowerShell](/scripting/ps-powershell/) · [Bash](/scripting/bash-scripting/)

**Herramienta de recolección de logs que redujo 30 → 5 minutos. ¿Cómo funciona?**
> En PowerShell: `Get-WinEvent` con `FilterHashtable` consulta Event Viewer en múltiples servidores remotos en bucle, filtrando por nivel de error y rango de tiempo. Los resultados se consolidan en un reporte HTML/CSV automáticamente. En Bash: `ssh` no interactivo + `journalctl` en múltiples servidores, con loop y generación de reporte.

**¿Cómo crearías 100 usuarios en AD desde un CSV?**
> `Import-Csv usuarios.csv | ForEach-Object { New-ADUser -Name ... -SamAccountName $_.Sam ... }`. Siempre validar duplicados con `Get-ADUser` antes de crear.

**¿Qué es el pipeline en PowerShell?**
> Pasa objetos (no texto) entre cmdlets. Es poderoso porque trabaja con objetos reales, no strings — no necesitas parsear texto. `Get-ADUser -Filter * | Where-Object {!$_.Enabled} | Remove-ADUser`.

**¿Cómo buscar los 10 IPs con más intentos SSH fallidos?**
> `grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -10`

---

## 🛡️ Monitoreo y Operaciones

→ Ver labs: [Monitoreo](/ops/ops-monitoreo/) · [Backups](/ops/ops-backups/) · [ITIL](/ops/ops-itil/)

**¿Qué es DataDog?**
> Plataforma de observabilidad cloud que consolida métricas de infraestructura, logs, APM y alertas en un solo lugar. El agente se instala en cada servidor y envía datos a la plataforma.

**¿Qué es SentinelOne y en qué se diferencia de un antivirus?**
> EDR/XDR que usa IA para detectar comportamientos maliciosos (no solo firmas). Puede hacer rollback de archivos cifrados por ransomware, aislar endpoints remotamente y proveer forensics del árbol de procesos del ataque.

**Regla 3-2-1 de backups.**
> 3 copias, en 2 medios diferentes, con 1 copia offsite. La variante 3-2-1-1-0 añade 1 copia inmutable y 0 errores en restauraciones probadas.

**¿Diferencia entre incidente y requerimiento en ITIL?**
> Incidente: servicio interrumpido, hay que restaurarlo (urgente). Requerimiento: solicitud de algo nuevo sin interrupción del servicio (planificado).

**¿Diferencia entre incidente y problema?**
> Incidente: el síntoma (el servidor cayó). Problema: la causa raíz (hay un memory leak que causa el fallo). Gestión de incidentes restaura el servicio; gestión de problemas elimina la causa raíz.

**¿Qué es la "capa 8" del OSI?**
> El factor humano. Representa que muchos problemas de TI tienen origen en personas: errores de usuario, misconfiguraciones de técnicos, decisiones gerenciales. ITIL ayuda a gestionar esta capa con procesos, comunicación y documentación.

---

## 🐧 Linux

→ Ver lab: [Administración Linux](/linux/linux-administracion/)

**¿Qué es systemd y cómo usas `systemctl`?**
> Sistema de init moderno que gestiona todos los servicios. `systemctl start/stop/restart/status <servicio>`, `enable/disable` para inicio automático, `journalctl -u <servicio>` para logs.

**Explica los permisos 755 y 644.**
> 755 = `rwxr-xr-x`: dueño puede leer/escribir/ejecutar, grupo y otros solo leer/ejecutar (scripts, directorios web). 644 = `rw-r--r--`: dueño lee/escribe, demás solo leen (archivos de config).

**Un servicio Linux no inicia. ¿Diagnóstico?**
> 1. `systemctl status <servicio>` → error inmediato. 2. `journalctl -u <servicio> -n 50` → logs detallados. 3. Verificar config con `-t` o `--test`. 4. `ss -tlnp | grep <puerto>` → verificar que el puerto no esté ocupado.

**¿Cómo das permisos sudo granulares a un usuario?**
> En `sudoers` (siempre editar con `visudo`): `usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl` — solo puede ejecutar esos comandos específicos como root.
