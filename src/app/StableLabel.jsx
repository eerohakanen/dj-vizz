import { cn } from '@/lib/utils';

export function StableLabel({ value, options }) {
  return (
    <span className="inline-grid *:[grid-area:1/1]">
      {options.map((option) => (
        <span key={option} className={cn(option !== value && 'invisible')} aria-hidden={option !== value}>
          {option}
        </span>
      ))}
    </span>
  );
}
