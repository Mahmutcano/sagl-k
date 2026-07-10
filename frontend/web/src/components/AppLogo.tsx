import Image from "next/image";
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
      <span className="relative flex size-9 shrink-0 items-center justify-center sm:size-10">
        <Image
          src="/images/erciyes-logo.png"
          alt="Erciyes Üniversitesi Hastaneleri"
          width={40}
          height={40}
          className={cn("size-9 object-contain sm:size-10", inverted && "brightness-0 invert")}
          priority
        />
      </span>
      {showText ? (
        <span className={cn("min-w-0 leading-tight", inverted && "text-primary-foreground")}>
          <span className="block text-sm font-semibold tracking-tight sm:text-[15px]">
            Tıbbi Danışmanlık
          </span>
          <span
            className={cn(
              "block text-[10px] font-medium sm:text-[11px]",
              inverted ? "text-primary-foreground/75" : "text-muted-foreground"
            )}
          >
            Erciyes Üniversitesi Hastaneleri
          </span>
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
