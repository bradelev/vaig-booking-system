// Bot module — entry point
export { buildKnowledgeBase, formatKnowledgeForLLM, clearKnowledgeCache } from "./knowledge";
export { handleIncomingMessage } from "./engine";
export type { BotContext, BotConversationState, KnowledgeBase, ServiceInfo, ProfessionalInfo } from "./types";
