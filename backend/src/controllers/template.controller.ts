import { Request, Response } from 'express';
import { TemplateService } from '../services/template.service.js';
import { PrismaClient } from '@prisma/client';
import { TemplateData } from '../types/index.js';

const prisma = new PrismaClient();
const templateService = new TemplateService(prisma);

export class TemplateController {
  // GET /api/templates
  static async list(req: Request, res: Response) {
    const templates = await templateService.list();
    const parsed = templates.map((t) => templateService.parseTemplate(t));
    res.json(parsed);
  }

  // GET /api/templates/:id
  static async getById(req: Request, res: Response) {
    const { id } = req.params;
    const template = await templateService.getById(id);

    if (!template) {
      return res.status(404).json({ error: 'Template no encontrado' });
    }

    res.json(templateService.parseTemplate(template));
  }

  // POST /api/templates
  static async create(req: Request, res: Response) {
    const data = req.body as TemplateData;

    if (!data.name || !data.strategy || !data.mappings) {
      return res.status(400).json({ error: 'Nombre, estrategia y mappings son requeridos' });
    }

    // Extraer headers esperados de los mappings
    if (!data.expectedHeaders) {
      data.expectedHeaders = data.mappings.map((m) => m.field);
    }

    const template = await templateService.create(data);
    res.status(201).json(templateService.parseTemplate(template));
  }

  // PUT /api/templates/:id
  static async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body as Partial<TemplateData>;

    const template = await templateService.update(id, data);
    res.json(templateService.parseTemplate(template));
  }

  // DELETE /api/templates/:id
  static async delete(req: Request, res: Response) {
    const { id } = req.params;
    await templateService.delete(id);
    res.status(204).send();
  }

  // POST /api/templates/:id/duplicate
  static async duplicate(req: Request, res: Response) {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nombre para el duplicado es requerido' });
    }

    const template = await templateService.duplicateTemplate(id, name);
    res.status(201).json(templateService.parseTemplate(template));
  }

  // POST /api/templates/detect
  static async detectTemplate(req: Request, res: Response) {
    const { headers } = req.body as { headers: string[] };

    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'Headers son requeridos' });
    }

    const template = await templateService.findMatchingTemplate(headers);

    if (!template) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      template: templateService.parseTemplate(template),
    });
  }
}
