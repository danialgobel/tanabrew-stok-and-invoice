import { CheckCircle2 } from "lucide-react";

interface AnimatedNotificationProps {
  title: string;
  description?: string;
}

const AnimatedNotification = ({ title, description }: AnimatedNotificationProps) => (
  <div className="tanabrew-floating-notice pointer-events-none fixed left-4 right-4 top-4 z-[80] mx-auto max-w-sm">
    <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-card px-4 py-3 shadow-lg">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  </div>
);

export default AnimatedNotification;
