import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	organisation: defineTable({
		name: v.string(),
		updatedAt: v.number(),
	}),

	organizationMembers: defineTable({
		orgId: v.id("organisation"),
		userId: v.string(),
		role: v.union(v.literal("admin"), v.literal("member")),
		updatedAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_orgId_userId", ["orgId", "userId"]),

	secretkey: defineTable({
		orgId: v.optional(v.id("organisation")),
		userId: v.string(),
		name: v.string(),
		prefix: v.string(),
		hashedKey: v.string(),
		publicId: v.string(),
		revokedAt: v.optional(v.number()),
	})
		.index("by_publicId", ["publicId"])
		.index("by_userId", ["userId"]),
});
