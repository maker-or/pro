"use client";

import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			{children}
		</SidebarProvider>
	);
}
