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

export function IconBack(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function IconChevron(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={2} {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconExternal(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={1.9} {...p}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function IconExtensions(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 19h14" />
    </Svg>
  );
}

export function IconFilter(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Svg>
  );
}

export function IconPlay(p: Omit<IconProps, "filled">) {
  return (
    <Svg fill="currentColor" stroke="none" {...p}>
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </Svg>
  );
}

export function IconRefresh(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={1.9} {...p}>
      <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v3.5h3.5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.5M20 20v-3.5h-3.5" />
    </Svg>
  );
}

export function IconFolder(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6a2 2 0 0 1 1.5.7l1 1.1a2 2 0 0 0 1.5.7h5.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </Svg>
  );
}

export function IconServer(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="7" rx="2" />
      <rect x="4" y="13" width="16" height="7" rx="2" />
      <path d="M8 7.5h.01M8 16.5h.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function IconPalette(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Z" />
      <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function IconSort(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
    </Svg>
  );
}

export function IconHeart({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 19.8s-7.5-4.6-7.5-10.3a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.7-7.5 10.3-7.5 10.3Z" fill={fill(filled)} />
    </Svg>
  );
}

export function IconCheck(p: Omit<IconProps, "filled">) {
  return (
    <Svg strokeWidth={2.4} {...p}>
      <path d="m5.5 12.5 4.2 4.2 8.8-9.4" />
    </Svg>
  );
}

export function IconInfo(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2M12 7.8h.01" strokeWidth={2.2} />
    </Svg>
  );
}

export function IconTrash(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.5 11v5M13.5 11v5" />
    </Svg>
  );
}

export function IconBookmark({ filled, ...p }: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" fill={fill(filled)} />
    </Svg>
  );
}

export function IconList(p: Omit<IconProps, "filled">) {
  return (
    <Svg {...p}>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Svg>
  );
}

export function IconFullscreen({ exit, ...p }: Omit<IconProps, "filled"> & { exit?: boolean }) {
  return (
    <Svg {...p}>
      {exit ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </Svg>
  );
}
