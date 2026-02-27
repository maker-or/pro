'use client';

import { Authenticated } from 'convex/react';
import { AuthenticatedLayout } from '@/components/authenticated-layout';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <Authenticated>
      <AuthenticatedLayout>
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
            <SidebarTrigger className="cursor-pointer" />
            <h1 className="text-lg font-medium">Profile</h1>
          </header>
          <main className="flex-1 p-6">
            <Card className="max-w-4xl">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="size-16 rounded-none">
                    <AvatarImage src={user?.profilePictureUrl ?? undefined} alt={user?.email} />
                    <AvatarFallback className="rounded-none text-lg">
                      {user?.email?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle>
                      {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'User'}
                    </CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-muted-foreground">{user?.email}</p>
                  </div>
                  {user?.firstName && (
                    <div>
                      <p className="text-sm font-medium">First Name</p>
                      <p className="text-muted-foreground">{user.firstName}</p>
                    </div>
                  )}
                  {user?.lastName && (
                    <div>
                      <p className="text-sm font-medium">Last Name</p>
                      <p className="text-muted-foreground">{user.lastName}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </main>
        </SidebarInset>
      </AuthenticatedLayout>
    </Authenticated>
  );
}
