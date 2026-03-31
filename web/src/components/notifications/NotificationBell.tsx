"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck, AlertCircle } from "lucide-react";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/datetime";
import type { AppNotification } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const {
    unreadCount,
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  function handleOpenChange(open: boolean) {
    if (open) {
      fetchNotifications();
    }
  }

  async function handleNotificationClick(notification: AppNotification) {
    if (!notification.isRead) {
      await markAsRead(notification.id).catch(() => {});
    }
    router.push(
      `/brain/${notification.brainId}/cluster/${notification.clusterId}/neuron/${notification.neuronId}`
    );
  }

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          data-testid="notification-bell"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
              aria-hidden="true"
              data-testid="notification-unread-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notification-popover">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead().catch(() => {})}
              data-testid="mark-all-read-btn"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span>Failed to load notifications</span>
              <Button variant="ghost" size="sm" onClick={fetchNotifications}>
                Retry
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y" role="list" aria-label="Notifications">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  role="listitem"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors",
                    !n.isRead && "bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                        aria-label="Unread"
                      />
                    )}
                    <div className={cn("min-w-0 flex-1", n.isRead && "ml-4")}>
                      <p className="text-sm font-medium truncate">{n.neuronTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
