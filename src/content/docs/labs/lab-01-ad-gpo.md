---
title: 'Lab 01 — Active Directory + GPO'
description: Monta un entorno AD DS con GPOs para instalar extensiones Chrome y configuración gestionada por Unidad Organizativa (OU).
sidebar:
  label: 'Lab 01: AD + GPO'
  badge:
    text: Básico
    variant: success
---

# Laboratorio: Active Directory + GPO para Chrome Tab Monitor

Guía para montar un entorno de pruebas con Active Directory Domain Services (AD DS) que permita experimentar con instalación forzada de extensiones Chrome y configuración gestionada (managed storage) por Unidad Organizativa (OU).

---

## 🏗️ Arquitectura del Laboratorio

```
Red interna: 192.168.100.0/24

┌─────────────────────────────┐
│  VM 1 — Controlador de      │
│  Dominio (DC)               │
│  Windows Server 2022        │
│  IP: 192.168.100.10         │
│  Rol: AD DS + DNS + GPMC    │
└────────────┬────────────────┘
             │ dominio: corp.local
     ┌───────┴────────┐
     │                │
┌────┴──────┐  ┌──────┴─────┐
│  VM 2     │  │  VM 3      │
│  Cliente  │  │  Cliente   │
│  Win 10   │  │  Win 10    │
│  OU:      │  │  OU:       │
│  Contab.  │  │  Desarrollo│
└───────────┘  └────────────┘
```

**Mínimo para el lab:** 1 DC + 1 cliente. Con 2 clientes en OUs distintas puedes probar que diferentes políticas se aplican a diferentes grupos.

---

## 💻 Requisitos de Hardware / Hipervisor

| VM         | SO                               | RAM  | Disco | vCPU |
| ---------- | -------------------------------- | ---- | ----- | ---- |
| DC         | Windows Server 2022 (Evaluation) | 2 GB | 40 GB | 2    |
| Cliente(s) | Windows 10/11                    | 2 GB | 40 GB | 2    |

**Hipervisor recomendado:** Hyper-V (incluido en Windows 10/11 Pro), VMware Workstation, o VirtualBox.

Todas las VMs deben estar en la misma red interna (NAT o red host-only). El DC debe tener IP estática.

---

## 🖥️ Parte 1: Configurar el Controlador de Dominio

### 1.1 Instalar Windows Server

Instala Windows Server 2022 Evaluation (gratuita por 180 días). Durante la instalación selecciona **Windows Server 2022 Standard (Desktop Experience)** para tener interfaz gráfica.

Asigna IP estática antes de instalar AD DS:

- IP: `192.168.100.10`
- Máscara: `255.255.255.0`
- Gateway: `192.168.100.1`
- DNS preferido: `127.0.0.1` (apuntará a sí mismo después de instalar DNS)

### 1.2 Instalar el rol AD DS

1. Abre **Server Manager** → **Add Roles and Features**
2. Selecciona **Active Directory Domain Services**
3. Acepta las características requeridas y completa el asistente
4. Al finalizar, en Server Manager aparecerá una alerta amarilla → clic en **Promote this server to a domain controller**

### 1.3 Crear el dominio

En el asistente de promoción:

- Selecciona **Add a new forest**
- Root domain name: `corp.local`
- Forest functional level: **Windows Server 2016** (compatible con todo)
- Establece una contraseña para el modo de restauración de directorio (DSRM)
- Completa el asistente → el servidor se reiniciará

Después del reinicio, inicia sesión como `CORP\Administrator`.

### 1.4 Crear las Unidades Organizativas (OUs)

Abre **Active Directory Users and Computers** (`dsa.msc`):

1. Clic derecho sobre `corp.local` → **New** → **Organizational Unit**
2. Crea las siguientes OUs:
   - `Contabilidad`
   - `Desarrollo`
   - `RRHH`

Dentro de cada OU crea también una sub-OU llamada `Computadoras` donde moverás los equipos del dominio.

---

## 💻 Parte 2: Unir Clientes al Dominio

En cada VM cliente (Windows 10/11):

### 2.1 Configurar DNS

El cliente debe resolver el dominio `corp.local`. En la configuración de red:

- DNS preferido: `192.168.100.10` (IP del DC)

### 2.2 Unirse al dominio

1. Clic derecho en **Este equipo** → **Propiedades** → **Cambiar configuración**
2. **Nombre de equipo/dominio** → **Cambiar**
3. Selecciona **Dominio** → escribe `corp.local`
4. Introduce credenciales de administrador del dominio: `Administrator` / tu contraseña
5. Reinicia el equipo

### 2.3 Mover el equipo a su OU

De vuelta en el DC, en **Active Directory Users and Computers**:

- El nuevo equipo aparece en `Computers` por defecto
- Arrástralo a `corp.local > Contabilidad > Computadoras`

Repite para cada cliente, asignando cada uno a su OU correspondiente.

---

## 📋 Parte 3: Instalar las Chrome ADMX Templates

Las Chrome ADMX templates son archivos que le enseñan al editor de GPO qué políticas de Chrome existen con nombres legibles. Sin ellas, tendrías que editar el registro a mano.

### 3.1 Descargar los templates

Descarga el paquete oficial de Google:

- Busca "Chrome Enterprise Bundle" en la página de descargas de Chrome Enterprise
- Extrae el ZIP — encontrarás una carpeta `Configuration > admx`

### 3.2 Copiar los archivos al almacén central

El almacén central del DC está en:

```
C:\Windows\SYSVOL\sysvol\oncorp.local\Policies\PolicyDefinitions\
```

Si la carpeta `PolicyDefinitions` no existe, créala.

Copia:

- Todos los archivos `.admx` → dentro de `PolicyDefinitions\`
- La carpeta `es-ES` (o `en-US`) con los archivos `.adml` → dentro de `PolicyDefinitions\es-ES\`

### 3.3 Verificar

Abre el **Group Policy Management Editor** en cualquier GPO y navega a:
`Computer Configuration > Administrative Templates > Google > Google Chrome`

Si ves las categorías de Chrome, los templates están instalados correctamente.

---

## 📦 Parte 4: GPO de Instalación Forzada

Este GPO instalará automáticamente la extensión en los navegadores de los equipos de la OU a la que se aplique.

### 4.1 Crear el GPO

En el DC, abre **Group Policy Management** (`gpmc.msc`):

1. Clic derecho sobre la OU `Contabilidad` → **Create a GPO in this domain, and Link it here**
2. Nombre: `Chrome - Instalar Tab Monitor`
3. Clic derecho sobre el GPO recién creado → **Edit**

### 4.2 Configurar la política

Dentro del editor, navega a:

```
Computer Configuration
  └── Administrative Templates
       └── Google
            └── Google Chrome
                 └── Extensions
```

Abre **Configure the list of force-installed apps and extensions**:

1. Selecciona **Enabled**
2. Clic en **Show...**
3. Agrega un valor con este formato:

   ```
   <extension-id>;https://clients2.google.com/service/update2/crx
   ```

   Reemplaza `<extension-id>` con el ID de tu extensión en Chrome Web Store.

   > **Si la extensión no está en CWS todavía:** ver sección "Extensión auto-hospedada" al final de este documento.

4. Acepta y cierra el editor.

### 4.3 Forzar actualización de políticas en el cliente

En el cliente unido al dominio, abre PowerShell como administrador:

```powershell
gpupdate /force
```

Reinicia Chrome. La extensión debería instalarse automáticamente. Verifica en `chrome://extensions/` — aparecerá con la etiqueta **"Instalada por el administrador de la empresa"** y sin botón de eliminar.

---

## ⚙️ Parte 5: GPO de Configuración Gestionada

Este GPO configura los límites de la extensión por OU. Puedes tener valores distintos para `Contabilidad` y `Desarrollo`.

### 5.1 Crear el GPO de configuración

En **Group Policy Management**:

1. Clic derecho sobre `Contabilidad` → **Create a GPO in this domain, and Link it here**
2. Nombre: `Chrome - Tab Monitor Config Contabilidad`
3. Edita el GPO

### 5.2 Configurar via templates (si el ADMX lo soporta)

Si los templates de Chrome incluyen soporte para políticas de terceros, navega a:

```
Computer Configuration > Administrative Templates > Google > Google Chrome > Extensions
```

Busca **Configure extension management settings**.

Si no están disponibles, configura el registro directamente:

### 5.3 Configurar via Registro (método universal)

En el editor del GPO, navega a:

```
Computer Configuration
  └── Preferences
       └── Windows Settings
            └── Registry
```

Clic derecho → **New** → **Registry Item**:

| Campo      | Valor                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Action     | Update                                                                      |
| Hive       | HKEY_LOCAL_MACHINE                                                          |
| Key Path   | `SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\<extension-id>\policy` |
| Value name | `tabLimit`                                                                  |
| Value type | REG_DWORD                                                                   |
| Value data | `3`                                                                         |

Repite para cada política que quieras imponer (`windowLimit`, `enabled`, etc.).

Para la OU `Desarrollo`, crea un GPO diferente con valores distintos (ej. `tabLimit = 10`).

### 5.4 Verificar en el cliente

En el cliente dentro de `Contabilidad`:

1. Ejecuta `gpupdate /force`
2. Abre Chrome → `chrome://policy`
3. En la sección de tu extensión debe aparecer `tabLimit: 3` con estado **OK**
4. Abre el popup de la extensión — el campo debe mostrar `3` y estar bloqueado con indicador GPO

---

## 🔬 Parte 6: Probar Diferentes Configuraciones por OU

Con los dos clientes en OUs distintas puedes verificar el comportamiento diferenciado:

1. En el cliente de `Contabilidad`: `chrome://policy` → `tabLimit: 3`
2. En el cliente de `Desarrollo`: `chrome://policy` → `tabLimit: 10`
3. Ambos tienen la extensión instalada (por el GPO de `ExtensionInstallForcelist` aplicado a nivel del dominio o de cada OU)

Si quieres que solo `Contabilidad` tenga la extensión instalada y `Desarrollo` no, enlaza el GPO de instalación forzada únicamente a la OU `Contabilidad`.

---

## 📎 Apéndice: Extensión Auto-Hospedada (sin Chrome Web Store)

Si la extensión no está publicada en CWS, necesitas:

### A. Empaquetar la extensión como .crx

En Chrome: `chrome://extensions/` → activa Modo Desarrollador → **Pack Extension** → selecciona la carpeta del proyecto → genera `extension.crx` y `extension.pem`.

### B. Crear el XML de actualización

Crea `update.xml` en un servidor web accesible desde los clientes (puede ser IIS en el propio DC):

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='<extension-id>'>
    <updatecheck
      codebase='http://192.168.100.10/extensions/tab-monitor.crx'
      version='1.1.0' />
  </app>
</gupdate>
```

### C. Configurar el GPO con la URL interna

En `ExtensionInstallForcelist`, el valor será:

```
<extension-id>;http://192.168.100.10/extensions/update.xml
```

### D. Permitir extensiones de fuentes externas

Agrega también la política **ExtensionInstallSources** con el valor:

```
http://192.168.100.10/*
```

Esto autoriza a Chrome a instalar .crx desde ese servidor interno.

---

## 🔁 Comandos Útiles de Referencia

```powershell
# Forzar aplicación de políticas en el cliente
gpupdate /force

# Ver políticas aplicadas en el cliente
gpresult /r

# Ver políticas solo de equipo con detalle
gpresult /scope computer /v

# En el DC: ver todos los GPOs vinculados a una OU
Get-GPInheritance -Target "OU=Contabilidad,DC=corp,DC=local"

# Diagnóstico de políticas de Chrome
# (ejecutar en el cliente, luego revisar chrome://policy)
```
