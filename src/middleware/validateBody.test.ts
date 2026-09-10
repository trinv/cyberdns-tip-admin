import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import {
  parseBody,
  aclSchema,
  bulkProposeSchema,
  createCategorySchema,
  createDnsNodeSchema,
  createFeedSourceSchema,
  createUserSchema,
  updateDnsNodeSchema,
  updateUserSchema,
} from './validateBody.ts';

function run(mw: ReturnType<typeof parseBody>, body: unknown) {
  const req = { body } as Request;
  let statusCode = 200;
  let payload: any;
  const res = {
    status(c: number) {
      statusCode = c;
      return this;
    },
    json(p: any) {
      payload = p;
      return this;
    },
  } as unknown as Response;
  let nexted = false;
  mw(req, res, () => {
    nexted = true;
  });
  return { statusCode, payload, nexted, body: req.body };
}

describe('parseBody', () => {
  it('passes a valid body through, replacing it with the parsed value', () => {
    const r = run(parseBody(createUserSchema), { email: '  A@X.COM ', password: 'hunter2!!' });
    expect(r.nexted).toBe(true);
    expect(r.statusCode).toBe(200);
    // z.email() does not lowercase, but .trim() applies
    expect(r.body.email).toBe('A@X.COM');
  });

  it('rejects an invalid body with 400 + field details, no next()', () => {
    const r = run(parseBody(createUserSchema), { email: 'not-an-email', password: 'short' });
    expect(r.nexted).toBe(false);
    expect(r.statusCode).toBe(400);
    expect(r.payload.details.map((d: any) => d.field).sort()).toEqual(['email', 'password']);
  });
});

describe('createUserSchema', () => {
  it('accepts a known role, rejects an unknown one', () => {
    expect(
      createUserSchema.safeParse({ email: 'a@b.co', password: '12345678', role: 'Reviewer' }).success,
    ).toBe(true);
    expect(createUserSchema.safeParse({ email: 'a@b.co', password: '12345678', role: 'root' }).success).toBe(
      false,
    );
  });
});

describe('updateUserSchema', () => {
  it('requires at least one field', () => {
    expect(updateUserSchema.safeParse({}).success).toBe(false);
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});

describe('createDnsNodeSchema', () => {
  const base = { name: 'edge-01', ipAddress: '203.0.113.9' };
  it('accepts a valid node', () => {
    expect(createDnsNodeSchema.safeParse(base).success).toBe(true);
  });
  it('requires at least one address', () => {
    expect(createDnsNodeSchema.safeParse({ name: 'edge-01' }).success).toBe(false);
  });
  it('rejects a bad tier and out-of-range coordinates', () => {
    expect(createDnsNodeSchema.safeParse({ ...base, tier: 'ULTRA' }).success).toBe(false);
    expect(createDnsNodeSchema.safeParse({ ...base, latitude: 120 }).success).toBe(false);
    expect(createDnsNodeSchema.safeParse({ ...base, longitude: -181 }).success).toBe(false);
  });
  it('coerces empty optional strings to null', () => {
    const p = createDnsNodeSchema.parse({ ...base, notes: '', provider: '   ' });
    expect(p.notes).toBeNull();
    expect(p.provider).toBeNull();
  });
});

describe('updateDnsNodeSchema', () => {
  it('accepts a status-only patch, rejects an empty one', () => {
    expect(updateDnsNodeSchema.safeParse({ status: 'inactive' }).success).toBe(true);
    expect(updateDnsNodeSchema.safeParse({}).success).toBe(false);
    expect(updateDnsNodeSchema.safeParse({ status: 'paused' }).success).toBe(false);
  });
});

describe('createCategorySchema', () => {
  it('normalizes color and bounds deltaThreshold', () => {
    expect(createCategorySchema.parse({ name: 'Malware', color: '10b981' }).color).toBe('#10b981');
    expect(createCategorySchema.safeParse({ name: 'x', deltaThreshold: 0 }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'x', deltaThreshold: 2.5 }).success).toBe(false);
  });
});

describe('createFeedSourceSchema', () => {
  it('accepts http(s) URLs only', () => {
    expect(
      createFeedSourceSchema.safeParse({ name: 'oisd', url: 'https://big.oisd.nl', category: 'ads' }).success,
    ).toBe(true);
    expect(
      createFeedSourceSchema.safeParse({ name: 'x', url: 'ftp://x.test/f', category: 'ads' }).success,
    ).toBe(false);
    expect(createFeedSourceSchema.safeParse({ name: 'x', url: 'not a url', category: 'ads' }).success).toBe(
      false,
    );
  });
});

describe('aclSchema / bulkProposeSchema', () => {
  it('acl requires a boolean', () => {
    expect(aclSchema.safeParse({ enforceEnabled: true }).success).toBe(true);
    expect(aclSchema.safeParse({ enforceEnabled: 'yes' }).success).toBe(false);
  });
  it('bulk-propose needs a non-empty domains + categories array', () => {
    expect(bulkProposeSchema.safeParse({ domains: ['a.com'], categories: ['ads'] }).success).toBe(true);
    expect(bulkProposeSchema.safeParse({ domains: [], categories: ['ads'] }).success).toBe(false);
    expect(bulkProposeSchema.safeParse({ domains: ['a.com'], categories: [] }).success).toBe(false);
  });
});
