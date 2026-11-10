import { useId } from 'react';

export type TechniqueDiagram = 'overhead-slam' | 'forward-throw' | 'drop-jump';

/** Original direction schematics, not a photograph, diagnostic or full technique model. */
export function ExerciseTechniqueDiagram({ variant }: { variant: TechniqueDiagram }) {
  const marker = `technique-arrow-${useId().replace(/:/g, '')}`;
  const drop = variant === 'drop-jump';
  const title = drop ? 'Drop jump: step off, rebound vertically, then land'
    : variant === 'overhead-slam' ? 'Two-hand overhead slam: overhead start to downward floor release'
      : 'Overhead forward throw: two-hand overhead start to forward target release';
  return <figure className="technique-diagram">
    <svg viewBox={drop ? '0 0 340 166' : '0 0 250 166'} role="img" aria-label={title}>
      <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7Z" className="technique-diagram__arrowhead" /></marker></defs>
      <g className="technique-diagram__body" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {drop ? <>
          <path d="M10 151H330M12 126H64V151H12ZM119 14V151M232 14V151" className="technique-diagram__surface" />
          <circle cx="40" cy="34" r="9" /><path d="M40 45V82M40 54 25 67M40 54 58 65M40 82 32 106 36 125M40 82 66 106 82 122" />
          <path d="M93 84V137" className="technique-diagram__direction" markerEnd={`url(#${marker})`} />
          <circle cx="170" cy="44" r="9" /><path d="M170 55V103M170 64 157 45 155 22M170 64 184 45 187 22M170 103 158 147M170 103 184 147" />
          <path d="M214 134V35" className="technique-diagram__direction" markerEnd={`url(#${marker})`} />
          <circle cx="281" cy="82" r="9" /><path d="M278 94 262 116M276 99 294 116M276 99 257 100M262 116 248 136 250 149M262 116 285 134 293 149" />
        </> : <>
          <path d="M10 151H240" className="technique-diagram__surface" />
          <circle cx="55" cy="52" r="9" /><path d="M55 64V105M49 69 38 44 48 23M61 69 72 44 63 23M55 105 43 144 32 148M55 105 68 144 79 148" />
          <circle cx="55" cy="16" r="10" className="technique-diagram__ball" />
          {variant === 'overhead-slam' ? <>
            <circle cx="175" cy="77" r="9" /><path d="M170 88 157 113M170 92 185 115M176 92 196 116M157 113 146 145 136 148M157 113 176 143 189 148" />
            <circle cx="192" cy="139" r="10" className="technique-diagram__ball" />
            <path d="M82 20C123 28 157 72 186 120" className="technique-diagram__direction" markerEnd={`url(#${marker})`} />
          </> : <>
            <circle cx="157" cy="55" r="9" /><path d="M154 67 146 111M155 72 178 62 190 65M158 77 180 74 193 71M146 111 139 145 128 148M146 111 169 145 181 148" />
            <circle cx="211" cy="65" r="9" className="technique-diagram__ball" />
            <path d="M82 17Q147 5 207 49" className="technique-diagram__direction" markerEnd={`url(#${marker})`} />
            <path d="M239 25V146" className="technique-diagram__surface" /><circle cx="237" cy="68" r="15" className="technique-diagram__target" />
          </>}
        </>}
      </g>
    </svg>
    <figcaption>{drop ? 'Step off → vertical rebound → controlled landing' : variant === 'overhead-slam'
      ? 'Both hands overhead → ball down to the floor' : 'Both hands overhead → ball forward to an approved target'}
      <span>Original movement-direction schematic · follow the written setup and safety guidance.</span>
    </figcaption>
  </figure>;
}
