// Bot types — shared across bot modules

export type BotConversationState =
  | "idle"
  | "menu"
  | "info_flow"
  | "booking_service"
  | "booking_professional"
  | "booking_date"
  | "booking_slots"
  | "booking_client_name"
  | "booking_client_email"
  | "booking_confirm"
  | "awaiting_payment"
  | "awaiting_reminder_confirm"
  | "pack_service"
  | "pack_selection"
  | "waitlist_offer"
  | "reschedule_confirm"
  | "cancelling"
  | "awaiting_survey_response";

export interface ServiceInfo {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  depositAmount: number;
  defaultProfessionalId: string | null;
}

export interface ProfessionalInfo {
  id: string;
  name: string;
  specialties: string[] | null;
}

export interface SlotOption {
  start: string; // ISO string
  end: string;
  label: string; // e.g. "Lunes 17/03 a las 10:00"
}

export interface BookingFlowContext {
  selectedServiceId?: string;
  selectedServiceName?: string;
  selectedProfessionalId?: string | null; // null = any
  selectedProfessionalName?: string;
  selectedSlot?: SlotOption;
  clientFirstName?: string;
  clientLastName?: string;
  clientEmail?: string;
  clientId?: string; // set if client already exists
  pendingBookingId?: string;
  requestedDateStr?: string; // user-requested date like "mañana" or "viernes"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // allows ephemeral underscore fields (_slots, _requestedSlot, etc.)
}

export interface PackageInfo {
  packageName: string;
  serviceName: string;
  sessionCount: number;
  price: number;
  pricePerSession: number;
}

export interface KnowledgeBase {
  services: ServiceInfo[];
  professionals: ProfessionalInfo[];
  packages: PackageInfo[];
  generatedAt: Date;
}

export interface BotContext {
  knowledge: KnowledgeBase;
  sessionId: string;
  clientPhone: string;
  state: BotConversationState;
  selectedService?: ServiceInfo;
  selectedProfessional?: ProfessionalInfo;
  selectedDate?: Date;
  selectedSlot?: { start: Date; end: Date };
}
