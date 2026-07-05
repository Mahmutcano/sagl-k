import Link from "next/link";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  href?: string;
  className?: string;
  showText?: boolean;
  inverted?: boolean;
};

export function AppLogo({ href = "/", className, showText = true, inverted = false }: AppLogoProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold shadow-sm",
          inverted ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        TD
      </span>
      {showText ? (
        <span className={cn("font-semibold tracking-tight", inverted && "text-primary-foreground")}>
          Tıbbi Danışmanlık
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn("flex items-center gap-2.5", className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-2.5", className)}>{content}</div>;
}
