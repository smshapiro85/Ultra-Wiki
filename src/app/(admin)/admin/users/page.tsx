import { auth } from "@/lib/auth";
import { getUsers } from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserActions } from "./user-actions";

export default async function UsersPage() {
  const [session, allUsers] = await Promise.all([auth(), getUsers()]);

  const adminCount = allUsers.filter((u) => u.role === "admin").length;
  const totalCount = allUsers.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          User Management
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {totalCount} {totalCount === 1 ? "user" : "users"} total,{" "}
          {adminCount} {adminCount === 1 ? "admin" : "admins"}
        </p>
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map((user) => {
              const initials = user.name
                ? user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                : "U";
              const isCurrentUser = user.id === session?.user?.id;

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user.image ?? undefined}
                        alt={user.name ?? "User"}
                      />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.name ?? "No name"}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-zinc-400">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "admin" ? "destructive" : "secondary"
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <UserActions
                      userId={user.id}
                      userRole={user.role}
                      isCurrentUser={isCurrentUser}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
