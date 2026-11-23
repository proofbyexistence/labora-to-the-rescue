/**
 * Single inline hand-drawn stick-figure daydream strip above the footer.
 * Animates via CSS transform/opacity and pauses on reduced-motion, hidden tab, off-screen scroll, or user toggle.
 */
import { useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { useDaydreamPause } from '../js/use-daydream-pause';

function DaydreamIllustration() {
  return (
    <svg
      width={640}
      height={108}
      viewBox="0 0 640 108"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="block h-24 w-full max-w-2xl"
    >
      <path d="M24 96H616" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      <g id="daydream-chair">
        <path d="M120 46V74M120 74H148M124 74V96M144 74V96" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="116" y="45" width="6" height="18" rx="2.5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.8" />
      </g>
      <g id="daydream-body">
        <path d="M144 49L148 73M148 73L167 75L168 96M146 73L157 78L158 96" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g id="daydream-desk">
        <path d="M174 66H272M184 66V96M260 66V96" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="206" y="58" width="30" height="8" rx="2" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.8" />
        <rect x="244" y="55" width="12" height="11" rx="2" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
        <path d="M248 55L246 49M252 55L254 50" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g id="daydream-arms">
        <path d="M144 55L133 67" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
        <g className="daydream-anim daydream-hand-anim">
          <path d="M146 56L167 63L191 63" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="193" cy="63" r="3" fill="var(--white)" stroke="var(--ink)" strokeWidth="1.8" />
        </g>
      </g>
      <g id="daydream-head" className="daydream-anim daydream-head-anim">
        <path d="M142 22C146 17 151 18 153 22" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="148" cy="35" r="12.5" fill="var(--white)" stroke="var(--ink)" strokeWidth="2.3" />
        <path d="M144 40.5C147 42.5 151 42.5 154 40.5" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
        <g id="daydream-eyes" className="daydream-anim daydream-eyes-anim">
          <ellipse cx="145.5" cy="34" rx="1.6" ry="1.9" fill="var(--ink)" />
          <ellipse cx="153.5" cy="34" rx="1.6" ry="1.9" fill="var(--ink)" />
        </g>
      </g>
      <g id="daydream-thought-bubble" className="daydream-anim daydream-bubble-anim">
        <circle cx="179" cy="27" r="3.5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.7" />
        <circle cx="198" cy="20" r="5.5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.7" />
        <path d="M214 22C232 18 248 26 266 25" stroke="var(--ink)" strokeWidth="1.8" strokeDasharray="4 5" strokeLinecap="round" />
        <path
          d="M298 66C282 66 272 56 274 44C275 33 286 26 298 28C304 16 320 11 334 17C343 9 362 9 371 18C384 12 403 18 408 31C421 31 430 41 428 53C426 64 415 71 402 69C394 78 377 80 366 74C355 81 337 81 327 73C316 78 302 74 298 66Z"
          fill="var(--white)"
          stroke="var(--ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <use href="#doodle-oscilloscope" x="328" y="20" width="46" height="46" className="daydream-anim daydream-doodle-1" />
        <use href="#doodle-flask" x="330" y="20" width="44" height="44" className="daydream-anim daydream-doodle-2" />
        <use href="#doodle-circuit" x="330" y="20" width="44" height="44" className="daydream-anim daydream-doodle-3" />
        <use href="#doodle-gear" x="330" y="20" width="44" height="44" className="daydream-anim daydream-doodle-4" />
        <path d="M446 36C486 24 522 46 566 34" stroke="var(--ink)" strokeWidth="1.8" strokeDasharray="5 6" strokeLinecap="round" />
        <path d="M582 22L585 30L593 33L585 36L582 44L579 36L571 33L579 30Z" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.7" />
        <circle cx="474" cy="52" r="3.5" fill="var(--lavender)" stroke="var(--ink)" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/**
 * Renders the animated notebook daydream illustration and accessible pause/play toggle.
 *
 * @returns Daydream strip container element.
 */
export function DaydreamStrip() {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const { isPaused, userPaused, toggleUserPaused } = useDaydreamPause(stripRef);

  return (
    <div
      ref={stripRef}
      className="daydream-strip mx-auto flex max-w-[1360px] flex-wrap items-center justify-center gap-3 px-4 pb-1 sm:px-6 lg:px-10"
      data-paused={isPaused ? 'true' : 'false'}
    >
      <DaydreamIllustration />
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-sm text-[var(--ink)]">Lab daydream</span>
        <button
          type="button"
          onClick={toggleUserPaused}
          aria-label={userPaused ? 'Play animation' : 'Pause animation'}
          aria-pressed={userPaused}
          className="labora-btn labora-btn-paper !px-3 text-sm"
        >
          {userPaused ? <Play className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Pause className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{userPaused ? 'Play' : 'Pause'}</span>
        </button>
      </div>
    </div>
  );
}
