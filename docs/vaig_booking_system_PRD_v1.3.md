**VAIG**

*Depilación Laser & Estética*

**Sistema de Reservas — WhatsApp Bot + Backoffice**

Product Requirements Document

*Versión 1.3 · Marzo 2026 · Confidencial*

|               |                                                                     |
|---------------|---------------------------------------------------------------------|
| **Producto**  | VAIG Booking System                                                 |
| **Versión**   | 1.3 — Draft                                                         |
| **Fecha**     | Marzo 2026                                                          |
| **Autor**     | Braulio de León                                                     |
| **Stack**     | Next.js 14 · Supabase · WhatsApp Business API · Google Calendar API |
| **Revisores** | Pendiente asignación                                                |
| **Estado**    | En revisión                                                         |

**Tabla de contenidos**

**1. Resumen ejecutivo**

VAIG necesita un sistema de reservas end-to-end que elimine la fricción del proceso actual (coordinación manual por WhatsApp), reduzca el no-show, automatice la cobranza parcial y genere datos accionables sobre conversión, retención y satisfacción de clientes.

El sistema combina un chatbot conversacional de WhatsApp con LLM, un motor de scheduling inteligente, un backoffice operativo para el equipo de VAIG y una capa de automatización post-atención (seguimiento, encuestas, reseñas Google).

**Objetivo de negocio primario:** aumentar la tasa de conversión de consultas a reservas confirmadas y reducir el no-show a menos del 10%.

**2. Contexto y problema**

**2.1 Situación actual**

- Las reservas se coordinan manualmente por WhatsApp con la profesional o recepcionista.

- No hay cobro de seña sistemático: tasa de no-show alta.

- No existe registro centralizado de clientes ni historial de tratamientos.

- Las respuestas a consultas de precios/tratamientos consumen tiempo del equipo.

- El seguimiento post-atención y las reseñas Google dependen de la iniciativa individual.

**2.2 Impacto estimado sin solución**

- Pérdida de turnos por no-show no cobrado.

- Fricción de coordinación = menor conversión de leads de Instagram/Google.

- Ausencia de datos: sin capacidad de optimizar agenda ni retención.

- Dependencia operativa de una sola persona para gestionar la agenda.

**3. Usuarios y roles**

| **Rol**           | **Actor**             | **Necesidades clave**                                                                                                                                                 |
|-------------------|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Cliente final** | Usuario WhatsApp      | Consultar tratamientos, agendar sin fricción, recibir recordatorios, pagar fácil.                                                                                     |
| **Profesional**   | Estética / depiladora | CRUD reservas, CRUD servicios y precios, marcar sesiones como realizadas. Mismo acceso que admin excepto gestión de profesionales y configuración global del sistema. |
| **Administrador** | Dueño / gestión VAIG  | Acceso total: CRUD reservas, CRUD servicios, CRUD profesionales, configuración global, templates WA, reglas de scheduling.                                            |
| **Sistema**       | Bot + Cron jobs       | Orquestar flujos automáticos: recordatorios, encuestas, eventos Google Calendar.                                                                                      |

**4. Arquitectura y stack**

**4.1 Componentes principales**

| **Capa**                  | **Tecnología**                         | **Responsabilidad**                                                     |
|---------------------------|----------------------------------------|-------------------------------------------------------------------------|
| **Frontend / Backoffice** | Next.js 14 (App Router)                | UI de administración, dashboard, CRUD reservas/servicios.               |
| **Base de datos**         | Supabase (PostgreSQL)                  | Persistencia, RLS, realtime para el backoffice.                         |
| **Auth**                  | Supabase Auth                          | Login backoffice (admin + profesionales).                               |
| **WhatsApp**              | WhatsApp Business API (Cloud API Meta) | Canal de entrada de reservas, notificaciones, recordatorios, encuestas. |
| **LLM / RAG**             | Claude API (claude-sonnet-4)           | Responder consultas de tratamientos/precios con knowledge base.         |
| **Calendario**            | Google Calendar API                    | Creación de eventos al confirmar reserva. Lectura de disponibilidad.    |
| **Cron jobs**             | Vercel Cron / Supabase pg_cron         | Recordatorios 24hs, batch encuestas al cierre del día.                  |
| **Pagos**                 | Mercado Pago / link bancario           | Generación de link de pago o datos de transferencia.                    |

**4.2 Diagrama de flujo de datos (simplificado)**

> WhatsApp → Webhook Next.js API Route → Bot Engine (estado conversación en Supabase) → LLM / Scheduler → WhatsApp reply
>
> Backoffice → Next.js Server Actions → Supabase RLS → Google Calendar API
>
> Cron (23:00 UY) → Supabase pg_cron → batch mensajes WA (recordatorios + encuestas)

**5. Modelo de datos**

**5.1 Entidades principales**

**services**

| **Campo**                   | **Tipo**    | **Descripción**                                   |
|-----------------------------|-------------|---------------------------------------------------|
| **id**                      | uuid PK     | Identificador único                               |
| **name**                    | text        | Nombre del servicio (ej: Depilación Full Piernas) |
| **description**             | text        | Descripción para LLM knowledge base               |
| **duration_minutes**        | int         | Duración en minutos (afecta slots disponibles)    |
| **price**                   | numeric     | Precio base                                       |
| **deposit_amount**          | numeric     | Monto de seña requerida                           |
| **default_professional_id** | uuid FK     | Profesional asignada por defecto                  |
| **is_active**               | bool        | Habilitado para reservas online                   |
| **created_at**              | timestamptz |                                                   |

**bookings**

| **Campo**                | **Tipo**     | **Descripción**                                                                                         |
|--------------------------|--------------|---------------------------------------------------------------------------------------------------------|
| **id**                   | uuid PK      |                                                                                                         |
| **client_id**            | uuid FK      | Referencia a clients                                                                                    |
| **service_id**           | uuid FK      | Referencia a services                                                                                   |
| **professional_id**      | uuid FK      | Profesional asignada al turno                                                                           |
| **scheduled_at**         | timestamptz  | Fecha y hora del turno                                                                                  |
| **status**               | enum         | pending \| deposit_paid \| confirmed \| realized \| cancelled \| no_show                                |
| **deposit_paid_at**      | timestamptz  | Timestamp de confirmación de seña                                                                       |
| **gcal_event_id**        | text         | ID del evento en Google Calendar (creado al confirmar seña)                                             |
| **confirmation_sent_at** | timestamptz  | Timestamp del recordatorio 24hs                                                                         |
| **client_confirmed_at**  | timestamptz  | Timestamp de confirmación del cliente                                                                   |
| **survey_sent_at**       | timestamptz  | Timestamp del envío de encuesta                                                                         |
| **survey_response**      | jsonb        | Respuesta de encuesta (score + comentario)                                                              |
| **notes**                | text         | Notas internas del backoffice                                                                           |
| **cancellation_reason**  | enum NULL    | professional_unavailable \| location_closed \| client_request \| other. NULL si no está cancelada.      |
| **cancellation_note**    | text NULL    | Texto libre del admin al cancelar. Se incluye en el WA si reason = other.                               |
| **cancelled_by**         | enum NULL    | admin \| client. Determina el template WA a usar.                                                       |
| **client_package_id**    | uuid FK NULL | Si el turno descuenta de un pack activo, referencia a client_packages. NULL para reservas individuales. |
| **created_at**           | timestamptz  |                                                                                                         |
| **updated_at**           | timestamptz  |                                                                                                         |

**Entidades adicionales**

- clients (id, first_name, last_name, phone, email, created_at, notes, source)

- professionals (id, name, google_calendar_id, is_active, specialties\[\], location_id NULL)

- conversation_sessions (id, phone, state, context_json, last_message_at) — estado del bot por sesión WA

- rate_limit_log (id, phone, message_count, window_start) — control de rate limiting por número

- survey_templates (id, type, questions_json, active) — flexible para A/B de encuestas

- payments (id, booking_id, amount, method, reference, confirmed_at, confirmed_by)

- service_audit_log (id, service_id, edited_by uuid FK, edited_at timestamptz, field_changed text, old_value text, new_value text) — historial de cambios sobre servicios, precios y señas para ambos roles

**5.2 Paquetes de sesiones (F03)**

Modelo para la venta de N sesiones prepagadas del mismo servicio con descuento. Pago completo vía MP. Cualquier profesional puede atender cada sesión del pack.

**service_packages**

| **Campo**         | **Tipo**    | **Descripción**                                                      |
|-------------------|-------------|----------------------------------------------------------------------|
| **id**            | uuid PK     |                                                                      |
| **service_id**    | uuid FK     | Servicio base al que pertenece el pack (ej: Depilación Full Piernas) |
| **name**          | text        | Nombre comercial del pack (ej: 'Pack 6 sesiones Full Piernas')       |
| **session_count** | int         | Cantidad de sesiones incluidas en el pack                            |
| **price**         | numeric     | Precio total del pack (ya con descuento aplicado)                    |
| **is_active**     | bool        | Habilitado para venta online y bot                                   |
| **created_at**    | timestamptz |                                                                      |

**client_packages**

| **Campo**             | **Tipo**         | **Descripción**                                                      |
|-----------------------|------------------|----------------------------------------------------------------------|
| **id**                | uuid PK          |                                                                      |
| **client_id**         | uuid FK          | Referencia al cliente propietario del pack                           |
| **package_id**        | uuid FK          | Referencia a service_packages                                        |
| **sessions_total**    | int              | Copia de session_count al momento de la compra (inmutable)           |
| **sessions_used**     | int              | Sesiones consumidas. Incrementa cuando booking pasa a 'realized'     |
| **paid_at**           | timestamptz      | Timestamp del pago completo confirmado (webhook MP)                  |
| **payment_reference** | text             | ID de transacción MP o referencia de pago                            |
| **expires_at**        | timestamptz NULL | Vencimiento del pack. NULL = sin vencimiento. Configurable por pack. |
| **created_at**        | timestamptz      |                                                                      |

> *⚠ sessions_used se incrementa al transicionar a 'realized', no a 'confirmed'. Si el cliente es no_show, la sesión igual se descuenta del pack. Esta regla debe quedar explícita en los términos comunicados al cliente.*

**Flujo bot con pack activo**

> Cliente escribe "quiero agendar"
>
> → Bot detecta client_packages con sessions_used \< sessions_total (y expires_at NULL o futuro)
>
> *→ "Tenés un pack de 6 sesiones de Depilación Full Piernas con 4 sesiones disponibles. ¿Agendamos una sesión del pack?"*
>
> → Sí: flujo de scheduling normal. Sin cobro de seña. booking.client_package_id = pack.id
>
> → No: flujo de reserva individual normal con cobro de seña

**6. Estados de reserva y transiciones**

| **Estado**       | **Trigger**                                                                     | **Acciones automáticas**                                                                                                                                                                                                                                                                                      |
|------------------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **pending**      | Reserva creada por bot                                                          | Enviar WA con datos de pago (CBU / link MP). Timer: si no paga en X horas → reminder o auto-cancel (configurable).                                                                                                                                                                                            |
| **deposit_paid** | Admin confirma pago manualmente / webhook MP (monto exacto, método MP)          | Sin acción automática hacia el cliente. Aparece en cola de 'pagos sin confirmar' en el dashboard del backoffice. Admin debe verificar disponibilidad real del calendario antes de confirmar.                                                                                                                  |
| **confirmed**    | Acción manual explícita del admin en backoffice (tras verificar disponibilidad) | Crear evento en Google Calendar. Enviar WA de confirmación al cliente con fecha, hora y profesional.                                                                                                                                                                                                          |
| **realized**     | Profesional marca en backoffice                                                 | Trigger: cron de fin de día detecta y envía encuesta de satisfacción por WA.                                                                                                                                                                                                                                  |
| **cancelled**    | Admin cancela desde backoffice (con motivo) / Cliente cancela por bot           | Admin: WA con mensaje según motivo (professional_unavailable \| location_closed \| client_request \| other+texto libre). Si VAIG cancela: incluye CTA para reagendar. Si cliente cancela por bot: WA neutro de confirmación. En ambos casos: si había seña pagada → marcar reembolso pendiente en backoffice. |
| **no_show**      | Profesional / admin marca no_show                                               | Registro para métricas. No reembolso. Posible seguimiento automático.                                                                                                                                                                                                                                         |

**7. Flujos del bot de WhatsApp**

**7.1 Menú principal**

- El bot responde a cualquier mensaje entrante con un menú inicial si no hay sesión activa.

- Opción 1: Información de tratamientos → flujo LLM con RAG sobre base de servicios.

- Opción 2: Agendar turno → flujo de reserva.

- Opción 3: Ver/modificar mi reserva → flujo de consulta por teléfono.

> *⚠ El menú debe poder re-invocarse con palabras clave: 'menu', 'inicio', 'hola', '0'.*

**7.2 Flujo de información (RAG)**

El bot mantiene una knowledge base sincronizada con la tabla services. Cada consulta del usuario se pasa al LLM con el contexto de servicios activos, precios y duraciones. El LLM responde en lenguaje natural, amigable, con el tono de marca VAIG.

- Si el usuario pregunta por un tratamiento específico → precio, duración, preparación.

- Si pregunta por combos o paquetes → el LLM puede sugerir opciones relacionadas.

- Al final de cada respuesta informativa: CTA para agendar.

> *⚠ El LLM no inventa precios. Si el dato no está en la base, responde 'consultá directamente con nosotros'.*

**7.3 Flujo de agendamiento**

| **\#** | **Paso**                       | **Bot dice / hace**                                                                     | **Lógica**                                                                           |
|--------|--------------------------------|-----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| **1**  | **Selección de servicio**      | *Lista de servicios activos con precio y duración.*                                     | Lee tabla services IS_ACTIVE. Presenta máx 10 opciones numeradas.                    |
| **2**  | **Preferencia de profesional** | *'¿Tenés preferencia por alguna profesional? \[Nombres\] o cualquiera disponible'*      | Por defecto ofrece la asignada al servicio. Si solicita otra, valida disponibilidad. |
| **3**  | **Propuesta de horarios**      | *Ofrece hasta 3 slots disponibles priorizando 'horarios adyacentes' a otras reservas.*  | Ver regla de scheduling (sección 7.4).                                               |
| **4**  | **Confirmación de slot**       | *'Perfecto, te reservo el \[fecha\] a las \[hora\] con \[profesional\]. ¿Confirmamos?'* | Valida disponibilidad real antes de confirmar.                                       |
| **5**  | **Captura de datos**           | *Solicita nombre, apellido, email. El teléfono ya está disponible por WA.*              | Valida email con regex. Crea o actualiza registro en clients.                        |
| **6**  | **Creación de reserva**        | *Crea booking con status pending.*                                                      | Genera payload completo. Guarda en Supabase.                                         |
| **7**  | **Instrucciones de pago**      | *Envía CBU / alias / link de MP con monto de seña.*                                     | Template de mensaje configurable desde backoffice.                                   |
| **8**  | **Espera de pago**             | *Opcionalmente: reminder a las Xhs si no pagó.*                                         | Timer configurable. Auto-cancel configurable (default: 24hs).                        |

**7.4 Regla de scheduling inteligente (horarios adyacentes)**

El scheduler sigue esta lógica para proponer horarios:

- Consulta todos los bookings con status != cancelled / no_show para el profesional y día solicitado.

- Calcula los slots adyacentes a reservas existentes: \[inicio_reserva_existente - duración_nuevo_servicio\] y \[fin_reserva_existente\].

- Filtra slots válidos: dentro del horario laboral configurado, sin solapamiento, con buffer configurado entre turnos.

- Si no hay reservas existentes ese día → ofrece slots libres priorizando la mañana o el bloque de mayor demanda (configurable).

- Si el usuario solicita un horario específico → verificar disponibilidad directa, sin restricción de adyacencia.

> *⚠ El backoffice permite configurar por profesional: horario laboral (start/end por día de semana), duración de buffer entre turnos, y slots bloqueados (vacaciones, pausas).*

**7.5 Flujo post-atención**

- El cron corre al cierre del día (configurable, default 22:00 UY).

- Busca todos los bookings con status = realized y survey_sent_at IS NULL.

- Envía mensaje WA con link a formulario de encuesta (Google Forms o formulario propio en Next.js).

- Si el score de la encuesta es \>= umbral configurable (default: 4/5): envía mensaje con invitación a dejar reseña en Google My Business + link directo.

- Si el score es bajo: notificación interna al admin en backoffice (sin enviar al cliente hacia Google).

**8. Backoffice — Funcionalidades**

**8.1 Dashboard**

- Métricas del día: turnos agendados, confirmados, realizados, cancelados, no-shows.

- Métricas de la semana: ocupación por profesional (%), ingresos por seña, tasa de conversión.

- Cola de trabajo prioritaria: reservas con status deposit_paid pendientes de confirmación manual. Badge con contador, ordenadas por fecha de turno. Acción directa 'Confirmar' o 'Cancelar' desde el dashboard sin entrar al detalle.

- Alertas: reservas pending sin pago \> Xhs, confirmaciones pendientes para mañana.

- Ranking de servicios más reservados. Evolución mensual de reservas.

**8.2 Gestión de reservas (CRUD)**

- Vista de agenda: calendario semanal/diario con reservas por profesional.

- Vista de tabla: filtrado por estado, profesional, servicio, rango de fechas.

- Crear reserva manual (cuando la coordinación fue por otro canal).

- Editar: cambiar fecha/hora, profesional, estado, agregar notas internas.

- Cambiar estado: dropdown con transiciones válidas según estado actual.

- Confirmar turno (deposit_paid → confirmed): acción explícita que crea evento GCal y envía WA al cliente. El admin debe haber verificado disponibilidad real antes de confirmar.

- Marcar pago manualmente (para transferencias bancarias).

- Cancelar turno: modal con selección de motivo (professional_unavailable \| location_closed \| client_request \| other) y campo de texto libre. Al confirmar, dispara WA automático según motivo. Si VAIG cancela y había seña pagada: bot ofrece al cliente tres opciones — reagendar (reutiliza la seña), cambiar a otro servicio (ajuste de diferencia si aplica), o reembolso (admin gestiona manualmente, queda pendiente en backoffice).

- Ver historial de estado de cada reserva (audit log).

**8.3 Gestión de servicios (CRUD)**

- Crear / editar / desactivar servicios.

- Campos: nombre, descripción, duración, precio, monto de seña, profesional por defecto, imagen.

- La descripción se usa como contexto para el LLM: texto libre que explica el tratamiento.

- Preview de cómo aparece en el bot.

**8.4 Gestión de profesionales**

- Crear / editar / desactivar profesionales.

- Asignar cuenta Google Calendar (OAuth por profesional).

- Configurar horario laboral por día de semana.

- Bloqueos de agenda (vacaciones, capacitaciones).

**8.5 Gestión de clientes**

- Búsqueda por nombre, teléfono, email.

- Perfil del cliente: historial de reservas, tratamientos realizados, notas, fuente de origen.

- Desde el perfil: enviar mensaje WA manual, agendar turno nuevo.

- Desde el perfil: ver packs activos del cliente — sesiones usadas, restantes, vencimiento.

**8.6 Gestión de paquetes (V1.1)**

- CRUD de service_packages: crear pack, asignar a servicio, definir cantidad de sesiones, precio y si tiene vencimiento.

- Vista de client_packages: qué clientes tienen packs activos, cuántas sesiones quedan, packs vencidos o agotados.

- Ajuste manual de sessions_used (para corregir errores operativos). Requiere nota de auditoría.

- Activar / desactivar packs de la venta online sin eliminarlos (los packs ya vendidos siguen activos).

**8.7 Configuración del sistema**

- Plantillas de mensajes WA (pendiente pago, confirmación, recordatorio, encuesta, reseña Google). El mensaje de pago pendiente incluye CBU/alias como variable configurable.

- Datos de pago: CBU, alias, link de MP, monto mínimo de seña global o por servicio.

- Reglas de scheduling: buffer entre turnos, horarios globales de atención.

- Rate limit del bot: máximo de mensajes por número por ventana de tiempo (default: 30 / 10 min). Configurable por admin.

- Umbral de encuesta positiva para trigger de reseña Google.

- Timer de auto-cancel de reservas pending sin pago.

> *⚠ Sección de configuración global visible solo para rol admin. Profesionales no tienen acceso.*

**9. Features relevados (no estaban en el brief original)**

Durante el análisis se identificaron los siguientes features con alto impacto que no estaban en el spec inicial. Se incluyen con prioridad y scope sugerido.

| **ID**  | **Feature**                                              | **Descripción**                                                                                                                                                                                                                                                                                                                                                                                                                     | **Prioridad** | **Scope** |
|---------|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------|-----------|
| **F01** | **Re-agendamiento por bot**                              | El cliente puede escribir 'cambiar turno' y el bot ofrece alternativas sin cancelar. Reduce cancelaciones y no-shows.                                                                                                                                                                                                                                                                                                               | **P1**        | **V1.1**  |
| **F02** | **Lista de espera**                                      | Si el cliente quiere un horario ocupado, puede anotarse en lista de espera. Si se cancela ese slot, el bot notifica automáticamente.                                                                                                                                                                                                                                                                                                | **P1**        | **V1.1**  |
| **F03** | **Paquetes / sesiones prepagadas**                       | N sesiones del mismo servicio con precio de pack (con descuento). Pago completo por adelantado vía MP con CC (el cliente puede cuotificar en su tarjeta). Cualquier profesional disponible puede atender cada sesión. El sistema descuenta 1 sesión al pasar a 'realizado'. El bot detecta packs activos y los ofrece al agendar. expires_at nullable (sin vencimiento por defecto). Ver sección 5.3 para modelo de datos completo. | **P1**        | **V1.1**  |
| **F04** | **Recordatorio de próxima sesión sugerida**              | Para tratamientos recurrentes (depilación laser), el sistema calcula automáticamente el intervalo óptimo y envía WA sugiriendo el próximo turno.                                                                                                                                                                                                                                                                                    | **P0**        | **MVP**   |
| **F05** | **Cancelación por cliente via bot**                      | El cliente puede cancelar su reserva por WA hasta X horas antes. Si cancela fuera de tiempo, se informa que pierde la seña.                                                                                                                                                                                                                                                                                                         | **P0**        | **MVP**   |
| **F06** | **Historial del cliente en bot**                         | Cliente puede escribir 'mis turnos' y el bot le muestra reservas futuras y últimas realizadas.                                                                                                                                                                                                                                                                                                                                      | **P2**        | **V1.1**  |
| **F07** | **Métricas de conversión del bot**                       | Funnel de conversión: cuántas conversaciones iniciaron flujo de agenda, cuántas completaron datos, cuántas pagaron. Para optimizar el bot.                                                                                                                                                                                                                                                                                          | **P1**        | **V1.1**  |
| **F08** | **Integración con Instagram DM**                         | Mismo bot disponible en Instagram Direct para capturar leads que vienen de IG. Meta Business Suite unifica los canales.                                                                                                                                                                                                                                                                                                             | **P3**        | **V2**    |
| **F09** | **Blacklist / bloqueo de clientes**                      | Backoffice puede marcar un número como bloqueado. El bot no procesa reservas de ese número.                                                                                                                                                                                                                                                                                                                                         | **P2**        | **V1.1**  |
| **F10** | **Modo ausente / fuera de horario**                      | Si el cliente escribe fuera del horario de atención, el bot responde automáticamente indicando el horario y ofreciendo dejar consulta para el día siguiente.                                                                                                                                                                                                                                                                        | **P1**        | **MVP**   |
| **F11** | **Webhook de confirmación de pago MP**                   | Webhook de Mercado Pago confirma automáticamente el pago solo cuando el monto recibido == deposit_amount del servicio y el método es MP. Transferencia bancaria (CBU/alias): el admin confirma manualmente desde el backoffice. Ambos paths coexisten.                                                                                                                                                                              | **P0**        | **MVP**   |
| **F12** | **Audit log de reservas**                                | Historial de todos los cambios de estado de una reserva (quién, cuándo, de qué a qué). Visible en backoffice.                                                                                                                                                                                                                                                                                                                       | **P1**        | **MVP**   |
| **F13** | **Notificación push al admin**                           | El admin recibe notificación (email o WA propio) cuando llega una reserva nueva o se confirma un pago.                                                                                                                                                                                                                                                                                                                              | **P1**        | **MVP**   |
| **F14** | **Multi-sede (future-proof)**                            | location_id nullable en services y professionals. Sin UI multi-sede en MVP. Zero cost de implementación ahora, zero refactoring cuando se abra segunda sede. Sin planes actuales.                                                                                                                                                                                                                                                   | **P2**        | **MVP**   |
| **F15** | **Consentimiento y tratamiento de datos (RNPD Uruguay)** | Flujo de aceptación de términos en el bot. Requerimiento legal Uruguay (RNPD / Ley 18.331).                                                                                                                                                                                                                                                                                                                                         | **P0**        | **MVP**   |

**10. Integración Google Calendar**

- Se crea un evento por reserva cuando pasa a status deposit_paid.

- Formato del evento: VAIG: \[Nombre Apellido\] — \[Servicio\]

- Descripción del evento: Teléfono: \[phone\] \| Profesional: \[nombre\] \| Servicio: \[nombre\] \| Duración: \[X min\]

- El evento se crea en el calendario de la profesional asignada (OAuth por profesional).

- Si la reserva es cancelada: el evento se borra o mueve a 'Cancelado' (configurable).

- Lectura de disponibilidad: el scheduler consulta la API de Google Calendar para verificar que no haya eventos bloqueantes (reuniones, bloqueos manuales).

> *⚠ Cada profesional necesita dar acceso OAuth al sistema. El backoffice tiene una sección de 'Conectar Google Calendar' por profesional.*

**11. Templates de mensajes WhatsApp**

**11.1 Lista de templates requeridos**

| **Trigger**                              | **Template name**        | **Variables dinámicas**                                                                                             |
|------------------------------------------|--------------------------|---------------------------------------------------------------------------------------------------------------------|
| Compra de pack confirmada                | vaig_pack_purchased      | {{nombre}}, {{pack_nombre}}, {{sesiones_total}}, {{link_mp}}                                                        |
| Reserva creada (pending)                 | vaig_booking_pending     | {{nombre}}, {{servicio}}, {{fecha}}, {{hora}}, {{monto_sena}}, {{cbu}}, {{link_mp}}                                 |
| Pago recibido (sin confirmar aún)        | vaig_payment_received    | {{nombre}}, {{servicio}}, {{fecha}}, {{hora}} — informa que el pago fue recibido y que en breve confirman el turno. |
| Turno confirmado por admin               | vaig_booking_confirmed   | {{nombre}}, {{servicio}}, {{fecha}}, {{hora}}, {{profesional}}                                                      |
| Recordatorio 24hs                        | vaig_reminder_24h        | {{nombre}}, {{servicio}}, {{fecha}}, {{hora}}, {{profesional}}                                                      |
| Encuesta post-atención                   | vaig_survey_request      | {{nombre}}, {{link_encuesta}}                                                                                       |
| Invitación reseña Google                 | vaig_google_review       | {{nombre}}, {{link_google}}                                                                                         |
| Sugerencia próxima sesión                | vaig_next_session        | {{nombre}}, {{servicio}}, {{fecha_sugerida}}                                                                        |
| Cancelación por admin (VAIG cancela)     | vaig_cancellation_vaig   | {{nombre}}, {{servicio}}, {{fecha}}, {{motivo_texto}}, {{cta_reagendar}}                                            |
| Cancelación confirmada (cliente canceló) | vaig_cancellation_client | {{nombre}}, {{servicio}}, {{fecha}}                                                                                 |
| Reminder pago pendiente                  | vaig_payment_reminder    | {{nombre}}, {{horas_restantes}}, {{link_mp}}                                                                        |

> *⚠ Los templates de WhatsApp Business deben ser aprobados por Meta antes de poder usarse en mensajes outbound. Tiempo estimado de aprobación: 1-3 días hábiles.*

**12. Scope MVP vs. roadmap**

**12.1 MVP (fase 1)**

- Bot WA: menú, info LLM, flujo de agendamiento completo, captura de datos.

- Scheduling: horarios adyacentes, asignación de profesional, validación Google Calendar.

- Reserva con estado pending → deposit_paid (manual + webhook MP) → evento GCal.

- Recordatorio 24hs + confirmación del cliente.

- Profesional marca como realizado.

- Cron de encuesta + trigger de reseña Google.

- Backoffice: CRUD reservas, CRUD servicios, CRUD profesionales, configuración de templates y pagos.

- Consentimiento RNPD, modo ausente, cancelación por cliente, audit log, notificación al admin.

- Multi-sede ready (solo data model, sin UI multi-sede).

**12.2 V1.1**

- Re-agendamiento por bot.

- Lista de espera.

- Paquetes / sesiones prepagadas (F03): service_packages, client_packages, flujo bot, backoffice de gestión.

- Historial del cliente por bot.

- Métricas de conversión del bot.

- Blacklist de clientes.

**12.3 V2+**

- Integración Instagram DM.

- App móvil para profesionales (PWA o React Native).

- Módulo de fidelización: puntos, descuentos por fidelidad.

- Reportes exportables (CSV, PDF).

- Widget de reservas embebible en website VAIG.

**13. Requerimientos no funcionales**

|                         |                                                                                                                                                                                                                                                                                                              |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Disponibilidad**      | 99.5% uptime. El bot de WA es el canal de ventas principal. Keep-alive cron cada 3 días (Vercel Cron) para evitar pausa por inactividad en Supabase Free tier. Webhook WhatsApp usa patrón acknowledge-then-process (waitUntil) para responder 200 en \< 1s independientemente de latencia de Supabase.      |
| **Latencia bot**        | Respuesta del bot en \< 3 segundos para mensajes simples. Para queries LLM: \< 8 segundos con indicador de 'escribiendo'.                                                                                                                                                                                    |
| **Rate limiting bot**   | Máximo configurable de mensajes por número de teléfono por ventana de tiempo (default: 30 mensajes / 10 minutos). Configurable desde backoffice por admin. Si se supera: bot responde con mensaje de espera, no procesa ni consume API de LLM.                                                               |
| **Seguridad**           | RLS en Supabase por rol (admin vs profesional). Auth obligatorio en backoffice (Supabase Auth). Variables de entorno para keys sensibles. HTTPS everywhere. Webhook WA validado con firma HMAC de Meta. Keep-alive endpoint protegido con CRON_SECRET.                                                       |
| **Permisos backoffice** | Admin: acceso total incluyendo CRUD profesionales y configuración global. Profesional: mismo acceso excepto gestión de profesionales y configuración global. Audit log obligatorio para ambos roles en cambios sobre servicios, precios y señas (edited_by, timestamp, field_changed, old_value, new_value). |
| **Privacidad**          | Sin RNPD formal en esta versión. Datos de clientes nunca expuestos en logs. Retención de datos configurable.                                                                                                                                                                                                 |
| **Escalabilidad**       | El diseño de Supabase + Vercel Edge soporta crecimiento sin reingeniería hasta ~50 reservas/día.                                                                                                                                                                                                             |
| **Observabilidad**      | Logs de cada mensaje WA procesado. Logs de errores de Google Calendar. Dashboard de salud del sistema en backoffice.                                                                                                                                                                                         |

**14. Riesgos y mitigaciones**

| **Riesgo**                                                                     | **Impacto** | **Mitigación**                                                                                                                                         |
|--------------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Meta bloquea la cuenta de WA Business por mensajes de marketing no solicitados | **Alto**    | Usar solo templates aprobados para outbound. No enviar mensajes fuera de la ventana de 24hs sin template aprobado.                                     |
| La profesional no tiene Google Calendar o no quiere conectarlo                 | **Medio**   | El sistema puede funcionar sin GCal para scheduling interno; GCal es solo para el evento de confirmación. Fallback: mostrar advertencia en backoffice. |
| El cliente no paga la seña → reserva queda en pending indefinido               | **Medio**   | Auto-cancel configurable a las 24hs. Reminder intermedio a las Xhs.                                                                                    |
| El LLM da información incorrecta sobre precios                                 | **Alto**    | Instruction tuning estricto: el LLM solo responde con datos de la base. Si no tiene el dato exacto, escala a 'consultá con nosotros'.                  |
| Scope creep en MVP                                                             | **Alto**    | Priorizar P0+P1 features. V1.1 y V2 claramente separados en roadmap.                                                                                   |

**15. Roadmap de implementación (estimado)**

| **Fase**                 | **Duración** | **Entregables**                                                                                            | **Dependencias**                                |
|--------------------------|--------------|------------------------------------------------------------------------------------------------------------|-------------------------------------------------|
| **Fase 0 Setup**         | 1 semana     | Supabase project + schema. Next.js scaffold. WhatsApp Business API aprobado. Google Cloud project + OAuth. | *Alta WA Business API. Cuenta Google Cloud.*    |
| **Fase 1 Core bot**      | 2 semanas    | Webhook WA. Flujo de menú. LLM info handler. Flujo de agendamiento end-to-end. Scheduling básico.          | *Fase 0 completada.*                            |
| **Fase 2 Pagos + GCal**  | 1 semana     | Integración MP webhook. Creación evento GCal. Flujo pending → deposit_paid. Notificación admin.            | *MP cuenta creada. GCal OAuth por profesional.* |
| **Fase 3 Post-atención** | 1 semana     | Recordatorio 24hs. Confirmación cliente. Cron encuestas. Trigger reseña Google.                            | *Templates WA aprobados.*                       |
| **Fase 4 Backoffice**    | 2 semanas    | Dashboard. CRUD reservas. CRUD servicios. CRUD profesionales. Configuración. Audit log.                    | *Supabase RLS config.*                          |
| **Fase 5 QA + deploy**   | 1 semana     | Testing E2E. Seed de datos reales. Deploy a producción. Onboarding equipo VAIG.                            | *Todas las fases anteriores.*                   |

**Total estimado MVP:** 8 semanas. Asume 1 dev full-stack dedicado con conocimiento del stack.

**16. Decisiones cerradas (pregunta 16)**

Las siguientes decisiones estaban abiertas en versiones anteriores del PRD y fueron resueltas:

| **Pregunta**                                   | **Decisión**                                                                                                                                                                                  |
|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **¿Rate limit en el bot?**                     | Sí. Configurable desde backoffice (default: 30 mensajes / 10 min por número). Si se supera, el bot responde con mensaje de espera sin consumir LLM.                                           |
| **¿CBU/alias en mensajes?**                    | Sí. Va como variable en el template vaig_booking_pending. Configurable desde backoffice.                                                                                                      |
| **¿Monto de seña configurable?**               | Sí. deposit_amount por servicio + default global en configuración del sistema.                                                                                                                |
| **¿Profesionales editan servicios y precios?** | Sí. Mismos permisos que admin para CRUD de reservas y servicios. Audit log obligatorio para ambos roles en cambios de servicios, precios y señas.                                             |
| **¿Profesionales pueden crear servicios?**     | Sí. Mismos permisos que admin excepto: no pueden gestionar profesionales ni ver configuración global del sistema.                                                                             |
| **¿Formulario de encuesta interno o externo?** | Google Forms por ahora. Abierto a migrar a formulario propio en Next.js (ventaja: respuestas directo en Supabase, sin integración extra para leer el score).                                  |
| **¿Multi-idioma del bot?**                     | No. Solo español.                                                                                                                                                                             |
| **¿Cancelación con seña pagada?**              | Si VAIG cancela: bot ofrece reagendar (reutiliza seña), cambiar servicio (ajuste de diferencia), o reembolso (manual por admin). Si cliente cancela: pierde la seña (según política de VAIG). |
| **¿RNPD formal?**                              | No en esta versión.                                                                                                                                                                           |

*Fin del documento — VAIG Booking System PRD v1.3*
