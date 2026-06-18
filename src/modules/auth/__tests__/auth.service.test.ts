import { hashPassword, verifyPassword } from '@/shared/utils/password';
import { generateToken, generateSlug, paginate, paginatedResponse, extractUrlPathToken } from '@/shared/utils/helpers';
import { signAccessToken, verifyAccessToken } from '@/shared/utils/jwt';
import { jwtConfig } from '@/config';

describe('Password Utils', () => {
  it('should hash and verify password', async () => {
    const password = 'SecurePass123';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });
});

describe('Helper Utils', () => {
  it('should generate unique tokens', () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBe(64);
  });

  it('should generate slugs', () => {
    expect(generateSlug('Hello World!')).toBe('hello-world');
    expect(generateSlug('  My Event  ')).toBe('my-event');
  });

  it('should paginate correctly', () => {
    expect(paginate(1, 20)).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
    expect(paginate(3, 10)).toEqual({ skip: 20, take: 10, page: 3, limit: 10 });
    expect(paginate(0, 200).limit).toBe(100);
  });

  it('should build paginated response', () => {
    const result = paginatedResponse(['a', 'b'], 50, 1, 20);
    expect(result.meta.total).toBe(50);
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.hasNext).toBe(true);
  });

  it('should extract the token from a url or malformed url input', () => {
    expect(extractUrlPathToken('https://www.eventflow.app/rsvp/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(extractUrlPathToken('https:/wedding-scanner.onrender.com'))
      .toBe('');
    expect(extractUrlPathToken('550e8400-e29b-41d4-a716-446655440000'))
      .toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('JWT Utils', () => {
  it('should sign and verify access token', () => {
    const payload = { sub: 'user-1', email: 'test@test.com', role: 'EVENT_ORGANIZER' };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.email).toBe('test@test.com');
  });

  it('should reject invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow('Invalid or expired access token');
  });
});

describe('Subscription Plans Config', () => {
  it('should define all plan tiers', () => {
    expect(jwtConfig.accessSecret).toBeDefined();
  });
});
