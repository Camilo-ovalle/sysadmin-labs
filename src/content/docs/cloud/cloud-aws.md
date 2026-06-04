---
title: 'Cloud AWS — Fundamentos para SysAdmin'
description: Conceptos esenciales de AWS para SysAdmins y preparación para la certificación AWS. VPC, EC2, S3, IAM, Security Groups, y mapeo de conceptos on-prem a cloud.
sidebar:
  label: 'Cloud: AWS Fundamentos'
  badge:
    text: Intermedio
    variant: caution
---

# Cloud AWS — Fundamentos para SysAdmin

**Duración estimada:** 2–3 horas de estudio  
**Dificultad:** Intermedio  
**Nota:** Requiere cuenta AWS (tier gratuito disponible en `aws.amazon.com/free`)

---

## 🗺️ Mapeo: On-Premise → AWS

| Concepto On-Prem | Equivalente en AWS | Notas |
|---|---|---|
| Servidor físico/VM | **EC2 Instance** | Virtual machine en la nube |
| Red local (LAN) | **VPC (Virtual Private Cloud)** | Tu propia red privada en AWS |
| Subred | **Subnet** | Subred dentro de una VPC |
| Router | **Route Table** | Tabla de rutas en la VPC |
| Firewall (host) | **Security Group** | Firewall stateful por instancia |
| Firewall (red) | **NACL (Network ACL)** | Firewall stateless por subred |
| Internet | **Internet Gateway** | Puerta de salida de la VPC a internet |
| VPN Site-to-Site | **AWS VPN Gateway** | Conectar on-prem con VPC |
| Storage NAS/SAN | **Amazon S3 / EBS / EFS** | Almacenamiento en nube |
| Active Directory | **AWS Directory Service** | AD gestionado en AWS |
| DNS on-prem | **Amazon Route 53** | DNS en la nube |
| Load Balancer | **ELB / ALB / NLB** | Balanceo de carga gestionado |

---

## 🌐 VPC — Virtual Private Cloud

Una **VPC** es tu red privada en AWS: defines el rango de IPs, subredes, tablas de rutas y gateways.

### Componentes de una VPC

```
VPC: 10.0.0.0/16
├── Public Subnet:  10.0.1.0/24  (AZ us-east-1a)
│   └── EC2 con IP pública, accesible desde internet
├── Private Subnet: 10.0.2.0/24  (AZ us-east-1a)
│   └── EC2 sin IP pública, solo accesible internamente
└── Private Subnet: 10.0.3.0/24  (AZ us-east-1b)
    └── Base de datos RDS
```

### ¿Por qué hay subredes públicas y privadas?

- **Pública**: tiene ruta hacia el Internet Gateway → acceso directo desde internet (web servers, bastión/jump host)
- **Privada**: sin ruta directa a internet → más segura (application servers, bases de datos)

Para que instancias en subred privada puedan salir a internet (sin ser accesibles desde internet): **NAT Gateway** en la subred pública.

### Crear una VPC básica con AWS CLI

```bash
# Crear VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 \
    --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=mi-vpc}]'

# Crear subred pública
aws ec2 create-subnet --vpc-id vpc-XXXXXXXX \
    --cidr-block 10.0.1.0/24 \
    --availability-zone us-east-1a \
    --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet}]'

# Crear Internet Gateway y asociar a la VPC
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway --vpc-id vpc-XXXXXXXX --internet-gateway-id igw-XXXXXXXX

# Crear tabla de rutas y agregar ruta a internet
aws ec2 create-route-table --vpc-id vpc-XXXXXXXX
aws ec2 create-route --route-table-id rtb-XXXXXXXX --destination-cidr-block 0.0.0.0/0 --gateway-id igw-XXXXXXXX
aws ec2 associate-route-table --subnet-id subnet-XXXXXXXX --route-table-id rtb-XXXXXXXX
```

---

## 🛡️ Security Groups vs NACLs

### Security Groups (el más importante para la entrevista)

- **Stateful**: si permites tráfico entrante en puerto 80, la respuesta saliente es automática
- Operan a nivel de instancia (EC2)
- Solo reglas de **permit** (todo lo no especificado está denegado)
- Se asocian a interfaces de red

```bash
# Crear Security Group
aws ec2 create-security-group \
    --group-name "WebServer-SG" \
    --description "Allow HTTP/HTTPS from internet" \
    --vpc-id vpc-XXXXXXXX

# Agregar regla: permitir HTTP desde internet
aws ec2 authorize-security-group-ingress \
    --group-id sg-XXXXXXXX \
    --protocol tcp --port 80 --cidr 0.0.0.0/0

# Permitir SSH solo desde tu IP
aws ec2 authorize-security-group-ingress \
    --group-id sg-XXXXXXXX \
    --protocol tcp --port 22 --cidr <TU-IP>/32

# Ver reglas del Security Group
aws ec2 describe-security-groups --group-ids sg-XXXXXXXX
```

### NACLs (Network ACLs)

- **Stateless**: debes permitir tanto el tráfico entrante como el saliente explícitamente
- Operan a nivel de subred
- Tienen reglas de **permit y deny** numeradas (se evalúan en orden ascendente)
- Más complejo de gestionar, menos usado para protección granular

| | Security Group | NACL |
|---|---|---|
| **Nivel** | Instancia | Subred |
| **Estado** | Stateful | Stateless |
| **Reglas** | Solo Allow | Allow + Deny |
| **Evaluación** | Todas las reglas | En orden (primera coincidencia) |

---

## 💻 EC2 — Elastic Compute Cloud

EC2 son las máquinas virtuales de AWS.

### Tipos de instancia (los más relevantes)

| Familia | Para qué sirve | Ejemplo |
|---|---|---|
| `t3`, `t4g` | General purpose, burst (ideal para labs y servidores pequeños) | `t3.micro` (Free Tier) |
| `m5`, `m6i` | General purpose balanceado | `m5.large` |
| `c5`, `c6i` | Compute intensive | `c5.xlarge` |
| `r5`, `r6i` | Memory intensive (bases de datos) | `r5.large` |

### Lanzar una instancia EC2

```bash
# Lanzar EC2 con Amazon Linux 2
aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \  # Amazon Linux 2 (us-east-1)
    --instance-type t3.micro \
    --key-name mi-key-pair \
    --security-group-ids sg-XXXXXXXX \
    --subnet-id subnet-XXXXXXXX \
    --associate-public-ip-address \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=WebServer-01}]'
```

### Conectarse por SSH

```bash
# Linux/Mac
chmod 400 mi-key-pair.pem
ssh -i mi-key-pair.pem ec2-user@<IP-PUBLICA>

# Windows (con PuTTY o Terminal)
# Convertir .pem a .ppk con PuTTYgen
```

---

## 🗄️ Amazon S3 — Simple Storage Service

S3 es el servicio de almacenamiento de objetos de AWS. Almacena archivos (objetos) en "buckets" (contenedores).

### Conceptos clave

- **Bucket**: contenedor de objetos, nombre único global en todo AWS
- **Objeto**: archivo + metadatos, hasta 5 TB por objeto
- **Clases de storage**: Standard (acceso frecuente), IA (acceso infrecuente), Glacier (archivado)
- **Versioning**: guarda versiones anteriores de los archivos
- **Bucket Policy**: control de acceso basado en JSON

### Comandos AWS CLI para S3

```bash
# Crear un bucket
aws s3 mb s3://mi-bucket-corp-2024 --region us-east-1

# Subir archivo
aws s3 cp archivo.txt s3://mi-bucket-corp-2024/

# Sincronizar directorio local con S3 (útil para backups)
aws s3 sync /datos/backups/ s3://mi-bucket-corp-2024/backups/

# Listar objetos
aws s3 ls s3://mi-bucket-corp-2024/

# Descargar archivo
aws s3 cp s3://mi-bucket-corp-2024/archivo.txt ./

# Eliminar objeto
aws s3 rm s3://mi-bucket-corp-2024/archivo.txt

# Vaciar y eliminar bucket
aws s3 rm s3://mi-bucket-corp-2024/ --recursive
aws s3 rb s3://mi-bucket-corp-2024/
```

---

## 🔑 IAM — Identity and Access Management

IAM controla quién puede acceder a qué en tu cuenta AWS.

### Conceptos

- **User**: cuenta para una persona (tiene access key o contraseña de consola)
- **Group**: colección de usuarios con las mismas políticas
- **Role**: identidad temporal asumible por servicios AWS o usuarios federados
- **Policy**: documento JSON que define permisos

### Principio de menor privilegio

Nunca dar más permisos de los necesarios. Ejemplo malo: dar `AdministratorAccess` a todos. Ejemplo bueno: dar solo `AmazonS3ReadOnlyAccess` al servicio que solo necesita leer de S3.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject", "s3:ListBucket"],
            "Resource": ["arn:aws:s3:::mi-bucket-corp-2024", "arn:aws:s3:::mi-bucket-corp-2024/*"]
        }
    ]
}
```

---

## 🎤 Preguntas de Entrevista

**1. ¿Qué es una VPC y por qué se usa?**
> Una VPC (Virtual Private Cloud) es tu red privada virtual en AWS, aislada lógicamente de otras cuentas. Te permite definir tu propio espacio de IPs (CIDR), crear subredes públicas y privadas, configurar tablas de rutas y controlar el tráfico con Security Groups y NACLs. Es el equivalente a tu red corporativa on-prem, pero en la nube.

**2. ¿Cuál es la diferencia entre un Security Group y una NACL?**
> Security Group: actúa a nivel de instancia EC2, es stateful (permite automáticamente la respuesta), solo tiene reglas de allow. NACL: actúa a nivel de subred, es stateless (debes definir reglas de entrada Y salida), puede tener reglas de allow y deny evaluadas por número. En práctica, los Security Groups son la herramienta principal de control de acceso en AWS.

**3. ¿Qué diferencia hay entre una subred pública y una privada en AWS?**
> La diferencia es la tabla de rutas: una subred pública tiene una ruta hacia el Internet Gateway (0.0.0.0/0 → igw-XXX), lo que permite que las instancias tengan IP pública y sean accesibles desde internet. Una subred privada no tiene esa ruta, por lo que las instancias no son accesibles desde internet. Para que las instancias privadas salgan a internet (sin ser accesibles), se usa un NAT Gateway en la subred pública.

**4. ¿Qué es S3 y para qué se usa en un entorno empresarial?**
> S3 es almacenamiento de objetos altamente duradero (11 nueves de durabilidad). Se usa para: backups automatizados de servidores/bases de datos, almacenamiento de logs, distribución de software/actualizaciones, almacenamiento de imágenes/archivos estáticos de aplicaciones web, y archivado de largo plazo (Glacier). Tiene versioning, lifecycle policies y cifrado en reposo.

**5. Despliegas una EC2 pero no puedes conectarte por SSH. ¿Qué revisas?**
> 1. El Security Group de la instancia: ¿tiene regla que permita TCP 22 desde tu IP? 2. ¿La instancia está en una subred pública con IP pública? 3. ¿La tabla de rutas de la subred tiene una ruta hacia el Internet Gateway? 4. ¿La NACL de la subred permite el tráfico SSH (tanto entrada como salida)? 5. ¿El firewall del SO dentro de la instancia (`iptables`/`firewalld`) está bloqueando el puerto?

**6. ¿Qué es IAM y cuál es el principio de menor privilegio?**
> IAM gestiona las identidades (usuarios, roles, grupos) y sus permisos en AWS. El principio de menor privilegio significa otorgar solo los permisos estrictamente necesarios para la tarea, nada más. En práctica: no usar root account para operaciones diarias, crear usuarios IAM con solo las políticas que necesitan, usar roles para dar permisos a servicios AWS (ej: EC2 que accede a S3 usa un IAM Role, no credenciales hardcodeadas).
