import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" />
    <path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
  </Svg>
);

export const BroomIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 4l-7.5 7.5" />
    <path d="M10 10.5l3.5 3.5-2 6.5c-2.5-.2-5.4-1.7-7-3.6l.4-.6 2.6.3-1.7-1.9.6-1z" />
  </Svg>
);

export const LensIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 9 9h-9z" />
    <path d="M15.5 3.7a9 9 0 0 1 4.8 4.8h-4.8z" />
  </Svg>
);

export const FilesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3.5h6.5L19 8v10.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
    <path d="M14 3.5V8h5" />
    <path d="M9.5 13h6M9.5 16.5h4" />
  </Svg>
);

export const AppsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
    <path d="M14 17h5.5M16.75 14.25v5.5" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" />
    <circle cx="12" cy="12" r="6.6" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12a1.8 1.8 0 0 0 1.8 1.6h5.6a1.8 1.8 0 0 0 1.8-1.6l.9-12" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  </Svg>
);

export const RevealIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5L12 12" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const CodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />
  </Svg>
);

export const HammerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 6.5l4 4M4 20l9-9" />
    <path d="M11 4.5c2.5-1.5 5.5-1 7.5 1l1.5 1.5-3 3-2.5-2.5-2 .5z" />
  </Svg>
);

export const WindowIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M3.5 9h17M7 6.8h.01M9.5 6.8h.01" />
  </Svg>
);

export const ChipIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
    <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    <path d="M9.5 2.8V6M14.5 2.8V6M9.5 18v3.2M14.5 18v3.2M2.8 9.5H6M2.8 14.5H6M18 9.5h3.2M18 14.5h3.2" />
  </Svg>
);

export const OrbitIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.6" />
    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" />
    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(30 12 12)" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);

export const XIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.5A8 8 0 0 0 5.6 7.2L4 9M4 4.5V9h4.5M4 12.5a8 8 0 0 0 14.4 4.3L20 15M20 19.5V15h-4.5" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l7.5 2.8v5.5c0 4.6-3.2 8-7.5 9.3-4.3-1.3-7.5-4.7-7.5-9.3V6z" />
    <path d="M8.8 12l2.2 2.2 4.3-4.4" />
  </Svg>
);

export const SpeakerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Svg>
);

export const VideoIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="6" width="12" height="12" rx="2.5" />
    <path d="M15.5 10.5l5-3v9l-5-3z" />
  </Svg>
);

export const MusicIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 17.5V5.5l10-2v12" />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="16.5" cy="15.5" r="2.5" />
  </Svg>
);

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M20.5 15.5l-5-5-9 9" />
  </Svg>
);

export const ArchiveIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="4.5" rx="1.5" />
    <path d="M5 8.5v9.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
  </Svg>
);

export const DiscIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
);

export const PackageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
    <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
);
