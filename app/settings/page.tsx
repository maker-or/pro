"use client";

import { Authenticated } from "convex/react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
	return (
		<Authenticated>
			<AuthenticatedLayout>
				<SidebarInset>
					<header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
						<SidebarTrigger className="cursor-pointer" />
						<h1 className="text-lg font-medium">Settings</h1>
					</header>
					<main className="flex-1 p-6">
						<Card className="max-w-4xl">
							<CardHeader>
								<CardTitle>Settings</CardTitle>
								<CardDescription>
									Manage your account settings and preferences.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Settings page coming soon...
								</p>
							</CardContent>
						</Card>
					</main>
				</SidebarInset>
			</AuthenticatedLayout>
		</Authenticated>
	);
}
