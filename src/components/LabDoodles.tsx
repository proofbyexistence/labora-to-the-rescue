/**
 * Hand-drawn lab equipment and department doodle components consuming the shared SVG sprite.
 */
import type { SVGProps } from 'react';
import type { EquipmentType } from '../js/types';
export { DoodleSprite } from './DoodleSprite';

type DoodleProps = SVGProps<SVGSVGElement>;

function SpriteDoodle({ symbolId, ...props }: DoodleProps & { symbolId: string }) {
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" {...props}>
      <use href={`#${symbolId}`} />
    </svg>
  );
}

/** Renders a hand-drawn chemistry flask doodle from the shared SVG sprite. */
export function FlaskDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-flask" {...props} />;
}

/** Renders a hand-drawn oscilloscope doodle from the shared SVG sprite. */
export function OscilloscopeDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-oscilloscope" {...props} />;
}

/** Renders a hand-drawn circuit board doodle from the shared SVG sprite. */
export function CircuitBoardDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-circuit" {...props} />;
}

/** Renders a hand-drawn mechanical gear doodle from the shared SVG sprite. */
export function GearDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-gear" {...props} />;
}

/** Renders a hand-drawn microscope doodle from the shared SVG sprite. */
export function MicroscopeDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-microscope" {...props} />;
}

/** Renders a hand-drawn workstation laptop doodle from the shared SVG sprite. */
export function LaptopDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-laptop" {...props} />;
}

/** Renders a hand-drawn safety goggles doodle from the shared SVG sprite. */
export function SafetyGogglesDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-goggles" {...props} />;
}

/**
 * Renders the hero workbench illustration for the home page banner.
 *
 * @param props - Optional SVG element attributes.
 * @returns Decorative SVG illustration.
 */
export function HeroBenchDoodle(props: DoodleProps) {
  return (
    <svg width={360} height={240} viewBox="0 0 360 240" fill="none" aria-hidden="true" focusable="false" {...props}>
      <rect x="36" y="56" width="162" height="122" rx="8" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.8" />
      <line x1="117" y1="56" x2="117" y2="178" stroke="var(--ink)" strokeWidth="2.4" />
      <path d="M52 80H102M52 96H98M52 112H104M52 128H90M132 82H182M132 98H176M132 148H182" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="132" y="112" width="48" height="24" rx="4" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="218" y="46" width="106" height="82" rx="8" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.8" />
      <rect x="229" y="57" width="58" height="46" rx="4" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2.2" />
      <path d="M234 80C240 64 246 64 252 80C258 96 264 96 270 80C275 68 279 72 282 80" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="304" cy="68" r="6" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.2" />
      <circle cx="304" cy="88" r="6" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2.2" />
      <path d="M254 140H276M259 140V156L242 186C240.5 189 242.5 193 246 193H284C287.5 193 289.5 189 288 186L271 156V140" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M249 174H281L286 186C286.6 188 285 190 283 190H247C245 190 243.4 188 244 186L249 174Z" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M22 198H338" stroke="var(--ink)" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M56 30L59 38L67 41L59 44L56 52L53 44L45 41L53 38Z" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.8" />
      <circle cx="198" cy="34" r="5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Selects the matching hand-drawn department doodle icon for a department ID.
 *
 * @param props - Department identifier and optional CSS class name.
 * @returns Matching SVG doodle component.
 */
export function DepartmentDoodle({
  departmentId,
  className = 'h-10 w-10',
}: {
  departmentId: string;
  className?: string;
}) {
  switch (departmentId) {
    case 'dept-physics':
      return <OscilloscopeDoodle className={className} />;
    case 'dept-chemistry':
      return <FlaskDoodle className={className} />;
    case 'dept-ece':
      return <CircuitBoardDoodle className={className} />;
    case 'dept-cs':
      return <LaptopDoodle className={className} />;
    case 'dept-mechanical':
      return <GearDoodle className={className} />;
    case 'dept-biotech':
      return <MicroscopeDoodle className={className} />;
    case 'dept-civil':
    default:
      return <SafetyGogglesDoodle className={className} />;
  }
}

/**
 * Selects an equipment doodle icon based on equipment type and parent department.
 *
 * @param props - Equipment category, optional department ID, and optional CSS class name.
 * @returns Matching SVG doodle component.
 */
export function EquipmentDoodle({
  type,
  departmentId,
  className = 'h-24 w-24',
}: {
  type: EquipmentType;
  departmentId?: string;
  className?: string;
}) {
  if (type === 'Development kits') {
    return <CircuitBoardDoodle className={className} />;
  }
  if (type === 'Workstations') {
    return <LaptopDoodle className={className} />;
  }
  if (type === 'Safety gear') {
    return <SafetyGogglesDoodle className={className} />;
  }
  if (departmentId === 'dept-chemistry') {
    return <FlaskDoodle className={className} />;
  }
  if (departmentId === 'dept-biotech') {
    return <MicroscopeDoodle className={className} />;
  }
  if (departmentId === 'dept-mechanical' || departmentId === 'dept-civil') {
    return <GearDoodle className={className} />;
  }
  return <OscilloscopeDoodle className={className} />;
}
