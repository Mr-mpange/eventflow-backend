export type McpToolName =
  | 'getGuestContext'
  | 'getEventDetails'
  | 'getGuestBalance'
  | 'updateRSVP'
  | 'createPaymentRequest'
  | 'checkPaymentStatus'
  | 'recordPledge'
  | 'sendInvitationCard'
  | 'issueTicket'
  | 'sendPaymentReminder'
  | 'verifyQRCode'
  | 'getEventAnalytics'
  | 'handoffToOrganizer';

export interface McpExecutionContext {
  actor: string;
  requestId?: string;
}
