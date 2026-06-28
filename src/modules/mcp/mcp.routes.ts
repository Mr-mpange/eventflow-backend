import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { agentRateLimiter } from '@/middleware/rateLimiter';
import { mcpController } from '@/shared/container';
import { authenticateMcp } from './mcp.auth';
import { mcpToolSchemas } from './mcp.tools';

const router = Router();

router.use(agentRateLimiter);
router.use(authenticateMcp);

for (const [toolName, schema] of Object.entries(mcpToolSchemas)) {
  router.post(`/tools/${toolName}`, validate(schema), mcpController.execute);
}

export default router;
