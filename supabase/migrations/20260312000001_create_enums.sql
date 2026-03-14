-- Enums for VAIG Booking System

CREATE TYPE booking_status AS ENUM (
  'pending',
  'deposit_paid',
  'confirmed',
  'realized',
  'cancelled',
  'no_show'
);

CREATE TYPE cancellation_reason AS ENUM (
  'professional_unavailable',
  'location_closed',
  'client_request',
  'other'
);

CREATE TYPE cancelled_by_type AS ENUM (
  'admin',
  'client'
);
