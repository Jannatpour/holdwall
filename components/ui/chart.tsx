"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: {
    [key: string]: {
      label?: string
      color?: string
    }
  }
  children: React.ReactNode
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ChartContainer.displayName = "ChartContainer"

const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-md",
      className
    )}
    {...props}
  />
))
ChartTooltip.displayName = "ChartTooltip"

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5", className)}
    {...props}
  />
))
ChartTooltipContent.displayName = "ChartTooltipContent"

const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-4", className)}
    {...props}
  />
))
ChartLegend.displayName = "ChartLegend"

const ChartLegendItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    color?: string
  }
>(({ className, color, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    {color && (
      <div
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
    )}
    {props.children}
  </div>
))
ChartLegendItem.displayName = "ChartLegendItem"

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendItem,
}
