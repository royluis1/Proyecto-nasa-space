"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Nombre accesible del control (el lector de pantalla lo anuncia junto con el valor). */
  thumbLabel: string;
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(({ className, thumbLabel, ...props }, ref) => (
  <SliderPrimitive.Root ref={ref} className={cn("relative flex h-8 w-full touch-none select-none items-center", className)} {...props}>
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbLabel}
      className="block size-6 rounded-full border-2 border-primary bg-background shadow transition-colors disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";

export { Slider };
