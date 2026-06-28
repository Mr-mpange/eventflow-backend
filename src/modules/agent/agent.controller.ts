import { NextFunction, Request, Response } from 'express';
import { AgentService } from './agent.service';
import { SarufiRequest } from '@modules/sarufi/sarufi.types';

export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  message = async (req: SarufiRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.agentService.handleMessage(req.body, req.sarufiContext);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}
