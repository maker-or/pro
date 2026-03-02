import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const addMember = mutation({
  args: {
    orgId: v.id("organisation"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  returns: v.id("organizationMembers"),
  handler: async (ctx, args) => {
    const member = await ctx.db.insert("organizationMembers", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      updatedAt: Date.now(),
    });
    return member;
  },
});

export const getMembershipByUserId = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("organizationMembers"),
      _creationTime: v.number(),
      orgId: v.id("organisation"),
      userId: v.string(),
      role: v.union(v.literal("admin"), v.literal("member")),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    return membership ?? null;
  },
});

/**
 * Step 1 of onboarding: create the Convex org record and immediately add the
 * user as admin. Returns the new Convex org ID so the caller can create the
 * matching WorkOS organisation using that ID as externalId, then patch it back.
 */
export const createOrgAndAddAdmin = mutation({
  args: {
    name: v.string(),
    userId: v.string(),
  },
  returns: v.object({
    orgId: v.id("organisation"),
    memberId: v.id("organizationMembers"),
  }),
  handler: async (ctx, args) => {
    const orgId = await ctx.db.insert("organisation", {
      name: args.name,
      updatedAt: Date.now(),
    });

    const memberId = await ctx.db.insert("organizationMembers", {
      orgId,
      userId: args.userId,
      role: "admin",
      updatedAt: Date.now(),
    });

    return { orgId, memberId };
  },
});

/**
 * Step 2 of onboarding: write the WorkOS organisation ID back onto the Convex
 * org record after the WorkOS org has been created server-side.
 */
export const patchWorkosOrgId = mutation({
  args: {
    orgId: v.id("organisation"),
    workosOrgId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);

    if (!org) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Organisation not found",
      });
    }

    await ctx.db.patch(args.orgId, {
      workosOrgId: args.workosOrgId,
      updatedAt: Date.now(),
    });

    return null;
  },
});
