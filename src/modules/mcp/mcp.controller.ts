import { NextFunction, Response } from 'express';
import { McpRequest } from './mcp.auth';
import { McpService } from './mcp.service';
import { McpToolName } from './mcp.types';

export class McpController {
  constructor(private readonly mcpService: McpService) {}

  execute = async (req: McpRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const toolName = (req.params.toolName
        ?? req.path.split('/').filter(Boolean).at(-1)) as McpToolName;
      const data = await this.mcpService.execute(toolName, req.body, {
        actor: req.mcpActor ?? 'sarufi-agent',
        requestId: req.headers['x-request-id'] as string | undefined,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}
