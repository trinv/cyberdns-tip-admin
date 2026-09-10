import type { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';
import { VALID_ROLES } from '../db/roles.ts';

// Request-body validation at the API boundary. Before this, most mutation
// routes destructured req.body and forwarded it straight to a query function
// with no type/range/enum checks — a bad `tier`, an out-of-range `latitude`,
// a 10 MB `name`, `deltaThreshold: "abc"` all went through, and shape errors
// surfaced as opaque 500s instead of a 400 (DEBT-06).
//
// parseBody(schema) validates, replaces req.body with the parsed (coerced,
// stripped) value, and short-circuits with 400 + field-level details on
// failure. Deeper domain checks that need the DB (does this category id
// exist? is this IP already registered?) stay in the query layer.

export function parseBody<S extends ZodType>(schema: S) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({
        error: 'Dữ liệu gửi lên không hợp lệ.',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(body)',
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

// ---- shared field helpers ----
const shortText = (max = 200) => z.string().trim().min(1).max(max);
// Optional free-text: absent key stays `undefined` (so an empty PATCH body
// is caught by the "at least one field" refine and never nulls a column);
// an explicitly-sent "" / whitespace collapses to null.
const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
const emailField = z.string().trim().pipe(z.email().max(320));
// Stored column is varchar(20); accept "#rrggbb" (with or without the hash).
const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'Màu phải ở dạng hex #rrggbb')
  .transform((v) => (v.startsWith('#') ? v : `#${v}`));

// net.isIPv4/isIPv6 formatting + the "at least one address" rule are enforced
// (with friendly Vietnamese errors) in createDnsNode/updateDnsNode — here we
// only guard the coarse shape.
const ipField = z.string().trim().min(1).max(64);

const NODE_TIERS = ['LITE', 'PRO', 'FAMILY'] as const;
const NODE_STATUSES = ['active', 'inactive'] as const;

// ---- users ----
export const createUserSchema = z.object({
  email: emailField,
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(200),
  displayName: optionalText(200),
  role: z.enum(VALID_ROLES).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(VALID_ROLES).optional(),
    isActive: z.boolean().optional(),
    displayName: optionalText(200),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });

// ---- DNS nodes ----
const dnsNodeBase = {
  name: shortText(200),
  hostname: optionalText(253),
  ipAddress: ipField.nullish(),
  ipv6Address: ipField.nullish(),
  tier: z.enum(NODE_TIERS).optional(),
  location: optionalText(200),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  provider: optionalText(200),
  status: z.enum(NODE_STATUSES).optional(),
  notes: optionalText(2000),
};

export const createDnsNodeSchema = z
  .object(dnsNodeBase)
  .refine((v) => Boolean(v.ipAddress || v.ipv6Address), {
    message: 'Cần ít nhất 1 địa chỉ IP (IPv4 hoặc IPv6).',
    path: ['ipAddress'],
  });

export const updateDnsNodeSchema = z
  .object({
    ...dnsNodeBase,
    name: shortText(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });

// ---- categories ----
export const createCategorySchema = z.object({
  name: shortText(120),
  description: optionalText(2000),
  color: hexColor.optional(),
  deltaThreshold: z.number().int().min(1).max(100_000).optional(),
});

export const updateCategorySchema = z
  .object({
    name: shortText(120).optional(),
    description: optionalText(2000),
    color: hexColor.optional(),
    deltaThreshold: z.number().int().min(1).max(100_000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });

// ---- feed sources ----
export const createFeedSourceSchema = z.object({
  name: shortText(200),
  // Deeper scheme + SSRF checks are in assertPublicFeedUrl / safeFeedFetch.
  url: z.url({ protocol: /^https?$/ }).max(2000),
  category: shortText(100),
  syncInterval: z.string().trim().max(50).optional(),
  color: hexColor.optional(),
  isCustom: z.boolean().optional(),
});

// ---- blocklist ACL ----
export const aclSchema = z.object({ enforceEnabled: z.boolean() });

// ---- domain propose ----
const domainToken = z.string().trim().min(1).max(512);
export const proposeDomainSchema = z.object({
  domain: domainToken,
  categories: z.array(shortText(100)).min(1),
  reason: z.string().trim().max(2000).optional(),
});

export const bulkProposeSchema = z.object({
  domains: z.array(domainToken).min(1).max(500_000),
  categories: z.array(shortText(100)).min(1),
  reason: z.string().trim().max(2000).optional(),
});
