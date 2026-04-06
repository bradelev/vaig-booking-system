# VAIG Booking System — Guía de Usuario

Guía completa para el uso del sistema de reservas VAIG desde el backoffice web.

---

## Tabla de contenidos

1. [Acceso al sistema](#1-acceso-al-sistema)
2. [Dashboard](#2-dashboard)
3. [Agenda](#3-agenda)
4. [Citas](#4-citas)
5. [Clientes](#5-clientes)
6. [Servicios](#6-servicios)
7. [Paquetes](#7-paquetes)
8. [Profesionales](#8-profesionales)
9. [Pagos](#9-pagos)
10. [Sesiones](#10-sesiones)
11. [Métricas](#11-métricas)
12. [Templates de mensajes](#12-templates-de-mensajes)
13. [Campañas](#13-campañas)
14. [Configuración](#14-configuración)
15. [El chatbot de WhatsApp](#15-el-chatbot-de-whatsapp)
16. [Preguntas frecuentes](#16-preguntas-frecuentes)

---

## 1. Acceso al sistema

Para ingresar al backoffice, abrí tu navegador y andá a la URL del sistema (por ejemplo: `https://tu-dominio.vercel.app`). Se te redirigirá automáticamente a la pantalla de login.

**Inicio de sesión:**
- Ingresá tu email y contraseña
- Hacé clic en "Iniciar sesión"
- Una vez autenticado, serás redirigido al Dashboard

> Las credenciales son gestionadas por el administrador del sistema. Si no tenés acceso, solicitalo.

---

## 2. Dashboard

El Dashboard es la pantalla principal y muestra un resumen del día:

### Tarjetas de resumen
- **Citas hoy**: cantidad de citas programadas para hoy, con variación respecto a ayer
- **Pendientes**: cantidad de reservas sin seña pagada
- **Clientes**: total de clientes registrados en el sistema
- **Ingresos hoy**: cobros del día, con variación respecto a ayer

### Tabla de citas del día
Muestra las citas de hoy con hora, cliente, servicio, profesional y estado.

### Pagos pendientes de confirmación
Lista las reservas que están esperando confirmación de seña (transferencia bancaria). Podés confirmar cada una directamente desde esta tabla con el botón "Confirmar seña".

---

## 3. Agenda

La agenda es una vista visual tipo calendario para gestionar los turnos del día.

### Vistas disponibles
- **Día**: muestra las citas de un solo día en franjas horarias
- **4 días**: vista de 4 días consecutivos
- **Semana**: vista semanal completa
- **Mes**: vista mensual con indicadores de citas

### Funcionalidades
- **Navegar entre fechas**: usá las flechas o el botón "Hoy" para moverte entre días
- **Filtrar por profesional**: seleccioná un profesional específico para ver solo sus citas
- **Crear cita rápida**: hacé clic en un horario vacío para abrir el formulario de nueva cita
- **Ver detalle de cita**: hacé clic en una cita existente para ver o editar sus datos
- **Mover citas**: arrastrá una cita a otro horario para reagendarla

### Indicadores visuales
Cada cita se muestra con un color según su estado:
- Amarillo: Pendiente (esperando seña)
- Azul: Seña pagada
- Verde: Confirmada
- Gris: Realizada
- Rojo: Cancelada
- Naranja: No se presentó

---

## 4. Citas

La sección de Citas permite gestionar todas las reservas del sistema.

### Listado de citas
- Filtrá por fecha, estado o profesional
- Exportá el listado a CSV para procesarlo en Excel
- Visualizá las citas agrupadas por día

### Crear nueva cita
1. Hacé clic en **"+ Nueva cita"**
2. Seleccioná el cliente (podés buscar por nombre o teléfono)
3. Seleccioná el servicio
4. Elegí el profesional (opcional)
5. Seleccioná la fecha y hora
6. Agregá notas si es necesario
7. Hacé clic en "Guardar"

> Si el cliente no existe, podés crearlo rápidamente desde el mismo formulario.

### Editar una cita
- Hacé clic en la cita que querés modificar
- Cambiá los datos necesarios
- Guardá los cambios

### Cambiar estado de una cita
Desde la tabla de citas podés cambiar el estado de cualquier reserva:
- **Confirmar**: marca la cita como confirmada y crea un evento en Google Calendar
- **Marcar realizada**: indica que el servicio se completó
- **Cancelar**: cancela la cita (se solicita un motivo)
- **No show**: marca que el cliente no se presentó

### Cancelar una cita
1. Seleccioná el motivo de cancelación:
   - Solicitud del cliente
   - Profesional no disponible
   - Conflicto de horario
   - Otro
2. Opcionalmente, agregá una nota explicativa
3. Confirmá la cancelación

> Al cancelar, el cliente recibe una notificación automática por WhatsApp (si está habilitado en configuración).

---

## 5. Clientes

La sección de Clientes permite gestionar la base de datos de clientes.

### Listado de clientes
- **Buscar**: por nombre o teléfono
- **Filtrar por segmento**: S1 a S5 (ver abajo)
- **Ordenar**: por nombre, cantidad de sesiones o última visita
- **Paginación**: navega entre páginas de 30 clientes

### Segmentos de clientes
El sistema clasifica automáticamente a los clientes en segmentos:

| Segmento | Nombre | Descripción |
|---|---|---|
| S5 | VIP | Clientes con mayor actividad y fidelidad |
| S4 | 1ra visita | Clientes nuevos en su primera experiencia |
| S3 | Cross-sell | Oportunidad de ofrecer servicios adicionales |
| S2 | Cuponera | Clientes con paquetes o cupones activos |
| S1 | Dormido | Clientes inactivos que no visitan hace tiempo |

### Perfil del cliente
Al hacer clic en un cliente, podés ver:
- Datos personales (nombre, teléfono, email)
- Historial de citas y sesiones
- Paquetes activos
- Contactos registrados

### Crear nuevo cliente
1. Hacé clic en **"+ Nuevo cliente"**
2. Completá nombre, apellido y teléfono (con código de país, sin +)
3. Opcionalmente, agregá email
4. Guardá

---

## 6. Servicios

Gestioná los servicios que ofrece el negocio.

### Listado de servicios
Muestra todos los servicios con nombre, duración, precio, monto de seña y estado (activo/inactivo).

### Crear nuevo servicio
1. Hacé clic en **"+ Nuevo servicio"**
2. Completá los datos:
   - **Nombre**: nombre del servicio (ej: "Depilación Full Piernas")
   - **Descripción**: descripción para el chatbot (la IA usa esto para responder consultas)
   - **Duración** (minutos): afecta el cálculo de disponibilidad de turnos
   - **Precio**: precio base del servicio
   - **Monto de seña**: monto que el cliente debe abonar para reservar
   - **Profesional asignado**: profesional que realiza este servicio (opcional)
   - **Categoría**: categoría del servicio
3. Guardá

### Editar servicio
- Hacé clic en "Editar" en el servicio deseado
- Modificá los campos necesarios
- Guardá

> Los cambios en precio, monto de seña, nombre y duración quedan registrados en un log de auditoría automático.

---

## 7. Paquetes

Los paquetes permiten ofrecer un conjunto de sesiones a un precio especial.

### Listado de paquetes
Muestra los paquetes disponibles con nombre, cantidad de sesiones y precio.

### Crear nuevo paquete
1. Hacé clic en **"+ Nuevo paquete"**
2. Completá nombre, servicio asociado, cantidad de sesiones y precio
3. Guardá

### Cómo funcionan los paquetes
- Cuando un cliente compra un paquete, se le asigna un `client_package` con las sesiones incluidas
- Cada vez que se marca una cita como "Realizada" y está asociada a un paquete, el contador de sesiones usadas se incrementa automáticamente
- El sistema controla que no se excedan las sesiones incluidas

---

## 8. Profesionales

Gestioná los profesionales que atienden en el negocio.

### Listado de profesionales
Muestra los profesionales con su nombre y estado.

### Crear nuevo profesional
1. Hacé clic en **"+ Nuevo profesional"**
2. Completá el nombre
3. Guardá

### Gestión de horarios
Cada profesional tiene un horario semanal configurable:

1. Ingresá al perfil del profesional
2. Hacé clic en **"Horario"**
3. Configurá los bloques horarios para cada día de la semana
4. Guardá

### Excepciones de horario (Overrides)
Para días especiales (feriados, ausencias, horario extendido):

1. En la página de horario del profesional
2. Usá la sección "Excepciones"
3. Seleccioná la fecha
4. Indicá si el profesional no trabaja ese día, o definí un horario especial
5. Guardá

> El motor de disponibilidad usa estos horarios y excepciones para calcular los turnos libres que el chatbot ofrece a los clientes.

---

## 9. Pagos

La sección de Pagos permite confirmar los pagos de seña que llegan por transferencia bancaria.

### Flujo de pago
1. El cliente reserva un turno por WhatsApp
2. El sistema genera un link de Mercado Pago (si está habilitado) o muestra los datos de transferencia (CBU/Alias)
3. Si paga por Mercado Pago, la confirmación es **automática**
4. Si paga por transferencia, el admin debe **confirmar manualmente** desde esta sección

### Confirmar un pago
1. Verificá que la transferencia llegó a tu cuenta bancaria
2. Buscá la reserva en la lista de pagos pendientes
3. Hacé clic en **"Confirmar seña"**
4. La reserva pasa a estado "Seña pagada"

> Después de confirmar la seña, debés ir a Citas y cambiar el estado a "Confirmada" para que se cree el evento en Google Calendar.

---

## 10. Sesiones

La sección de Sesiones permite registrar las sesiones de tratamiento realizadas.

### Registrar una sesión
1. Buscá al cliente
2. Seleccioná la cita asociada
3. Completá los datos de la sesión (zona tratada, observaciones, etc.)
4. Guardá

### Exportar sesiones
Podés exportar el historial de sesiones a un archivo Excel (.xlsx) para análisis o backup.

---

## 11. Métricas

La sección de Métricas muestra datos de conversión del chatbot de WhatsApp.

### Embudo de conversión
Muestra cuántos usuarios pasan por cada etapa del flujo de reserva:

1. **Conversaciones iniciadas**: usuarios que escribieron al bot
2. **Seleccionaron servicio**: eligieron un servicio del menú
3. **Completaron datos**: proporcionaron sus datos personales
4. **Pagaron seña**: completaron el pago

Para cada etapa se muestra:
- Cantidad de sesiones
- Porcentaje del total
- Porcentaje respecto al paso anterior
- Drop-off (cuántos abandonaron)

### Filtro por período
Seleccioná el período de análisis:
- Últimos 7 días
- Últimos 30 días
- Últimos 90 días

### Gráficos
- **Actividad diaria**: gráfico de barras con la cantidad de sesiones de chatbot por día
- **Embudo de conversión**: gráfico visual del funnel

---

## 12. Templates de mensajes

Configurá los mensajes que el bot envía automáticamente por WhatsApp.

### Tipos de templates
Cada template tiene placeholders (variables) que se reemplazan automáticamente al enviar:

- **Recordatorio de turno**: se envía 24 horas antes de la cita
- **Encuesta post-atención**: se envía después del servicio
- **Recordatorio de pago**: se envía cuando hay un pago pendiente
- **Sugerencia de próxima sesión**: se envía para fidelizar al cliente
- **Aviso de cancelación**: se envía cuando el admin cancela una cita
- **Confirmación de pack**: se envía al comprar un paquete
- **Lista de espera**: se envía cuando se libera un turno

### Editar un template
1. Modificá el texto del mensaje
2. Usá los placeholders indicados (por ejemplo: `{{nombre}}`, `{{fecha}}`, `{{servicio}}`)
3. Hacé clic en **"Guardar templates"**

> Los placeholders disponibles se muestran debajo de cada template. Asegurate de no modificarlos ni borrarlos.

---

## 13. Campañas

Las campañas permiten enviar mensajes masivos por WhatsApp a segmentos de clientes.

### Crear una campaña
1. Hacé clic en **"Nueva campaña"**
2. Completá:
   - **Nombre**: nombre interno de la campaña
   - **Template de WhatsApp**: seleccioná el template aprobado por Meta
   - **Segmento objetivo**: a qué grupo de clientes se enviará
   - **Programación**: fecha y hora de envío (o envío inmediato)
3. Guardá

### Estados de una campaña
- **Borrador**: creada pero no programada
- **Programada**: esperando la fecha de envío
- **Enviando**: en proceso de envío
- **Completada**: todos los mensajes fueron enviados
- **Error**: hubo un problema durante el envío

### Ver resultados
Desde el detalle de cada campaña podés ver cuántos mensajes se enviaron y su estado.

---

## 14. Configuración

La página de Configuración permite ajustar parámetros del sistema.

### Negocio
- **Nombre del negocio**: se usa en los mensajes del bot
- **Teléfono admin (WhatsApp)**: número que recibe las notificaciones del sistema (con código de país, sin +)

### Pagos — Transferencia bancaria
- **CBU**: número de CBU para transferencias
- **Alias**: alias de la cuenta bancaria

### Pagos — Mercado Pago
- **Habilitar link de pago MP**: activa o desactiva la generación de links de Mercado Pago en los mensajes del bot

### Reservas
- **Cancelación automática (horas)**: tiempo tras el cual se cancelan automáticamente las reservas pendientes sin pago (por defecto: 24 horas)
- **Buffer entre turnos (minutos)**: tiempo libre entre citas consecutivas (por defecto: 0)

### Mensajería automática
Controlá qué mensajes automáticos se envían. Cada tipo de mensaje tiene tres opciones:

| Opción | Comportamiento |
|---|---|
| **Desactivado** | No se envía el mensaje |
| **Solo admin (testing)** | Se envía solo al teléfono admin para probar |
| **Todos los clientes** | Se envía a todos los clientes normalmente |

Mensajes configurables:
- Recordatorio de turno (24h antes)
- Encuesta post-atención
- Recordatorio de pago pendiente
- Sugerencia de próxima sesión
- Aviso de cancelación al cliente
- Confirmación de compra de pack
- Aviso de lista de espera

> Se recomienda usar primero la opción "Solo admin" para probar los mensajes antes de activarlos para todos los clientes.

---

## 15. El chatbot de WhatsApp

El chatbot atiende a los clientes las 24 horas del día, los 7 días de la semana.

### Qué puede hacer el bot
- **Mostrar el menú de servicios**: el cliente ve los servicios disponibles con precios
- **Responder consultas**: usando inteligencia artificial, responde preguntas sobre tratamientos, precios, preparaciones, etc.
- **Tomar reservas**: guía al cliente paso a paso para elegir servicio, profesional, fecha y hora
- **Generar link de pago**: envía un link de Mercado Pago o los datos para transferencia
- **Mostrar turnos del cliente**: el cliente puede ver sus reservas activas
- **Cancelar o reagendar**: el cliente puede cancelar o cambiar la fecha de su turno
- **Lista de espera**: si no hay turnos disponibles, el cliente puede anotarse en la lista de espera

### Palabras clave del bot
Los clientes pueden escribir estas palabras para navegar:
- **hola / menú / inicio**: volver al menú principal
- **mis turnos / mis citas / mis reservas**: ver reservas activas
- **cancelar**: cancelar una reserva
- **cambiar turno / reagendar**: cambiar la fecha de un turno
- **0**: volver al paso anterior

### Flujo de reserva del cliente
1. El cliente escribe al número de WhatsApp
2. El bot muestra el menú con opciones
3. El cliente selecciona un servicio
4. El bot muestra los horarios disponibles
5. El cliente elige un turno
6. El bot solicita confirmación de datos
7. El bot envía el link de pago o datos de transferencia
8. Al confirmar el pago, la reserva queda en estado "Seña pagada"
9. El admin confirma la reserva desde el backoffice

### Notificaciones automáticas
Si están habilitadas en Configuración, el sistema envía automáticamente:
- Recordatorio 24 horas antes del turno
- Encuesta de satisfacción después del servicio
- Recordatorio de pago si la seña está pendiente
- Sugerencia para agendar la próxima sesión

---

## 16. Preguntas frecuentes

### Un cliente pagó por transferencia, ¿cómo confirmo?
Andá a **Pagos**, buscá la reserva y hacé clic en "Confirmar seña". Luego andá a **Citas** y cambiá el estado a "Confirmada".

### ¿Cómo bloqueo un horario en la agenda?
Andá a **Profesionales > [Nombre] > Horario** y creá una excepción (override) para la fecha deseada marcando que no trabaja ese día.

### ¿Cómo cambio los precios de un servicio?
Andá a **Servicios**, hacé clic en "Editar" en el servicio y modificá el precio. El cambio queda registrado en el log de auditoría.

### ¿Cómo activo los recordatorios por WhatsApp?
Andá a **Configuración > Mensajería automática** y cambiá cada tipo de mensaje a "Todos los clientes". Se recomienda probar primero con "Solo admin".

### ¿Puedo enviar una campaña a un grupo de clientes?
Sí, andá a **Campañas > Nueva campaña**, seleccioná el segmento de clientes y el template de WhatsApp, y programá el envío.

### ¿Cómo veo el rendimiento del chatbot?
Andá a **Métricas** para ver el embudo de conversión: cuántas conversaciones se inician, cuántos clientes seleccionan servicio, cuántos completan datos y cuántos pagan.

### ¿El sistema crea eventos en Google Calendar?
Sí, automáticamente al cambiar el estado de una cita a "Confirmada". Si se cancela o se marca como no-show, el evento se elimina.

### ¿Qué pasa si un cliente no paga la seña a tiempo?
El sistema cancela automáticamente las reservas pendientes después del tiempo configurado en **Configuración > Cancelación automática** (por defecto: 24 horas).

### ¿Cómo funciona la lista de espera?
Cuando se cancela una cita, el sistema notifica automáticamente a los clientes que estaban en lista de espera para ese servicio y horario (si la mensajería de lista de espera está activada).

---

*Documentación actualizada: Abril 2026*
