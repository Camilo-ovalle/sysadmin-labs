---
title: 'Cloud Azure — Fundamentos para SysAdmin'
description: Conceptos esenciales de Microsoft Azure para SysAdmins. VNet, VM, Entra ID, Storage, comparación AWS↔Azure, y recursos relevantes para entornos híbridos con AD on-prem.
sidebar:
  label: 'Cloud: Azure Fundamentos'
  badge:
    text: Intermedio
    variant: caution
---

# Cloud Azure — Fundamentos para SysAdmin

**Duración estimada:** 1–2 horas de estudio  
**Dificultad:** Intermedio  
**Nota:** Cuenta Azure gratuita en `azure.microsoft.com/free` (200 USD de crédito por 30 días)

---

## 🗺️ Mapeo: AWS vs Azure vs On-Prem

| Concepto | On-Premise | AWS | Azure |
|---|---|---|---|
| Virtual Machine | VM (VMware/Hyper-V) | EC2 | **Azure VM** |
| Red privada | LAN / VLAN | VPC | **VNet (Virtual Network)** |
| Subred | Subnet | Subnet | **Subnet** |
| Firewall de red | Firewall físico | Security Group + NACL | **NSG (Network Security Group)** |
| Almacenamiento objetos | NAS / Share | S3 | **Azure Blob Storage** |
| DNS | DNS Server on-prem | Route 53 | **Azure DNS** |
| Active Directory | AD DS on-prem | AWS Directory Service | **Microsoft Entra ID** |
| Gestión de identidades | AD on-prem | IAM | **Entra ID (Azure AD)** |
| MDM / Endpoint Mgmt | SCCM / Intune | — | **Microsoft Intune** |
| Monitoreo | SCOM / DataDog | CloudWatch | **Azure Monitor** |
| Gestión de cambios/ITSM | — | — | **Azure DevOps / ServiceNow** |

---

## 🔵 Entra ID (Azure AD) en Contexto Azure

Ya cubierto en profundidad en el lab [Dominio Híbrido con Entra ID](/hibrido/hibrido-entra/), aquí el resumen contextualizado en Azure:

- Cada tenant de Azure tiene automáticamente un directorio Entra ID
- Los usuarios de Entra ID pueden acceder a todos los servicios de Microsoft 365 y Azure
- Para entornos híbridos: sincronizar con AD on-prem usando **Entra Connect**
- Gestión de dispositivos: con **Intune** (MDM) como reemplazo/complemento de GPOs

---

## 🌐 VNet — Virtual Network

Una VNet es la red privada de Azure, equivalente a la VPC de AWS.

### Componentes de una VNet

```
VNet: 10.1.0.0/16 (East US)
├── Subnet frontend: 10.1.1.0/24
│   ├── VM web server (IP privada: 10.1.1.10)
│   └── NSG: permite 80, 443 desde internet
├── Subnet backend:  10.1.2.0/24
│   ├── VM app server
│   └── NSG: permite 8080 solo desde frontend subnet
└── Subnet database: 10.1.3.0/24
    ├── Azure SQL / VM SQL Server
    └── NSG: permite 1433 solo desde backend subnet
```

### Crear una VNet con Azure CLI

```bash
# Crear resource group (contenedor lógico de recursos)
az group create --name rg-lab-sysadmin --location eastus

# Crear VNet con subred
az network vnet create \
    --resource-group rg-lab-sysadmin \
    --name vnet-corp \
    --address-prefix 10.1.0.0/16 \
    --subnet-name subnet-frontend \
    --subnet-prefix 10.1.1.0/24

# Agregar subred adicional
az network vnet subnet create \
    --resource-group rg-lab-sysadmin \
    --vnet-name vnet-corp \
    --name subnet-backend \
    --address-prefix 10.1.2.0/24
```

---

## 🛡️ NSG — Network Security Group

El NSG es el firewall de Azure, similar a los Security Groups de AWS pero con diferencias.

### Diferencias vs AWS Security Groups

| | AWS Security Group | Azure NSG |
|---|---|---|
| **Estado** | Stateful | Stateful |
| **Reglas** | Solo Allow | Allow + Deny |
| **Prioridad** | Sin prioridad (todas evaluadas) | Número de prioridad (100–4096, menor = mayor prioridad) |
| **Aplicación** | Interfaz de red / instancia | Subred o interfaz de red |

### Crear NSG con reglas

```bash
# Crear NSG
az network nsg create \
    --resource-group rg-lab-sysadmin \
    --name nsg-frontend

# Regla: permitir HTTP desde internet
az network nsg rule create \
    --resource-group rg-lab-sysadmin \
    --nsg-name nsg-frontend \
    --name Allow-HTTP \
    --priority 100 \
    --direction Inbound \
    --access Allow \
    --protocol Tcp \
    --source-address-prefix "*" \
    --source-port-range "*" \
    --destination-address-prefix "*" \
    --destination-port-range 80

# Regla: denegar todo lo demás
az network nsg rule create \
    --resource-group rg-lab-sysadmin \
    --nsg-name nsg-frontend \
    --name Deny-All \
    --priority 4096 \
    --direction Inbound \
    --access Deny \
    --protocol "*"

# Asociar NSG a la subred
az network vnet subnet update \
    --resource-group rg-lab-sysadmin \
    --vnet-name vnet-corp \
    --name subnet-frontend \
    --network-security-group nsg-frontend
```

---

## 💻 Azure Virtual Machines

### Crear una VM con Azure CLI

```bash
# Crear VM Windows Server 2022
az vm create \
    --resource-group rg-lab-sysadmin \
    --name VM-WinServer01 \
    --image Win2022Datacenter \
    --size Standard_B2s \
    --admin-username azureadmin \
    --admin-password "MiContraseñaSegura123!" \
    --vnet-name vnet-corp \
    --subnet subnet-backend \
    --public-ip-address ""   # Sin IP pública (subred backend)

# Crear VM Ubuntu Server
az vm create \
    --resource-group rg-lab-sysadmin \
    --name VM-Ubuntu01 \
    --image Ubuntu2204 \
    --size Standard_B1s \
    --admin-username azureuser \
    --generate-ssh-keys \
    --vnet-name vnet-corp \
    --subnet subnet-frontend
```

### Tamaños de VM más comunes

| Tamaño | vCPU | RAM | Uso |
|---|---|---|---|
| Standard_B1s | 1 | 1 GB | Labs, pruebas (Free Tier) |
| Standard_B2s | 2 | 4 GB | DC, servidores pequeños |
| Standard_D2s_v3 | 2 | 8 GB | Workloads generales |
| Standard_E4s_v3 | 4 | 32 GB | SQL Server, memoria intensiva |

---

## 💾 Azure Blob Storage

Equivalente a S3 de AWS.

```bash
# Crear Storage Account
az storage account create \
    --name storagelab2024 \
    --resource-group rg-lab-sysadmin \
    --location eastus \
    --sku Standard_LRS

# Crear contenedor (equivalente a bucket S3)
az storage container create \
    --account-name storagelab2024 \
    --name backups

# Subir archivo
az storage blob upload \
    --account-name storagelab2024 \
    --container-name backups \
    --name backup-2024.zip \
    --file ./backup-2024.zip

# Listar blobs
az storage blob list \
    --account-name storagelab2024 \
    --container-name backups \
    --output table
```

---

## 🔗 Conectividad Híbrida: On-Prem ↔ Azure

### VPN Gateway (Site-to-Site)

Conecta tu red on-prem con la VNet de Azure a través de una VPN IPsec/IKE.

```
Red corp on-prem         Azure VNet
192.168.100.0/24 ◀─ VPN IPsec ─▶ 10.1.0.0/16
```

Componentes en Azure:
1. **VPN Gateway**: en una subred dedicada (GatewaySubnet)
2. **Local Network Gateway**: define las IPs y subredes de tu red on-prem
3. **Connection**: enlaza el VPN Gateway con el Local Network Gateway

### Azure ExpressRoute

Para alta velocidad y baja latencia: conexión privada dedicada (no por internet) entre on-prem y Azure vía proveedor de telecomunicaciones. Usado en bancos, gobierno, entornos que requieren SLA alto.

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre una VNet de Azure y una VPC de AWS?**
> Funcionalmente son equivalentes (red privada virtual en la nube), pero con diferencias: Azure VNet tiene un sistema de NSG con prioridades numéricas y reglas allow/deny, mientras que AWS usa Security Groups (solo allow, stateful) y NACLs (stateless, allow/deny). Azure también tiene los Resource Groups como capa de organización superior antes de la VNet. La gestión de identidades en Azure está más integrada con Entra ID por su herencia de Microsoft/Windows.

**2. ¿Qué es un Resource Group en Azure?**
> Un contenedor lógico que agrupa recursos relacionados de Azure (VMs, VNets, NSGs, Storage) para facilitar su gestión, facturación y control de acceso. Puedes dar permisos RBAC a nivel de Resource Group (un equipo solo puede gestionar los recursos de su RG). Si borras el RG, borras todos los recursos dentro. Es una capa de organización que AWS no tiene de forma equivalente.

**3. ¿Cómo conectarías la red on-prem con Azure?**
> Dos opciones principales: 1) VPN Site-to-Site (VPN Gateway): túnel IPsec sobre internet, más económico, adecuado para menor tráfico. 2) ExpressRoute: conexión privada dedicada vía proveedor de telecom, mayor velocidad, menor latencia, SLA garantizado, más costoso. Para un laboratorio o empresa pequeña, VPN Site-to-Site. Para banco o empresa con alto tráfico y requisitos de SLA, ExpressRoute.

**4. ¿Qué es Azure Blob Storage y en qué se diferencia de un file server on-prem?**
> Blob Storage es almacenamiento de objetos en la nube, altamente escalable y duradero (LRS, GRS, RA-GRS). A diferencia de un file server SMB, los objetos no tienen sistema de archivos jerárquico real (solo rutas simuladas), y el acceso es via HTTPS/REST API o SDK, no por SMB/CIFS. Azure también tiene Azure Files (sí soporta SMB) para reemplazar file servers on-prem con acceso nativo en Windows.

**5. Tienes AD on-prem y estás migrando a Azure. ¿Qué usas para que los usuarios usen las mismas credenciales en Microsoft 365?**
> Entra Connect (Azure AD Connect): sincroniza usuarios/grupos de AD on-prem hacia Entra ID con Password Hash Sync (las contraseñas hasheadas se sincronizan). Los usuarios usan las mismas credenciales para loguearse en Windows (AD on-prem) y en Teams/Outlook/SharePoint (Entra ID). Alternativamente, Pass-through Authentication o ADFS para casos más complejos.
