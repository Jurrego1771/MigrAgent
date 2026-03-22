import { TransformationRule } from '../types/index.js';

export class TransformationEngine {
  /**
   * Aplica todas las reglas habilitadas a una fila CSV.
   * Devuelve una nueva fila con los valores transformados.
   */
  applyRules(
    row: Record<string, string>,
    rules: TransformationRule[]
  ): Record<string, string> {
    const result = { ...row };

    for (const rule of rules) {
      if (!rule.enabled) continue;
      const current = result[rule.field];
      if (current === undefined) continue;

      result[rule.field] = this.applyRule(current, rule);
    }

    return result;
  }

  private applyRule(value: string, rule: TransformationRule): string {
    switch (rule.type) {
      case 'trim':
        return value.trim();

      case 'uppercase':
        return value.toUpperCase();

      case 'lowercase':
        return value.toLowerCase();

      case 'replace': {
        if (!rule.find) return value;
        return value.split(rule.find).join(rule.replace ?? '');
      }

      case 'regex': {
        if (!rule.find) return value;
        try {
          const re = new RegExp(rule.find, 'g');
          return value.replace(re, rule.replace ?? '');
        } catch {
          return value; // regex inválida → sin cambio
        }
      }

      case 'prefix':
        return (rule.value ?? '') + value;

      case 'suffix':
        return value + (rule.value ?? '');

      case 'default':
        return value.trim() === '' ? (rule.value ?? '') : value;

      case 'truncate': {
        const max = parseInt(rule.value ?? '255', 10);
        return isNaN(max) ? value : value.substring(0, max);
      }

      case 'map_value': {
        if (!rule.mappingTable) return value;
        return rule.mappingTable[value] ?? value;
      }

      default:
        return value;
    }
  }

  /**
   * Preview: aplica reglas a un conjunto de filas de muestra.
   * Devuelve pares { original, transformed } por campo afectado.
   */
  previewRules(
    sampleRows: Record<string, string>[],
    rules: TransformationRule[]
  ): Array<{ row: number; field: string; original: string; transformed: string }> {
    const preview: Array<{ row: number; field: string; original: string; transformed: string }> = [];

    for (let i = 0; i < sampleRows.length; i++) {
      const row = sampleRows[i];
      const transformed = this.applyRules(row, rules);

      for (const rule of rules) {
        if (!rule.enabled) continue;
        const orig = row[rule.field] ?? '';
        const trans = transformed[rule.field] ?? '';
        if (orig !== trans) {
          preview.push({ row: i + 2, field: rule.field, original: orig, transformed: trans });
        }
      }
    }

    return preview;
  }
}
