import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { isNetworkError } from "@/lib/offlineQueue";
import { formatAppError, OFFLINE_NETWORK_MESSAGE } from "@/lib/error-formatter";

let lastNetworkToastTime = 0;
const NETWORK_TOAST_THROTTLE_MS = 6000;

// Wrap toast.error to gracefully intercept offline/network errors
const originalToastError = toast.error.bind(toast);

toast.error = (message: any, data?: any) => {
  const isNet =
    isNetworkError(message) ||
    (data && isNetworkError(data.description)) ||
    (typeof navigator !== "undefined" && !navigator.onLine);

  if (isNet) {
    const now = Date.now();
    if (now - lastNetworkToastTime < NETWORK_TOAST_THROTTLE_MS) {
      return "" as any;
    }
    lastNetworkToastTime = now;
    return originalToastError(OFFLINE_NETWORK_MESSAGE, {
      ...data,
      description: data?.description || "Actions will be saved locally on this device until you reconnect.",
    });
  }

  const formatted = typeof message === "string" ? message : formatAppError(message);
  return originalToastError(formatted, data);
};

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
