import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

function Svg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const fill = (filled?: boolean) => (filled ? 'currentColor' : 'none');

export function IconLibrary({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="4" width="4" height="16" rx="1" fill={fill(filled)} />
      <rect x="9.5" y="4" width="4" height="16" rx="1" fill={fill(filled)} />
      <path
        d="m15.3 5.4 2.6-.7a1 1 0 0 1 1.22.7l3.05 11.4a1 1 0 0 1-.7 1.22l-2.6.7a1 1 0 0 1-1.22-.7L14.6 6.62a1 1 0 0 1 .7-1.22Z"
        fill={fill(filled)}
      />
    </Svg>
  );
}

export function IconUpdates({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15Z" fill={fill(filled)} />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function IconHistory({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.6 4.6v3.8h3.8" />
      <path d="M12 7.6V12l3 2" />
    </Svg>
  );
}

export function IconSearch({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" fill={fill(filled)} />
      <path d="m20 20-4.2-4.2" />
    </Svg>
  );
}

export function IconSettings({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" fill={fill(filled)} />
      <circle cx="10" cy="17" r="2" fill={fill(filled)} />
    </Svg>
  );
}

export function IconClose(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={1.9} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconBook(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M3.5 5.6c2.9-1 5.7-.7 8.5 1.3 2.8-2 5.6-2.3 8.5-1.3v12.8c-2.9-1-5.7-.7-8.5 1.3-2.8-2-5.6-2.3-8.5-1.3Z" />
      <path d="M12 6.9v12.8" />
    </Svg>
  );
}
