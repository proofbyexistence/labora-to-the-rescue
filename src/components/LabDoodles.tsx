import type { SVGProps } from 'react';
import type { EquipmentType } from '../js/types';

type DoodleProps = SVGProps<SVGSVGElement>;

/**
 * Shared SVG sprite defining the 7 reusable hand-drawn doodles once per document.
 * Mounted inside Layout so every card, sidebar tab, and the daydream strip reuse <symbol>s via <use>.
 */
export function DoodleSprite() {
  return (
    <svg
      width={0}
      height={0}
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute overflow-hidden"
    >
      <defs>
        <symbol id="doodle-flask" viewBox="0 0 64 64">
          <path
            d="M24 10H40M27 10V23L14 48C12.8 50.3 14.5 53 17.1 53H46.9C49.5 53 51.2 50.3 50 48L37 23V10"
            fill="var(--white)"
            stroke="var(--ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 39H45L48.5 47.5C49.3 49.3 48 51.2 46 51.2H18C16 51.2 14.7 49.3 15.5 47.5L19 39Z"
            fill="var(--lavender)"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="45" r="2.2" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
          <circle cx="36" cy="43" r="1.6" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
          <circle cx="32" cy="29" r="1.5" stroke="var(--ink)" strokeWidth="1.8" />
        </symbol>

        <symbol id="doodle-oscilloscope" viewBox="0 0 64 64">
          <rect x="8" y="14" width="48" height="36" rx="5" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.5" />
          <rect x="13" y="19" width="25" height="22" rx="3" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
          <path
            d="M15 30C17.5 22 20 22 22.5 30C25 38 27.5 38 30 30C32.5 22 34.5 24 36 30"
            stroke="var(--ink)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="46" cy="24" r="3" fill="var(--white)" stroke="var(--ink)" strokeWidth="2" />
          <circle cx="46" cy="34" r="3" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
          <path d="M16 45H24M29 45H35M44 44H50" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        <symbol id="doodle-circuit" viewBox="0 0 64 64">
          <rect x="11" y="12" width="42" height="40" rx="4" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2.5" />
          <rect x="23" y="24" width="18" height="16" rx="2" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.2" />
          <path
            d="M17 20H23M17 32H23M17 44H23M41 20H47M41 32H47M41 44H47M28 16V24M36 16V24M28 40V48M36 40V48"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="17" cy="20" r="2" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
          <circle cx="47" cy="44" r="2" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
        </symbol>

        <symbol id="doodle-gear" viewBox="0 0 64 64">
          <path
            d="M28 10H36L37.8 15.6C39.4 16.2 40.9 17 42.3 18.1L47.7 15.8L51.7 22.8L47.1 26.5C47.4 28.2 47.4 30 47.1 31.7L51.7 35.4L47.7 42.4L42.3 40.1C40.9 41.2 39.4 42 37.8 42.6L36 48.2H28L26.2 42.6C24.6 42 23.1 41.2 21.7 40.1L16.3 42.4L12.3 35.4L16.9 31.7C16.6 30 16.6 28.2 16.9 26.5L12.3 22.8L16.3 15.8L21.7 18.1C23.1 17 24.6 16.2 26.2 15.6L28 10Z"
            fill="var(--lavender)"
            stroke="var(--ink)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="29" r="7.5" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
          <path d="M14 54H50" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
        </symbol>

        <symbol id="doodle-microscope" viewBox="0 0 64 64">
          <path
            d="M27 11L35 14L29 31L21 28L27 11Z"
            fill="var(--lavender)"
            stroke="var(--ink)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M32 22C42 24 46 34 40 45H17" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M18 37H33" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="14" y="46" width="36" height="7" rx="3" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.4" />
        </symbol>

        <symbol id="doodle-laptop" viewBox="0 0 64 64">
          <rect x="13" y="14" width="38" height="25" rx="3" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.5" />
          <rect x="17" y="18" width="30" height="17" rx="1.5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.8" />
          <path d="M21 24H33M21 29H39" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 43H56L52 49H12L8 43Z" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
        </symbol>

        <symbol id="doodle-goggles" viewBox="0 0 64 64">
          <path
            d="M10 28C10 22 14 20 20 20H44C50 20 54 22 54 28V38C54 42 50 44 45 44C40 44 36 41 34 37C33 35 31 35 30 37C28 41 24 44 19 44C14 44 10 42 10 38V28Z"
            fill="var(--white)"
            stroke="var(--ink)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="15" y="25" width="13" height="13" rx="4" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
          <rect x="36" y="25" width="13" height="13" rx="4" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="2" />
          <path d="M18 29H22M39 29H43" stroke="var(--white)" strokeWidth="2" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

function SpriteDoodle({ symbolId, ...props }: DoodleProps & { symbolId: string }) {
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" {...props}>
      <use href={`#${symbolId}`} />
    </svg>
  );
}

export function FlaskDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-flask" {...props} />;
}

export function OscilloscopeDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-oscilloscope" {...props} />;
}

export function CircuitBoardDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-circuit" {...props} />;
}

export function GearDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-gear" {...props} />;
}

export function MicroscopeDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-microscope" {...props} />;
}

export function LaptopDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-laptop" {...props} />;
}

export function SafetyGogglesDoodle(props: DoodleProps) {
  return <SpriteDoodle symbolId="doodle-goggles" {...props} />;
}

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
