'use client';

import { Authenticated, Unauthenticated } from 'convex/react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Key, Shield, Zap, Code } from 'lucide-react';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedLayout>
          <SidebarInset>
            <header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
              <SidebarTrigger className="cursor-pointer" />
              <h1 className="text-lg font-medium">Home</h1>
              {user && (
                <div className="ml-auto">
                  <Button variant="outline" onClick={() => signOut()} className="cursor-pointer">
                    Sign out
                  </Button>
                </div>
              )}
            </header>
            <main className="flex-1 p-6">
              <div className="max-w-4xl">
                <h2 className="text-2xl font-bold mb-4">Welcome back, {user?.firstName || 'User'}!</h2>
                <p className="text-muted-foreground">
                  Manage your API keys from the sidebar. Navigate to API Keys to create and manage your keys.
                </p>
              </div>
            </main>
          </SidebarInset>
        </AuthenticatedLayout>
      </Authenticated>
    </>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center items-center bg-sidebar p-12">
        <div className="max-w-md">
          <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <rect x="50" y="50" width="300" height="200" rx="12" className="fill-card stroke-border" strokeWidth="2" />
            <rect x="70" y="80" width="260" height="40" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
            <rect x="90" y="95" width="180" height="10" rx="2" className="fill-foreground/20" />
            <rect x="280" y="95" width="30" height="10" rx="2" className="fill-primary" />
            <rect x="70" y="140" width="120" height="90" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
            <rect x="200" y="140" width="130" height="90" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
            <rect x="85" y="155" width="80" height="8" rx="2" className="fill-foreground/30" />
            <rect x="85" y="170" width="60" height="6" rx="1" className="fill-foreground/20" />
            <rect x="85" y="185" width="70" height="6" rx="1" className="fill-foreground/20" />
            <rect x="85" y="200" width="90" height="20" rx="4" className="fill-primary" />
            <rect x="215" y="155" width="100" height="8" rx="2" className="fill-foreground/30" />
            <rect x="215" y="170" width="80" height="6" rx="1" className="fill-foreground/20" />
            <rect x="215" y="185" width="90" height="6" rx="1" className="fill-foreground/20" />
            <circle cx="265" cy="210" r="15" className="fill-primary" />
            <path
              d="M258 210 L263 215 L273 205"
              className="stroke-primary-foreground"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="120" y="20" width="40" height="40" rx="8" className="fill-primary/20" />
            <Key className="w-5 h-5 text-primary" style={{ transform: 'translate(132px, 32px)' }} />
            <rect x="240" y="20" width="40" height="40" rx="8" className="fill-primary/20" />
            <Shield className="w-5 h-5 text-primary" style={{ transform: 'translate(252px, 32px)' }} />
          </svg>
          <div className="mt-12 space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">API Key Management</h3>
                <p className="text-sm text-muted-foreground">
                  Generate and manage secure API keys for your applications
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Secure Authentication</h3>
                <p className="text-sm text-muted-foreground">Enterprise-grade security with WorkOS authentication</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">Powered by Convex for real-time data synchronization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center items-center p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-none bg-primary">
                <Code className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">API Key Manager</h1>
            <p className="text-muted-foreground">Securely manage your API keys and integrate with your applications</p>
          </div>
          <div className="space-y-4">
            <a href="/sign-in" className="block">
              <Button className="w-full cursor-pointer" size="lg">
                Sign in
              </Button>
            </a>
            <a href="/sign-up" className="block">
              <Button variant="outline" className="w-full cursor-pointer" size="lg">
                Create an account
              </Button>
            </a>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
