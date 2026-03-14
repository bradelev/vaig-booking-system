# VAIG Booking System

## Stack
- Next.js 14 App Router + TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- WhatsApp Business API (Cloud API Meta)
- Google Calendar API
- Mercado Pago API
- Claude API (claude-sonnet-4) para LLM/RAG
- Vercel (deploy + cron jobs)

## Estructura de carpetas
/app
  /api
    /webhooks/whatsapp    → POST webhook Meta, GET verificación
    /webhooks/mercadopago → POST webhook MP
    /internal/keepalive   → GET cron Supabase keep-alive
  /backoffice             → rutas protegidas del admin
  /login                  → auth
/lib
  /supabase               → client, server, types
  /whatsapp               → send message, templates
  /gcal                   → calendar client, OAuth
  /bot                    → state machine, handlers
  /scheduler              → slot calculation (pure functions)
/actions                  → server actions Next.js

## Reglas críticas de negocio
1. El webhook de WhatsApp responde 200 INMEDIATAMENTE usando waitUntil.
   Nunca procesar síncronamente en el webhook handler.
2. El evento de Google Calendar se crea SOLO cuando status → confirmed
   (acción manual del admin). NO en deposit_paid.
3. La transición deposit_paid → confirmed es SIEMPRE manual del admin.
4. El webhook de MP solo confirma si monto_recibido == deposit_amount
   Y el método de pago es MP. Transferencias: confirmación manual.
5. sessions_used en client_packages se incrementa en 'realized', no en 'confirmed'.
6. Audit log obligatorio en cualquier cambio de services.price,
   services.deposit_amount, services.name, services.duration_minutes.

## Estado de reserva (enum)
pending → deposit_paid → confirmed → realized
                     ↘ cancelled
                     ↘ no_show

## Variables de entorno requeridas
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_TOKEN
WHATSAPP_WEBHOOK_SECRET
WHATSAPP_PHONE_NUMBER_ID
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MERCADOPAGO_ACCESS_TOKEN
ANTHROPIC_API_KEY
CRON_SECRET

## Convenciones
- TypeScript estricto, no usar `any`
- Server Actions para mutaciones del backoffice
- RLS en Supabase para todas las tablas
- Errores siempre logueados con contexto (booking_id, phone, etc.)
- Tests unitarios para /lib/scheduler (lógica pura, sin DB)
```

---

**Primer prompt:**
```
Leé el CLAUDE.md. Vamos a trabajar en la Fase 0 del proyecto.

Tarea: generar todas las migraciones SQL de Supabase para el schema 
completo del sistema. Crear los archivos en /supabase/migrations/ 
con el formato de timestamp de Supabase (YYYYMMDDHHMMSS_nombre.sql).

Las tablas a crear son:
- services
- bookings (con enum de status y campos de cancelación)
- clients
- professionals
- conversation_sessions
- rate_limit_log
- payments
- service_audit_log
- booking_status_log
- service_packages
- client_packages

Incluir:
- Todos los campos del PRD incluyendo location_id NULL en services y professionals
- Enums de PostgreSQL para booking status y cancellation_reason
- Foreign keys con ON DELETE comportamiento apropiado
- Índices en los campos más consultados (phone, status, scheduled_at, professional_id)
- RLS habilitado en todas las tablas (policies vacías por ahora, las completamos después)
- Trigger para updated_at automático en bookings

No crear el scaffold de Next.js todavía. Solo las migraciones SQL.
