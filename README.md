# VAIG Booking System

Sistema de reservas end-to-end para **VAIG — Depilación Láser & Estética**. Combina un chatbot conversacional de WhatsApp (con LLM), un motor de scheduling, un backoffice web para el equipo, y automatizaciones post-atención.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend / Backoffice | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| Base de datos | Supabase (PostgreSQL + Auth + RLS) |
| WhatsApp | WhatsApp Business API (Cloud API Meta) |
| LLM / RAG | Claude API (claude-sonnet-4) vía Anthropic SDK |
| Calendario | Google Calendar API (Service Account) |
| Pagos | Mercado Pago (Checkout Pro) + transferencia bancaria |
| Cron jobs | Supabase pg_cron + Vercel Cron |
| Deploy | Vercel |

## Funcionalidades principales

- **Chatbot WhatsApp**: reservas conversacionales, consultas de precios/tratamientos con IA, cancelaciones y reagendamientos
- **Backoffice web**: dashboard, agenda visual (día/4 días/semana/mes), gestión de citas, clientes, servicios, paquetes y profesionales
- **Motor de scheduling**: cálculo de disponibilidad por profesional, soporte de horarios y excepciones (overrides)
- **Pagos**: generación automática de links Mercado Pago, confirmación manual de transferencias bancarias
- **Automatizaciones**: recordatorios 24h, encuestas post-atención, sugerencia de próxima sesión, cancelación automática por falta de pago
- **Campañas**: envío masivo de mensajes WhatsApp con templates y segmentación de clientes
- **Métricas**: funnel de conversión, actividad diaria, segmentación de clientes (S1-S5)
- **Integración Google Calendar**: sincronización bidireccional de eventos
- **Importación**: soporte para importar desde Google Calendar y Koobing

## Estructura del proyecto

```
src/
├── actions/          # Server Actions (mutaciones del backoffice)
├── app/
│   ├── api/
│   │   ├── internal/     # Endpoints internos (cron jobs)
│   │   ├── sesiones/     # Export de sesiones (Excel)
│   │   └── webhooks/     # WhatsApp y Mercado Pago
│   ├── backoffice/       # Páginas protegidas del admin
│   └── login/            # Autenticación
├── components/
│   └── backoffice/       # Componentes UI del backoffice
└── lib/
    ├── bot/              # Motor del chatbot (state machine + LLM)
    ├── campaigns/        # Procesador de campañas masivas
    ├── gcal/             # Google Calendar client
    ├── koobing/          # Importación desde Koobing
    ├── payments/         # Mercado Pago client
    ├── scheduler/        # Motor de disponibilidad (lógica pura)
    ├── supabase/         # Clientes Supabase (server, admin, middleware)
    └── whatsapp/         # WhatsApp Business API client
supabase/
└── migrations/           # Migraciones SQL (40+)
scripts/                  # Scripts de importación y migración
docs/                     # PRD y documentación interna
```

## Requisitos previos

- Node.js 20+
- Cuenta de Supabase con proyecto configurado
- WhatsApp Business API (Meta Cloud API)
- Google Cloud Service Account con Calendar API habilitada
- Cuenta Mercado Pago (opcional)
- API Key de Anthropic (para el chatbot con IA)

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/bradelev/vaig-booking-system.git
cd vaig-booking-system

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Ejecutar migraciones en Supabase
npx supabase db push

# Iniciar en desarrollo
npm run dev
```

## Variables de entorno

Ver `.env.example` para la lista completa. Las principales son:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server-side) |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso de WhatsApp Business API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp |
| `WHATSAPP_APP_SECRET` | Secret de la app Meta (verificación de webhooks) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email de la Service Account de Google |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Clave privada de la Service Account |
| `GOOGLE_CALENDAR_ID` | ID del calendario de Google |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acceso de Mercado Pago |
| `ANTHROPIC_API_KEY` | API Key de Anthropic (Claude) |
| `CRON_SECRET` | Secret compartido para los cron jobs internos |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (para callbacks) |

## Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
npm run start     # Servidor de producción
npm run lint      # Linter (ESLint)
npm run test      # Tests unitarios
```

## Flujo de estados de una reserva

```
pending → deposit_paid → confirmed → realized
                     ↘ cancelled
                     ↘ no_show
```

- **pending**: reserva creada, esperando pago de seña
- **deposit_paid**: seña pagada (MP automático o transferencia confirmada manualmente)
- **confirmed**: confirmada por el admin (se crea evento en Google Calendar)
- **realized**: servicio realizado (se incrementa contador de sesiones en paquetes)
- **cancelled**: cancelada (se elimina evento de Google Calendar, se notifica al cliente)
- **no_show**: el cliente no se presentó

## Reglas de negocio clave

1. El webhook de WhatsApp responde `200` inmediatamente y procesa en background
2. El evento de Google Calendar se crea solo cuando el status pasa a `confirmed`
3. La transición `deposit_paid → confirmed` es siempre manual del admin
4. El webhook de Mercado Pago confirma solo si el monto recibido coincide con `deposit_amount`
5. `sessions_used` en paquetes se incrementa en `realized`, no en `confirmed`

## Deploy

La app está diseñada para deployar en **Vercel**. Los cron jobs se gestionan con `pg_cron` en Supabase, que llama a los endpoints `/api/internal/*` protegidos por `CRON_SECRET`.

## Licencia

Privado — Todos los derechos reservados.
