---
title: 'Ops — ITIL v4 para SysAdmin'
description: Fundamentos de ITIL v4 aplicados al trabajo diario de SysAdmin. Gestión de incidentes, requerimientos, problemas y cambios. Integración con la capa 8 del modelo OSI.
sidebar:
  label: 'Ops: ITIL v4'
  badge:
    text: Básico
    variant: success
---

# ITIL v4 para SysAdmin — Gestión de Servicios de TI

**Duración estimada:** 1–2 horas  
**Dificultad:** Básico

---

## 📚 ¿Qué es ITIL?

**ITIL (Information Technology Infrastructure Library)** es un marco de mejores prácticas para la gestión de servicios de TI. La versión 4 (2019) se enfoca en co-crear valor entre TI y el negocio.

Para un SysAdmin, ITIL no es burocracia — es el lenguaje común para comunicarse con el equipo, el negocio y los clientes sobre cómo se gestionan los servicios de TI.

---

## 🎯 El Sistema de Valor del Servicio (SVS)

El núcleo de ITIL v4 es que TI debe generar **valor** para el negocio:

```
DEMANDA DEL NEGOCIO
    │
    ▼
┌──────────────────────────────────────────────┐
│           Sistema de Valor del Servicio       │
│                                              │
│  Principios guía → Gobernanza               │
│                                              │
│  ┌─────────────────────────────────────────┐│
│  │     Cadena de Valor del Servicio        ││
│  │  Planear → Comprometer → Diseñar →      ││
│  │  Obtener → Entregar → Mejorar           ││
│  └─────────────────────────────────────────┘│
│                                              │
│  Prácticas ITIL (34 prácticas)              │
└──────────────────────────────────────────────┘
    │
    ▼
VALOR PARA EL NEGOCIO
```

---

## 🚨 Gestión de Incidentes

Un **incidente** es una interrupción no planificada o degradación de un servicio de TI.

### Definición y ejemplos

| Incidente | No es incidente |
|---|---|
| El email no funciona | Solicitar una cuenta de email nueva |
| El servidor DC01 está caído | Planificar el mantenimiento del DC |
| El usuario no puede imprimir | El usuario quiere una impresora nueva |
| VPN no conecta | Cambiar la política de VPN |

### Priorización de incidentes

```
Prioridad = Impacto × Urgencia

IMPACTO: ¿cuántos usuarios/servicios afecta?
  - Crítico: toda la organización / servicio de negocio crítico
  - Alto: un departamento / servicio importante
  - Medio: un equipo pequeño / usuario clave
  - Bajo: un usuario individual / servicio no crítico

URGENCIA: ¿cuánto puede esperar sin resolución?
  - Crítica: requiere resolución inmediata (< 1 hora)
  - Alta: requiere resolución hoy (< 4 horas)
  - Media: puede esperar (< 8 horas / siguiente día laboral)
  - Baja: puede esperar varios días
```

### Ciclo de vida de un incidente

```
1. DETECCIÓN: usuario reporta o monitoreo alerta
2. REGISTRO: crear ticket con descripción, CI afectado, usuario, prioridad
3. CLASIFICACIÓN: categorizar (red, AD, hardware, software, etc.)
4. INVESTIGACIÓN: diagnosticar causa
5. RESOLUCIÓN: aplicar solución o workaround
6. CIERRE: confirmar con el usuario, documentar solución
```

### Workaround vs Solución definitiva

- **Workaround**: solución temporal que restaura el servicio sin eliminar la causa raíz (ej: reiniciar el servicio que está fallando)
- **Solución definitiva**: elimina la causa raíz (ej: actualizar el software que tiene el bug que causa el fallo)

---

## 📋 Gestión de Requerimientos (Service Requests)

Un **requerimiento** es una solicitud formal de algo que el usuario necesita y que no implica una interrupción del servicio.

### Ejemplos de requerimientos

- Crear/modificar/deshabilitar cuentas de usuario
- Instalar software
- Acceso a un recurso compartido
- Configurar VPN para un usuario remoto
- Resetear contraseña

### Diferencia clave: Incidente vs Requerimiento

| Aspecto | Incidente | Requerimiento |
|---|---|---|
| **Causa** | Algo que se rompió | Algo que se necesita |
| **Estado normal** | Servicio degradado | Servicio normal |
| **Urgencia** | Mayor (restaurar servicio) | Menor (fulfillment planificado) |
| **SLA** | Tiempo de resolución | Tiempo de atención |
| **Ejemplo** | "El login de AD no funciona" | "Crear cuenta para empleado nuevo" |

---

## 🔍 Gestión de Problemas

Un **problema** es la causa raíz de uno o más incidentes. La gestión de problemas busca eliminar esa causa para que los incidentes no se repitan.

### Incidente vs Problema vs Error Conocido

```
INCIDENTE                   PROBLEMA                    ERROR CONOCIDO
"El servidor web caía       Investigación: ¿por         Se descubre que hay
cada lunes a las 8am"  ──▶  qué cae repetidamente? ──▶  un memory leak en
Workaround: reiniciar       Root Cause Analysis         versión 2.1.3 del app.
                                                        Workaround documentado.
                                                        Solución: actualizar a 2.2.0
```

### Root Cause Analysis (RCA)

Técnica de los **5 Whys** — preguntar "¿por qué?" repetidamente hasta llegar a la causa raíz:

```
Incidente: "Los usuarios no pueden autenticarse en el dominio"

Why 1: ¿Por qué no pueden autenticarse?
→ El DC01 no responde.

Why 2: ¿Por qué DC01 no responde?
→ El servicio Netlogon está detenido.

Why 3: ¿Por qué Netlogon se detuvo?
→ Disco C: lleno al 100%, los servicios no pueden escribir logs.

Why 4: ¿Por qué el disco C: está lleno?
→ Los logs de IIS llevan 6 meses sin rotar y ocupan 80 GB.

Why 5: ¿Por qué no se rotan los logs?
→ La tarea programada de rotación fue eliminada accidentalmente hace 6 meses.

CAUSA RAÍZ: eliminación accidental de la tarea de rotación de logs.
SOLUCIÓN: restaurar la tarea de rotación, implementar alertas de disco al 85%.
```

---

## 🔧 Gestión de Cambios

Un **cambio** es la adición, modificación o eliminación de cualquier componente que pueda afectar los servicios de TI.

### Tipos de cambios

| Tipo | Descripción | Aprobación | Ejemplo |
|---|---|---|---|
| **Normal** | Cambio planificado con evaluación de riesgo | CAB (Change Advisory Board) | Actualización de servidor, cambio de firewall |
| **Estándar** | Cambio pre-aprobado de bajo riesgo | Pre-autorizado | Crear usuario, resetear contraseña |
| **Emergencia** | Cambio urgente para resolver incidente crítico | CAB de emergencia o senior mgmt | Parche urgente de seguridad |

### Proceso de gestión de cambios

```
1. SOLICITUD DE CAMBIO (RFC): descripción, razón, plan de implementación, plan de rollback
2. EVALUACIÓN: análisis de riesgo e impacto
3. APROBACIÓN: CAB (normal) o pre-autorizado (estándar)
4. IMPLEMENTACIÓN: en ventana de mantenimiento
5. REVISIÓN: verificar éxito, documentar lecciones aprendidas
6. CIERRE: actualizar CMDB
```

---

## 🧑‍💻 La Capa 8 del Modelo OSI — Las Personas

La "Capa 8" (no oficial) es el factor humano — las personas que usan, gestionan y toman decisiones sobre la red:

```
Capa 8 (Personas)
    │
    ├── Usuarios que cometen errores (borran archivos, dan click en phishing)
    ├── Técnicos que mal-configuran equipos
    ├── Gerentes que aprueban cambios sin entender el impacto
    ├── Proveedores que no responden a tiempo
    └── Reguladores con requisitos de cumplimiento
```

### ITIL como herramienta para gestionar la capa 8

- **Gestión de incidentes**: proceso claro para que los usuarios sepan cómo reportar y qué esperar
- **SLAs (Service Level Agreements)**: acuerdos formales sobre tiempos de respuesta
- **Comunicación**: durante incidentes graves, actualizar regularmente a los afectados
- **Gestión del conocimiento**: base de conocimiento con soluciones documentadas (reduce dependencia de personas específicas)

---

## 📊 Métricas ITIL Clave para SysAdmin

| Métrica | Descripción | Objetivo típico |
|---|---|---|
| **MTTR (Mean Time To Restore)** | Tiempo promedio de resolución de incidentes | < 4h para P2 |
| **MTBF (Mean Time Between Failures)** | Tiempo promedio entre incidentes del mismo tipo | Lo más alto posible |
| **SLA Compliance** | % de incidentes resueltos dentro del SLA | > 95% |
| **First Contact Resolution** | % resueltos en primer contacto | > 70% |
| **Backlog de problemas** | Problemas abiertos sin causa raíz identificada | Reducir continuamente |

---

## 🎤 Preguntas de Entrevista

**1. ¿Cuál es la diferencia entre un incidente y un requerimiento en ITIL?**
> Un incidente es una interrupción no planificada de un servicio — algo que se rompió y hay que restaurar. Un requerimiento (service request) es una solicitud formal de algo que el usuario necesita, sin que haya una interrupción del servicio. Ejemplo: "el servidor web está caído" = incidente (urgente, restore service). "Necesito acceso a la carpeta del proyecto X" = requerimiento (se atiende en el SLA planificado).

**2. ¿Cuál es la diferencia entre un incidente y un problema?**
> Un incidente es el síntoma (el servidor cayó, el usuario no puede conectarse). Un problema es la causa raíz de uno o más incidentes (hay un memory leak en el software que causa que el servidor caiga periódicamente). La gestión de incidentes busca restaurar el servicio rápidamente; la gestión de problemas busca eliminar la causa raíz para que el incidente no se repita.

**3. Describes haber trabajado con incidentes y requerimientos. ¿Cómo priorizabas?**
> Usaba la matriz de Impacto × Urgencia: incidentes P1 (toda la organización afectada) se atendían de inmediato y se escalaban al equipo senior; P2 (departamento afectado) en menos de 4 horas; P3 (usuario individual) en el día; P4 (baja urgencia) antes del próximo día laboral. Los requerimientos seguían el proceso estándar con SLA de 1-3 días laborales dependiendo de la complejidad.

**4. Cuéntame sobre un rollback que tuviste que hacer.**
> [Adaptar con experiencia real] El proceso que sigo: antes del cambio exporto la configuración actual (snapshot, backup de config de red, copia de scripts), defino los criterios de rollback, y ejecuto en ventana de mantenimiento. Si el cambio falla: ejecuto el plan de rollback inmediatamente (no intentar arreglarlo si está fuera del tiempo acordado), comunico al equipo el estado, y documento lo que salió mal para el análisis post-incidente.

**5. ¿Qué es la "capa 8" del modelo OSI?**
> La capa 8 es el factor humano — no es oficial del estándar OSI, pero es reconocida en la industria. Representa que muchos problemas de TI tienen su origen en personas: usuarios que hacen click en phishing, técnicos que mal-configuran equipos, gerentes que toman decisiones sin entender el impacto técnico. ITIL es en parte un framework para gestionar esta capa: procesos claros, documentación, SLAs, y comunicación para reducir los problemas causados por el factor humano.

**6. ¿Para qué sirve un SLA en el contexto de soporte de TI?**
> Un SLA (Service Level Agreement) es el acuerdo formal entre TI y el negocio sobre los niveles de servicio esperados: tiempos de respuesta y resolución por prioridad, disponibilidad del servicio (ej: 99.9% uptime), y consecuencias si no se cumple. Para el SysAdmin, el SLA define las expectativas claras y permite priorizar trabajo. Para el negocio, da visibilidad y previsibilidad sobre los servicios de TI.
