---
title: VM — Windows 11 (Clientes)
description: Creación e instalación de las VMs cliente con Windows 11 en VirtualBox, incluyendo bypass de requisitos TPM y cuenta local sin Microsoft Account.
sidebar:
  label: 'VM: Windows 11 (Clientes)'
  order: 3
---

El laboratorio usa dos VMs cliente: `WKSTN-01` y `WKSTN-02`. Ambas tienen la misma configuración base; solo cambia el nombre y la IP. Esta guía cubre la instalación completa de las dos.

---

## 1. Obtener el ISO

Descarga **Windows 11** desde la página oficial de Microsoft (opción "Download Windows 11 Disk Image (ISO)"). Selecciona la arquitectura x64 y el idioma de tu preferencia.

:::tip[Misma ISO para ambas VMs]
No necesitas descargar el ISO dos veces. Una vez creada y configurada la primera VM, puedes clonarla o repetir el proceso con el mismo archivo.
:::

---

## 2. Crear la VM

En VirtualBox, haz clic en **Nueva**:

| Campo                | Valor                              |
|----------------------|------------------------------------|
| Nombre               | `WKSTN-01`                         |
| Tipo                 | Microsoft Windows                  |
| Versión              | Windows 11 (64-bit)                |
| ISO de instalación   | Selecciona el ISO de Windows 11    |
| **Instalación desatendida** | **Desmarca esta opción**  |

:::danger[Sin instalación desatendida]
Igual que con Windows Server, desactiva la instalación desatendida. Windows 11 con instalación desatendida de VirtualBox puede crear un usuario con nombre incorrecto, unirse a redes no deseadas o saltarse pasos donde necesitas tomar decisiones.
:::

### Hardware de la VM

| Recurso       | Mínimo requerido por Windows 11 | Recomendado para el lab |
|---------------|----------------------------------|--------------------------|
| RAM           | 4 GB                             | 4 GB                     |
| vCPU          | 2                                | 2                        |
| Disco         | 64 GB                            | 60 GB dinámico           |
| Secure Boot   | Habilitado                       | Habilitado               |
| TPM           | 2.0                              | 2.0                      |

### Habilitar TPM 2.0 en VirtualBox

Windows 11 requiere TPM 2.0. VirtualBox 7.0+ lo soporta de forma nativa:

1. Con la VM seleccionada (apagada), ve a **Configuración → Sistema → Placa base**.
2. En **Chip de seguridad**: selecciona **TPMv2**.
3. En la misma pantalla, verifica que **EFI** esté habilitado.
4. En **Configuración → Sistema → Procesador**, marca **Habilitar PAE/NX**.

:::caution[VirtualBox 6.x]
Si usas VirtualBox 6.x, no hay soporte nativo para TPM. La solución más simple es actualizar a VirtualBox 7.x. Si no puedes actualizar, puedes hacer un bypass por registro durante la instalación (ver sección 4.1).
:::

---

## 3. Configurar los Adaptadores de Red

Mismo esquema que la VM del servidor:

**Adaptador 1:**
- Conectado a: **NAT**

**Adaptador 2:**
- Conectado a: **Red interna**
- Nombre: `LabNet` (exactamente igual que en el DC)

---

## 4. Instalar Windows 11

Arranca la VM. La instalación es completamente manual.

### 4.1 Bypass de TPM (solo si usas VirtualBox 6.x)

Si la instalación muestra el error *"This PC doesn't meet the minimum system requirements"*:

1. Presiona **Shift + F10** para abrir una ventana de comando.
2. Ejecuta:

```cmd
regedit
```

3. Navega a `HKEY_LOCAL_MACHINE\SYSTEM\Setup`.
4. Crea una clave llamada `LabConfig`.
5. Dentro de `LabConfig`, crea los siguientes valores DWORD (32-bit) con valor `1`:

```
BypassTPMCheck
BypassSecureBootCheck
BypassRAMCheck
```

6. Cierra regedit y continúa la instalación.

### 4.2 Selección de edición

Selecciona **Windows 11 Pro**. La edición Home no permite unirse a dominios de Active Directory.

:::danger[No instales Home]
Windows 11 Home no puede unirse a un dominio de Active Directory. Si lo instalas por error, tendrás que reinstalar. Selecciona siempre **Pro**.
:::

### 4.3 Tipo de instalación

Selecciona **Personalizada: instalar solo Windows**.

### 4.4 Partición

Selecciona el espacio sin asignar → **Siguiente**. Windows crea las particiones automáticamente.

### 4.5 Configuración OOBE — Cuenta local sin Microsoft Account

Windows 11 intenta forzar el uso de una cuenta Microsoft durante la configuración inicial. Para crear una cuenta **local** (necesaria antes de unirse al dominio):

1. Cuando llegues a la pantalla de conexión de red, haz clic en el botón **No tengo internet** (si aparece) y luego en **Continuar con configuración limitada**.
2. Si no aparece esa opción, con la pantalla de red activa presiona **Shift + F10** y ejecuta:

```cmd
OOBE\BYPASSNRO
```

La VM se reiniciará y volverá al inicio del OOBE con la opción de configuración sin internet disponible.

3. Ingresa un nombre de usuario local (por ejemplo `admin`) y una contraseña.

:::tip[Nombre de usuario local]
Usa un nombre genérico como `admin` o `user01`. Este usuario será reemplazado por cuentas del dominio una vez que la VM se una a `corp.local`.
:::

4. En las pantallas de privacidad, desactiva todas las opciones (diagnósticos, localización, etc.). No son necesarias para el laboratorio.

---

## 5. Configuración Post-Instalación

### 5.1 Instalar Guest Additions

Sigue los pasos de la guía [VirtualBox: Configuración Base](/setup/virtualbox-base/#4-guest-additions-instalar-en-cada-vm-tras-el-so).

Reinicia y activa el portapapeles bidireccional en la configuración de la VM.

### 5.2 Renombrar el equipo

```powershell
Rename-Computer -NewName "WKSTN-01" -Restart
```

La segunda VM usará `WKSTN-02`.

:::caution[Renombrar antes de unirse al dominio]
Cambia el nombre del equipo antes de unirlo al dominio. Renombrar un equipo ya unido al dominio requiere pasos adicionales y puede causar problemas con los objetos de computadora en AD.
:::

### 5.3 Verificar conectividad

```powershell
# Internet
Test-NetConnection -ComputerName 8.8.8.8 -Port 80

# Ping al DC (adaptador de red interna debe estar activo)
ping 192.168.100.10
```

Si el ping al DC falla, verifica que el Adaptador 2 en la VM esté configurado como **Red interna → LabNet** y que el DC esté encendido.

### 5.4 Dejar en WORKGROUP por ahora

No configures IP estática ni unas la VM al dominio todavía. La unión al dominio `corp.local` es el objetivo del **Lab 01**. La VM puede obtener IP por DHCP del NAT para tener internet, y el adaptador de red interna quedará sin IP hasta que el DC esté configurado como servidor DHCP (o hasta asignar IP estática manualmente en el lab).

---

## 6. Crear WKSTN-02

Repite exactamente los mismos pasos para la segunda VM cliente:

- Nombre de VM: `WKSTN-02`
- Mismo hardware y adaptadores de red
- Nombre de equipo Windows: `WKSTN-02`
- IP del adaptador interno: se asignará en el Lab 01

:::tip[Clonar en lugar de reinstalar]
Una vez que `WKSTN-01` esté completamente configurada con Guest Additions y sin unirse al dominio aún, puedes **clonar** la VM en VirtualBox (**clic derecho → Clonar → Clonación completa**) en lugar de repetir todo el proceso. Después del clon, solo necesitas cambiar el nombre del equipo a `WKSTN-02`.
:::

---

## Checklist antes de pasar al Lab 01

Para cada cliente (`WKSTN-01` y `WKSTN-02`):

- [ ] Windows 11 **Pro** instalado (no Home)
- [ ] Guest Additions instaladas y portapapeles bidireccional activo
- [ ] Equipo renombrado (`WKSTN-01` / `WKSTN-02`)
- [ ] Cuenta local creada (sin Microsoft Account)
- [ ] Dos adaptadores de red configurados (NAT + Red interna `LabNet`)
- [ ] Ping a internet funciona (a través de NAT)
- [ ] VM **no unida** al dominio todavía
- [ ] Snapshot tomado (recomendado)
