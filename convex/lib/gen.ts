function randomString(bytes: number): string {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	const base64 = btoa(String.fromCharCode(...Array.from(arr)));
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256Hex(text: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(text);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiKey() {
	const publicId = randomString(6);
	const secret = randomString(24);
	const hashsecret = await sha256Hex(secret);

	return {
		key: `sk_live_${publicId}_${secret}`,
		publicId,
		secret,
		hashsecret,
	};
}
export async function checkapiKey(
	storedHash: string,
	rawSecret: string,
): Promise<boolean> {
	const computed = await sha256Hex(rawSecret);
	return computed === storedHash;
}
