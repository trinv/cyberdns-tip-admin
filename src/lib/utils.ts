import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn/ui `cn()` helper — merges conditional class lists (clsx)
// and resolves conflicting Tailwind utility classes so the last one wins
// (twMerge), e.g. cn('px-2', condition && 'px-4') correctly keeps only
// 'px-4' instead of emitting both. Required by the vendored mapcn map
// component (src/components/ui/map.tsx) and any future shadcn-registry
// component added to this project.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
