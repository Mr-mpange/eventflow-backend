import { NextFunction, Request, Response } from 'express';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/shared/errors/AppError';

export interface McpRequest extends Request {
  mcpActor?: string;
}

export function authenticateMcp(req: McpRequest, _res: Response, next: NextFunction): void {
  const rawBearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const rawApiKey = req.headers['x-mcp-api-key'] as string | undefined;
  const valid = env.MCP_AUTH_MODE === 'bearer'
    ? Boolean(env.MCP_BEARER_TOKEN && rawBearer === env.MCP_BEARER_TOKEN)
    : Boolean(env.MCP_BEARER_TOKEN && rawApiKey === env.MCP_BEARER_TOKEN);

  if (!valid) {
    next(new UnauthorizedError('Invalid MCP authentication'));
    return;
  }

  req.mcpActor = (req.headers['x-mcp-actor'] as string | undefined) ?? 'sarufi-agent';
  next();
}
