"use server";

import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type CreateOrgResult =
  | { success: true; orgId: string }
  | { success: false; error: string };

export async function createOrganisationAction(
  userId: string,
  orgName: string,
): Promise<CreateOrgResult> {
  const trimmed = orgName.trim();

  if (!trimmed || trimmed.length < 2) {
    return {
      success: false,
      error: "Organisation name must be at least 2 characters.",
    };
  }

  if (trimmed.length > 80) {
    return {
      success: false,
      error: "Organisation name must be 80 characters or fewer.",
    };
  }

  // ── Step 1: Create the Convex org + add user as admin ──────────────────────
  // We get the Convex-generated ID back, which becomes the externalId in WorkOS.
  let orgId: Id<"organisation">;
  let memberId: Id<"organizationMembers">;

  try {
    const result = await fetchMutation(api.org.createOrgAndAddAdmin, {
      name: trimmed,
      userId,
    });
    orgId = result.orgId;
    memberId = result.memberId;
  } catch (err) {
    console.error("[onboarding] Convex createOrgAndAddAdmin failed:", err);
    return {
      success: false,
      error: "Failed to create your workspace. Please try again.",
    };
  }

  // ── Step 2: Create the matching WorkOS organisation ────────────────────────
  // Use the Convex org ID as the externalId so the two records stay linked.
  let workosOrgId: string;

  try {
    const workos = getWorkOS();
    const workosOrg = await workos.organizations.createOrganization({
      name: trimmed,
      externalId: orgId,
      // domainData is intentionally omitted — domain is optional per the spec.
    });
    workosOrgId = workosOrg.id;
  } catch (err) {
    console.error("[onboarding] WorkOS createOrganization failed:", err);
    // The Convex record exists but WorkOS creation failed.
    // Surface the error — the user can retry; the mutation is idempotent on retry
    // because the Convex record already exists and we'll just re-patch it.
    return {
      success: false,
      error:
        "Failed to register your organisation with the auth provider. Please try again.",
    };
  }
  //---- step-3 : adding the user to the newly created workos org -----
  //
  try {
    const workos = getWorkOS();
    await workos.userManagement.createOrganizationMembership({
      userId,
      organizationId: workosOrgId,
      roleSlug: "admin",
    });
  } catch (err) {
    console.error("[onboarding] createOrganizationMembership failed:", err);
  }
  // ── Step 4: Write the WorkOS org ID back onto the Convex record ────────────
  try {
    await fetchMutation(api.org.patchWorkosOrgId, {
      orgId,
      workosOrgId,
    });
  } catch (err) {
    // Non-fatal: the org + member records exist and are usable. Log and move on.
    console.error("[onboarding] patchWorkosOrgId failed (non-fatal):", err);
  }

  void memberId; // used implicitly via createOrgAndAddAdmin — silence linter

  return { success: true, orgId };
}
