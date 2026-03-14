// Bot types — shared across bot modules

export type BotConversationState =
  | "idle"
  | "greeting"
  | "selecting_service"
  | "selecting_professional"
  | "selecting_date"
  | "selecting_time"
  | "confirming"
  | "awaiting_payment"
  | "confirmed"
  | "cancelled";

export interface ServiceInfo {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  depositAmount: number;
}

export interface ProfessionalInfo {
  id: string;
  name: string;
  specialties: string[] | null;
}

export interface KnowledgeBase {
  services: ServiceInfo[];
  professionals: ProfessionalInfo[];
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
