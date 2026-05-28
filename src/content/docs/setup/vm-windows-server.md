---
title: VM — Windows Server 2022
description: Creación e instalación manual de la VM del Controlador de Dominio con Windows Server 2022 Desktop Experience en VirtualBox.
sidebar:
  label: 'VM: Windows Server 2022'
  order: 2
---

Esta guía cubre la creación y configuración de la VM que actuará como **Controlador de Dominio (DC)**. Es la VM más crítica del laboratorio: Active Directory, DNS y las GPOs viven aquí.

---

## 1. Obtener el ISO

Descarga **Windows Server 2022 Evaluation** (180 días, gratuito) desde el sitio de Microsoft Evaluation Center. No necesitas licencia para el laboratorio.

:::tip[Edición a descargar]
Descarga la versión **ISO** y no la versión VHD preconfigurada. El VHD viene con instalación desatendida y no te da control sobre la edición ni la configuración inicial.
:::

---

## 2. Crear la VM

En VirtualBox, haz clic en **Nueva** y completa los campos:

| Campo                | Valor                              |
|----------------------|------------------------------------|
| Nombre               | `DC01`                             |
| Carpeta              | Tu ruta de VMs                     |
| Tipo                 | Microsoft Windows                  |
| Versión              | Windows 2022 (64-bit)              |
| ISO de instalación   | Selecciona el ISO descargado       |
| **Instalación desatendida** | **Desmarca esta opción**  |

:::danger[No uses instalación desatendida]
La instalación desatendida de VirtualBox genera una cuenta de administrador con configuración automática, omite la selección de edición y puede instalar una versión **Core** (sin escritorio) sin avisarte. Siempre desmarca esa opción y completa la instalación manualmente.
:::

### Hardware de la VM

| Recurso       | Valor mínimo | Recomendado |
|---------------|-------------|-------------|
| RAM           | 2 GB        | 4 GB        |
| vCPU          | 2           | 2–4         |
| Disco         | 50 GB dinámico | 60 GB dinámico |
| Tipo de disco | VDI (VirtualBox Disk Image) | VDI |

El disco **dinámico** solo ocupa en el host el espacio que realmente usa la VM, no los 60 GB completos desde el inicio.

---

## 3. Configurar los Adaptadores de Red

Con la VM creada (todavía apagada), ve a **Configuración → Red**:

**Adaptador 1:**
- Habilitado: ✓
- Conectado a: **NAT**
- Tipo: PCnet-FAST III o virtio-net (cualquiera funciona)

**Adaptador 2:**
- Habilitado: ✓
- Conectado a: **Red interna**
- Nombre: `LabNet` (exactamente igual en todas las VMs)
- Tipo: PCnet-FAST III o virtio-net

---

## 4. Instalar Windows Server 2022

Arranca la VM. El proceso de instalación es completamente manual.

### 4.1 Pantallas iniciales

1. Selecciona idioma, formato de hora y teclado → **Siguiente**.
2. Haz clic en **Instalar ahora**.
3. Introduce la clave de producto → si usas la versión Evaluation, haz clic en **No tengo clave de producto**.

### 4.2 Selección de edición — paso crítico

Aparecerá una lista con cuatro opciones:

```
Windows Server 2022 Standard Evaluation
Windows Server 2022 Standard Evaluation (Desktop Experience)
Windows Server 2022 Datacenter Evaluation
Windows Server 2022 Datacenter Evaluation (Desktop Experience)
```

:::danger[Selecciona Desktop Experience]
Si eliges la opción **sin** "Desktop Experience", obtendrás una instalación **Server Core**: solo línea de comandos, sin escritorio gráfico, sin Server Manager visual. Para este laboratorio necesitas la versión con escritorio.

Selecciona: **Windows Server 2022 Standard Evaluation (Desktop Experience)**
:::

### 4.3 Tipo de instalación

Selecciona **Personalizada: instalar solo Windows (avanzado)**.

No uses "Actualizar": estás haciendo una instalación limpia.

### 4.4 Partición de disco

- Selecciona el disco sin asignar y haz clic en **Siguiente**.
- Deja que Windows cree las particiones automáticamente (EFI + sistema + datos).
- No necesitas particionar manualmente para el laboratorio.

### 4.5 Contraseña del Administrador

Al finalizar la instalación te pedirá una contraseña para la cuenta `Administrator`.

:::caution[Requisitos de contraseña]
Windows Server aplica complejidad por defecto: mínimo 8 caracteres, mayúsculas, minúsculas y números o símbolos. Usa algo que recuerdes durante todo el laboratorio, como `Admin@Lab2024`.
:::

---

## 5. Configuración Post-Instalación

Una vez en el escritorio, completa estos pasos **antes** de instalar cualquier rol.

### 5.1 Instalar Guest Additions

Sigue los pasos de la guía [VirtualBox: Configuración Base](/setup/virtualbox-base/#4-guest-additions-instalar-en-cada-vm-tras-el-so).

Reinicia después de la instalación. Activa el portapapeles bidireccional en la configuración de la VM.

### 5.2 Renombrar el equipo

El nombre del equipo es permanente una vez que el DC esté promovido. Cámbialo ahora:

```powershell
Rename-Computer -NewName "DC01" -Restart
```

O desde **Server Manager → Local Server → Computer name**.

:::caution[Renombrar antes de promover a DC]
Cambiar el nombre del servidor después de promoverlo como Controlador de Dominio es un proceso complejo y propenso a errores. Hazlo siempre antes.
:::

### 5.3 Configurar IP estática en el Adaptador 2 (Red interna)

El adaptador NAT (Adaptador 1) se configura solo por DHCP. El adaptador de red interna necesita IP estática porque los clientes del dominio lo usarán como servidor DNS.

Abre PowerShell como administrador e identifica los adaptadores:

```powershell
Get-NetAdapter | Select-Object Name, InterfaceDescription, Status
```

El adaptador de red interna no tendrá puerta de enlace. Asígnale IP estática:

```powershell
# Reemplaza "Ethernet 2" con el nombre real del adaptador interno
$iface = "Ethernet 2"
New-NetIPAddress -InterfaceAlias $iface -IPAddress 192.168.100.10 -PrefixLength 24
Set-DnsClientServerAddress -InterfaceAlias $iface -ServerAddresses 127.0.0.1
```

Valores utilizados en este laboratorio:

| Campo        | Valor             |
|--------------|-------------------|
| IP           | 192.168.100.10    |
| Máscara      | 255.255.255.0 /24 |
| Puerta enlace | (vacío — solo en adaptador NAT) |
| DNS primario | 127.0.0.1 (el DC se apuntará a sí mismo) |

### 5.4 Deshabilitar IE Enhanced Security Configuration

Server Manager → Local Server → **IE Enhanced Security Configuration → Off** (para Administrators y Users).

Esto permite usar el navegador para descargar software directamente desde el servidor sin bloqueos constantes.

### 5.5 Verificar conectividad

```powershell
# Internet (a través de NAT)
Test-NetConnection -ComputerName 8.8.8.8 -Port 53

# Red interna — desde un cliente, hacer ping a esta IP
# (verificar después de configurar las VMs cliente)
ipconfig /all
```

---

## Checklist antes de pasar al Lab 01

- [ ] Guest Additions instaladas y portapapeles bidireccional activo
- [ ] Equipo renombrado a `DC01`
- [ ] IP estática `192.168.100.10` asignada al adaptador de red interna
- [ ] DNS apuntando a `127.0.0.1`
- [ ] IE Enhanced Security Configuration desactivado
- [ ] Conectividad a internet verificada (ping a 8.8.8.8)
- [ ] Snapshot tomado antes de instalar roles (recomendado)
