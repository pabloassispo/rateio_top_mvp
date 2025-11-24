import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserInitials } from "@/lib/userUtils";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  user?: {
    name: string | null;
    email: string | null;
  } | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export function UserAvatar({ user, name, email, size = "md", className }: UserAvatarProps) {
  const displayName = user?.name || name || user?.email?.split("@")[0] || email?.split("@")[0] || "U";
  const initials = user 
    ? getUserInitials(user) 
    : (name?.charAt(0) || email?.charAt(0) || "U").toUpperCase();

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn(sizeClasses[size], "bg-blue-100 text-blue-700")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

