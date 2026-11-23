import type React from 'react';
import type { TableColor } from '../types';

export interface TableColorOption {
  key: TableColor;
  label: string;
  hex: string;
}

/**
 * Paleta de identificación de mesas. El orden se usa para asignar un color
 * distinto a cada mesa nueva antes de repetir.
 */
export const TABLE_COLORS: TableColorOption[] = [
  { key: 'blue', label: 'Azul', hex: '#3b82f6' },
  { key: 'violet', label: 'Violeta', hex: '#8b5cf6' },
  { key: 'amber', label: 'Ámbar', hex: '#f59e0b' },
  { key: 'sky', label: 'Celeste', hex: '#0ea5e9' },
  { key: 'pink', label: 'Rosa', hex: '#ec4899' },
  { key: 'lime', label: 'Lima', hex: '#84cc16' },
  { key: 'orange', label: 'Naranja', hex: '#f97316' },
  { key: 'teal', label: 'Turquesa', hex: '#14b8a6' },
  { key: 'indigo', label: 'Índigo', hex: '#6366f1' },
  { key: 'fuchsia', label: 'Fucsia', hex: '#d946ef' },
];

const DEFAULT_COLOR = TABLE_COLORS[0];

export function getTableColor(value?: string | null): TableColorOption {
  return TABLE_COLORS.find((option) => option.key === value) ?? DEFAULT_COLOR;
}

export function tableColorStyle(value?: string | null): React.CSSProperties {
  return { '--table-color': getTableColor(value).hex } as React.CSSProperties;
}

export function suggestTableColor(tables: Array<{ color?: string | null }>): TableColor {
  const used = new Set<TableColor>();
  for (const table of tables) {
    const option = TABLE_COLORS.find((item) => item.key === table.color);
    if (option) used.add(option.key);
  }
  return TABLE_COLORS.find((option) => !used.has(option.key))?.key ?? DEFAULT_COLOR.key;
}
