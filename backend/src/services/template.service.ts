import { PrismaClient, Template } from '@prisma/client';
import { TemplateData, MappingConfig } from '../types/index.js';

export class TemplateService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async create(data: TemplateData): Promise<Template> {
    return this.prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        strategy: data.strategy,
        mappings: JSON.stringify(data.mappings),
        expectedHeaders: JSON.stringify(data.expectedHeaders),
      },
    });
  }

  async update(id: string, data: Partial<TemplateData>): Promise<Template> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.strategy !== undefined) updateData.strategy = data.strategy;
    if (data.mappings !== undefined) updateData.mappings = JSON.stringify(data.mappings);
    if (data.expectedHeaders !== undefined) {
      updateData.expectedHeaders = JSON.stringify(data.expectedHeaders);
    }

    return this.prisma.template.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.template.delete({
      where: { id },
    });
  }

  async getById(id: string): Promise<Template | null> {
    return this.prisma.template.findUnique({
      where: { id },
    });
  }

  async list(): Promise<Template[]> {
    return this.prisma.template.findMany({
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async incrementUsage(id: string): Promise<void> {
    await this.prisma.template.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  async findMatchingTemplate(headers: string[]): Promise<Template | null> {
    const templates = await this.list();

    let bestMatch: Template | null = null;
    let bestScore = 0;

    for (const template of templates) {
      const expectedHeaders = JSON.parse(template.expectedHeaders) as string[];
      const score = this.calculateMatchScore(expectedHeaders, headers);

      if (score > bestScore && score >= 0.7) {
        bestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  private calculateMatchScore(expected: string[], actual: string[]): number {
    const expectedSet = new Set(expected.map((h) => h.toLowerCase()));
    const actualSet = new Set(actual.map((h) => h.toLowerCase()));

    let matches = 0;
    for (const header of expectedSet) {
      if (actualSet.has(header)) {
        matches++;
      }
    }

    return matches / expectedSet.size;
  }

  async duplicateTemplate(id: string, newName: string): Promise<Template> {
    const original = await this.getById(id);
    if (!original) {
      throw new Error('Template no encontrado');
    }

    return this.prisma.template.create({
      data: {
        name: newName,
        description: original.description,
        strategy: original.strategy,
        mappings: original.mappings,
        expectedHeaders: original.expectedHeaders,
      },
    });
  }

  parseTemplate(template: Template): TemplateData & { id: string; usageCount: number } {
    return {
      id: template.id,
      name: template.name,
      description: template.description || undefined,
      strategy: template.strategy as 'transcode' | 'upload',
      mappings: JSON.parse(template.mappings) as MappingConfig[],
      expectedHeaders: JSON.parse(template.expectedHeaders) as string[],
      usageCount: template.usageCount,
    };
  }
}
