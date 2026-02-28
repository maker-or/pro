import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { checkapiKey, createApiKey } from "./lib/gen";

export const genrateKey = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const userId = identity.subject;

    // Try to find the user's organisation
    const org = await ctx.db
      .query("organisation")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const { key, publicId, hashsecret } = await createApiKey();

    await ctx.db.insert("secretkey", {
      orgId: org?._id,
      userId,
      name: args.name,
      prefix: "sk_live_",
      hashedKey: hashsecret,
      publicId,
    });

    return {
      publicId,
      fullKey: key,
    };
  },
});

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const keys = await ctx.db
      .query("secretkey")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    return keys
      .filter((k) => !k.revokedAt)
      .map((k) => ({
        _id: k._id,
        name: k.name,
        publicId: k.publicId,
        prefix: k.prefix,
        createdAt: k._creationTime,
      }));
  },
});

export const publicaction = httpAction(async (ctx, request) => {
  const payload = await request.json();

  // Extract publicId from the full API key token.
  // Token format: sk_live_{publicId}_{secret}
  // publicId sits between the 2nd and 3rd underscore (index 2 after split).
  const rawToken: string = payload.token ?? "";
  const parts = rawToken.split("_");
  const publicId = parts.length >= 3 ? parts[2] : rawToken;
  const hashedKey = parts.length >= 4 ? parts[3] : "";

  const response = await ctx.runQuery(internal.secert.verifyApiKey, {
    token: publicId,
    hashedKey: hashedKey,
  });

  return new Response(JSON.stringify(response), {
    status: response.valid ? 200 : 401,
    headers: { "content-type": "application/json" },
  });
});

export const verifyApiKey = internalQuery({
  args: {
    token: v.string(),
    hashedKey: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("secretkey")
      .withIndex("by_publicId", (q) => q.eq("publicId", args.token))
      .first();

    if (!key) return { valid: false };

    const isValid = await checkapiKey(key.hashedKey, args.hashedKey);

    return { valid: isValid };
  },
});

export const deleteApiKey = mutation({
  args: {
    keyId: v.id("secretkey"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("Key not found");
    if (key.userId !== identity.subject) throw new Error("Unauthorized");

    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
  },
});
