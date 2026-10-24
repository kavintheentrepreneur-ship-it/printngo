import { z } from 'zod';

export const PaperTypeSchema = z.enum(['paper', 'chart', 'photo_sheet']);
export const PaperSizeSchema = z.enum(['a4', 'a3', 'a5', 'letter', 'legal']);
export const ColorModeSchema = z.enum(['bw', 'color']);
export const PrintSidesSchema = z.enum(['single', 'duplex']);
export const PagesPerSheetSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const JobOptionsSchema = z.object({
  type: PaperTypeSchema.default('paper'),
  size: PaperSizeSchema.default('a4'),
  color: ColorModeSchema.default('bw'),
  sides: PrintSidesSchema.default('single'),
  pagesPerSheet: PagesPerSheetSchema.default(1),
  pageRange: z.string().default('all'),
  copies: z.number().int().min(1).max(20).default(1),
});

export type JobOptionsInput = z.infer<typeof JobOptionsSchema>;

export const UpdateJobOptionsDto = JobOptionsSchema.partial();
export type UpdateJobOptionsInput = z.infer<typeof UpdateJobOptionsDto>;

export const CreateKioskSessionDto = z.object({
  kioskId: z.string().min(1, 'kioskId is required'),
});

export const StaffLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const StaffPinDto = z.object({
  pin: z.string().min(4).max(8),
});

/**
 * Parses and validates a human-entered page range against a document's total pages.
 * Supports: "all", "", "1-5", "1, 3, 5-7", handles whitespace, removes duplicates, and returns sorted 1-based page indices.
 * Throws a human-readable Error if the range is invalid or out of bounds.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (totalPages <= 0) {
    throw new Error('Total pages in document must be greater than 0');
  }

  const trimmed = rangeStr.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const parts = trimmed.split(',');
  const pageSet = new Set<number>();

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const bounds = part.split('-').map((s) => s.trim());
      if (bounds.length !== 2) {
        throw new Error(`Invalid range format: "${part}"`);
      }
      const start = parseInt(bounds[0] ?? '', 10);
      const end = parseInt(bounds[1] ?? '', 10);

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid page range numbers in "${part}"`);
      }

      const low = Math.min(start, end);
      const high = Math.max(start, end);

      if (low < 1) {
        throw new Error(`Page numbers cannot be less than 1 (found ${low})`);
      }
      if (high > totalPages) {
        throw new Error(
          `This page range does not match your file. The file has ${totalPages} pages, but page ${high} was requested.`,
        );
      }

      for (let p = low; p <= high; p++) {
        pageSet.add(p);
      }
    } else {
      const page = parseInt(part, 10);
      if (isNaN(page)) {
        throw new Error(`Invalid page number: "${part}"`);
      }
      if (page < 1) {
        throw new Error(`Page numbers cannot be less than 1 (found ${page})`);
      }
      if (page > totalPages) {
        throw new Error(
          `This page range does not match your file. The file has ${totalPages} pages, but page ${page} was requested.`,
        );
      }
      pageSet.add(page);
    }
  }

  if (pageSet.size === 0) {
    throw new Error('No valid pages specified in page range');
  }

  return Array.from(pageSet).sort((a, b) => a - b);
}
