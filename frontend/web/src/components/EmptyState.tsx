import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription className="mx-auto max-w-sm">{description}</CardDescription> : null}
      </CardHeader>
      {action ? <CardFooter className="justify-center pb-6 pt-0">{action}</CardFooter> : null}
    </Card>
  );
}

type LoadingCardsProps = {
  count?: number;
  className?: string;
};

export function LoadingCards({ count = 3, className }: LoadingCardsProps) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="space-y-3 pt-6">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
