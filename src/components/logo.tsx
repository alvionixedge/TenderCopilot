import Image from "next/image";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? 28 : size === "lg" ? 56 : 40;
  return (
    <Image
      src="/brand/logo.png"
      alt="TenderCopilot AI"
      width={Math.round(h * 3.74)}
      height={h}
      priority
      className="h-auto"
      style={{ height: h, width: "auto" }}
    />
  );
}

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/mark.png"
      alt="TenderCopilot AI"
      width={size}
      height={size}
      style={{ height: size, width: size }}
    />
  );
}
