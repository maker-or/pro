import { handleAuth } from "@workos-inc/authkit-nextjs";

export const GET = handleAuth({
  onSuccess: async ({
    user,
    oauthTokens,
    authenticationMethod,
    organizationId,
    state,
  }) => {
    console.log("the user", user);
    console.log("the oauthTokens", oauthTokens);
    console.log("the authenticationMethod", authenticationMethod);
    console.log("the organizationId", organizationId);
    console.log("the state", state);
  },
});
