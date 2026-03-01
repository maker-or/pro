"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import { Building2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
	const router = useRouter();
	const { user } = useAuth();
	const createOrgAndAddAdmin = useMutation(api.org.createOrgAndAddAdmin);

	const [orgName, setOrgName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const trimmed = orgName.trim();
		if (!trimmed) return;

		if (!user?.id) {
			setError("Session expired. Please sign in again.");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			await createOrgAndAddAdmin({
				name: trimmed,
				userId: user.id,
			});

			router.push("/");
		} catch (err) {
			console.error("[onboarding] failed to create org:", err);
			setError("Something went wrong. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-6">
			{/* Subtle grid background */}
			<div
				className="pointer-events-none fixed inset-0 opacity-[0.03]"
				style={{
					backgroundImage:
						"linear-gradient(hsl(var(--foreground)/1) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/1) 1px, transparent 1px)",
					backgroundSize: "48px 48px",
				}}
			/>

			<div className="relative w-full max-w-md">
				{/* Header badge */}
				<div className="flex justify-center mb-8">
					<span className="inline-flex items-center gap-2 border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground tracking-widest uppercase">
						<Sparkles className="h-3 w-3" />
						Getting started
					</span>
				</div>

				{/* Card */}
				<div className="border border-border bg-card">
					{/* Card top accent line */}
					<div className="h-px w-full bg-primary" />

					<div className="p-8">
						{/* Icon + heading */}
						<div className="mb-8">
							<div className="flex h-12 w-12 items-center justify-center border border-border bg-muted mb-5">
								<Building2 className="h-5 w-5 text-foreground" />
							</div>
							<h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
								Create your organisation
							</h1>
							<p className="text-sm text-muted-foreground leading-relaxed">
								Give your workspace a name. You can always change it later from
								settings.
							</p>
						</div>

						{/* Form */}
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="space-y-2">
								<Label
									htmlFor="orgName"
									className="text-xs font-medium tracking-widest uppercase text-muted-foreground"
								>
									Organisation name
								</Label>
								<Input
									id="orgName"
									type="text"
									placeholder="Acme Corp"
									value={orgName}
									onChange={(e) => {
										setOrgName(e.target.value);
										if (error) setError(null);
									}}
									disabled={isLoading}
									autoFocus
									autoComplete="organization"
									className="h-11 bg-background border-border focus-visible:ring-0 focus-visible:border-foreground transition-colors text-foreground placeholder:text-muted-foreground/50"
									required
									minLength={2}
									maxLength={80}
								/>
							</div>

							{error && (
								<p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2">
									{error}
								</p>
							)}

							<Button
								type="submit"
								disabled={isLoading || orgName.trim().length < 2}
								className="w-full h-11 font-medium tracking-wide cursor-pointer"
							>
								{isLoading ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Creating workspace…
									</>
								) : (
									<>
										Continue
										<ArrowRight className="h-4 w-4 ml-2" />
									</>
								)}
							</Button>
						</form>
					</div>

					{/* Footer */}
					<div className="border-t border-border px-8 py-4">
						<p className="text-xs text-muted-foreground">
							You will be set as the{" "}
							<span className="text-foreground font-medium">admin</span> of this
							organisation.
						</p>
					</div>
				</div>

				{/* Greeting */}
				{user?.firstName && (
					<p className="text-center text-xs text-muted-foreground mt-6">
						Welcome, {user.firstName}. Let&apos;s get your workspace ready.
					</p>
				)}
			</div>
		</div>
	);
}
