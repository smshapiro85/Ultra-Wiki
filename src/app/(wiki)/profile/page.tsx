import { getUserProfile } from "./actions";
import { ProfileForm } from "./profile-form";
import { NotificationForm } from "./notification-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const user = await getUserProfile();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Profile Settings
        </h1>
        <Badge
          variant={user.role === "admin" ? "destructive" : "secondary"}
        >
          {user.role}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Manage your display name and avatar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            user={{
              name: user.name,
              email: user.email,
              image: user.image,
              avatarUrl: user.avatarUrl,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Control how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationForm
            user={{
              email: user.email,
              notifySlackEnabled: user.notifySlackEnabled,
              slackUserId: user.slackUserId,
              notifyEmailEnabled: user.notifyEmailEnabled,
              notifyOnMention: user.notifyOnMention,
              notifyOnActivity: user.notifyOnActivity,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
