import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createOrg = mutation({
	args: {
		name: v.string(),
	},
	returns: v.id("organisation"),
	handler: async (ctx, args) => {
		const org = await ctx.db.insert("organisation", {
			name: args.name,
			updatedAt: Date.now(),
		});
		return org;
	},
});

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
