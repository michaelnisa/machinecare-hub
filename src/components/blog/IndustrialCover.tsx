import React, { useState } from "react";
import { Wrench, Factory, Truck, ShieldAlert, Cpu, HardHat, Cog } from "lucide-react";

interface IndustrialCoverProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  aspectRatio?: string;
}

export function IndustrialCover({
  src,
  alt,
  category = "Maintenance & Reliability",
  className = "w-full h-full object-cover",
  aspectRatio = "aspect-[16/9]",
}: IndustrialCoverProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const getCategoryIcon = () => {
    switch (category) {
      case "Plant Operations":
        return <Factory className="h-10 w-10 text-emerald-500 opacity-60" />;
      case "Fleet & Logistics":
        return <Truck className="h-10 w-10 text-blue-500 opacity-60" />;
      case "Safety & Compliance":
        return <ShieldAlert className="h-10 w-10 text-amber-500 opacity-60" />;
      case "Industrial IoT & OEE":
        return <Cpu className="h-10 w-10 text-purple-500 opacity-60" />;
      case "Workshop & Repair":
        return <Wrench className="h-10 w-10 text-orange-500 opacity-60" />;
      default:
        return <Cog className="h-10 w-10 text-primary opacity-60 animate-spin-slow" />;
    }
  };

  const getCategoryGradient = () => {
    switch (category) {
      case "Plant Operations":
        return "from-slate-900 via-emerald-950 to-slate-900";
      case "Fleet & Logistics":
        return "from-slate-900 via-blue-950 to-slate-900";
      case "Safety & Compliance":
        return "from-slate-900 via-amber-950 to-slate-900";
      case "Industrial IoT & OEE":
        return "from-slate-900 via-purple-950 to-slate-900";
      default:
        return "from-slate-900 via-emerald-950/70 to-slate-900";
    }
  };

  if (!src || hasError) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${getCategoryGradient()} text-white p-6 ${aspectRatio}`}
      >
        {/* Subtle engineering grid background */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-2 shadow-inner border border-white/10">
            {getCategoryIcon()}
          </div>
          <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-400 font-bold">
            {category}
          </span>
          <span className="text-xs text-slate-300 font-semibold max-w-[80%] line-clamp-1 mt-1">
            {alt}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-muted ${aspectRatio}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/60 animate-pulse flex items-center justify-center">
          <Cog className="h-6 w-6 text-muted-foreground animate-spin opacity-40" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
