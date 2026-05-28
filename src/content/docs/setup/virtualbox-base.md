---
title: VirtualBox — Configuración Base
description: Instalación de VirtualBox, Extension Pack y arquitectura de red para el laboratorio corp.local.
sidebar:
  label: 'VirtualBox: Configuración Base'
  order: 1
---

Esta guía cubre todo lo que debes configurar en VirtualBox **antes** de crear cualquier VM. Si saltas estos pasos, tendrás problemas de red o de portapapeles que son difíciles de diagnosticar después.

---

## 1. Instalar VirtualBox y Extension Pack

### 1.1 VirtualBox

Descarga la última versión estable desde la página oficial e instálala con las opciones predeterminadas.

:::caution[Versión mínima requerida]
Usa **VirtualBox 7.0 o superior**. Las versiones anteriores no soportan TPM 2.0 nativo, que Windows 11 necesita.
:::

### 1.2 Extension Pack

El Extension Pack agrega soporte para USB 2.0/3.0, cifrado de disco y, lo más importante para el lab, **acceso a portapapeles bidireccional y arrastrar-soltar**. Sin él, el portapapeles compartido no funciona aunque lo actives en la VM.

Pasos:
1. Descarga el Extension Pack desde la misma página de VirtualBox (mismo número de versión exacto que tu instalación).
2. Abre VirtualBox → **Archivo → Herramientas → Gestor de extensiones**.
3. Haz clic en **Instalar** y selecciona el archivo `.vbox-extpack` descargado.
4. Acepta la licencia cuando se solicite.

:::tip[Verificar instalación]
En el Gestor de extensiones debe aparecer **Oracle VM VirtualBox Extension Pack** con estado activo y la versión correcta.
:::

---

## 2. Arquitectura de Red del Laboratorio

Cada VM lleva **dos adaptadores de red**. Esto es fundamental y no es opcional:

| Adaptador | Modo         | Propósito                                              |
|-----------|--------------|--------------------------------------------------------|
| Adaptador 1 | NAT        | Salida a internet (descargas, actualizaciones, licencias) |
| Adaptador 2 | Red interna | Comunicación entre VMs (dominio, SCCM, replicación AD) |

### ¿Por qué dos adaptadores?

- Con **solo NAT**: todas las VMs comparten la misma IP hacia el exterior pero **no se ven entre sí**. No puedes montar un dominio.
- Con **solo Red interna**: las VMs se comunican pero **sin acceso a internet**. No puedes descargar prerrequisitos, actualizaciones ni activar roles.
- Con **ambos**: lo mejor de los dos mundos. La red interna forma la LAN del laboratorio; NAT es la puerta de salida.

### 2.1 Nombre de la red interna

El nombre de la red interna debe ser **idéntico en todas las VMs**. Si en el DC escribes `LabNet` y en el cliente escribes `labnet`, las VMs no se verán.

Nombre recomendado para este laboratorio: **`LabNet`**

---

## 3. Configuración Global de VirtualBox

Antes de crear VMs, revisa estos ajustes en **Archivo → Preferencias**:

| Sección      | Ajuste                          | Valor recomendado                        |
|--------------|---------------------------------|------------------------------------------|
| General      | Carpeta predeterminada de VMs   | Disco con suficiente espacio (no sistema) |
| Extensiones  | Extension Pack                  | Debe aparecer instalado                  |
| Red          | Redes NAT (opcional)            | Puedes dejar la red NAT predeterminada   |

---

## 4. Guest Additions (instalar en cada VM tras el SO)

Las **Guest Additions** son los drivers de VirtualBox que se instalan dentro de cada sistema operativo. Son **imprescindibles** para:

- Portapapeles bidireccional (copiar/pegar entre host y VM)
- Arrastrar y soltar archivos
- Resolución de pantalla adaptativa
- Integración del ratón sin necesidad de capturarlo

**No instales las Guest Additions desde el repositorio del SO**. Usa siempre las que vienen con tu versión de VirtualBox:

Con la VM encendida y el SO instalado:
1. Menú de VirtualBox → **Dispositivos → Insertar imagen de CD de las Guest Additions**.
2. Dentro de la VM, abre el CD que aparece en el explorador de archivos.
3. Ejecuta `VBoxWindowsAdditions.exe` (en Windows) como administrador.
4. Acepta todas las opciones predeterminadas y reinicia.

### Activar portapapeles bidireccional

Después de instalar las Guest Additions:
1. Con la VM seleccionada (puede estar apagada), ve a **Configuración → General → Avanzado**.
2. **Portapapeles compartido**: Bidireccional
3. **Arrastrar y soltar**: Bidireccional
4. Guarda y enciende la VM. El portapapeles ya funciona.

:::danger[Error frecuente]
Si el portapapeles no funciona después de hacer todo esto, la causa más común es que el Extension Pack **no está instalado** o que hay un desfase de versión entre VirtualBox y el Extension Pack. Verifica que ambos tengan exactamente el mismo número de versión.
:::
