import { randomBytes } from 'crypto';

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function paginate(page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

export function extractUrlPathToken(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  const candidate = raw.replace(/\\+/g, '/');

  try {
    const url = new URL(candidate);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) return segments.at(-1) ?? '';
    return '';
  } catch {
    const cleaned = candidate
      .replace(/^https?:\/+/i, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

    if (!cleaned) return '';
    const segments = cleaned.split('/').filter(Boolean);
    return segments.at(-1) ?? cleaned;
  }
}
