import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organisation: defineTable({
    workosOrgId: v.string(),
    name: v.string(),
    userId: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_workosOrgId", ["workosOrgId"]),

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
