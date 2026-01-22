/**
 * Brand Switcher Component
 * 
 * Allows users to switch between brands/tenants
 * Used in global navigation
 */

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface BrandSwitcherProps {
  brands: Brand[];
  currentBrandId?: string;
  onBrandChange?: (brandId: string) => void;
}

export function BrandSwitcher({ brands, currentBrandId, onBrandChange }: BrandSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedBrand, setSelectedBrand] = React.useState<Brand | undefined>(
    brands.find(b => b.id === currentBrandId)
  );

  React.useEffect(() => {
    setSelectedBrand(brands.find(b => b.id === currentBrandId));
  }, [currentBrandId, brands]);

  const handleSelect = (brand: Brand) => {
    setSelectedBrand(brand);
    setOpen(false);
    onBrandChange?.(brand.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {selectedBrand?.name || "Select brand..."}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search brands..." />
          <CommandList>
            <CommandEmpty>No brand found.</CommandEmpty>
            <CommandGroup>
              {brands.map((brand) => (
                <CommandItem
                  key={brand.id}
                  value={brand.name}
                  onSelect={() => handleSelect(brand)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedBrand?.id === brand.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {brand.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
