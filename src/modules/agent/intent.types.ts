export const AGENT_INTENTS = [
  'GREETING',
  'EVENT_INFO',
  'RSVP_YES',
  'RSVP_NO',
  'PAY_FULL',
  'PAY_PARTIAL',
  'CHECK_BALANCE',
  'MAKE_PLEDGE',
  'REQUEST_INVITE_CARD',
  'REQUEST_TICKET',
  'PAYMENT_STATUS',
  'HUMAN_SUPPORT',
] as const;

export type AgentIntentName = (typeof AGENT_INTENTS)[number];
