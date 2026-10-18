/** Original broad-area schematic. It visualises catalogue targets, not technique. */
export function MuscleMap({ muscles }: { muscles: string[] }) {
  const targets = new Set(muscles);
  const active = (...names: string[]) => names.some(name => targets.has(name)) ? 'muscle-map__target' : undefined;
  const outline = 'M43 34 Q35 35 31 44 L20 74 L17 104 Q18 109 23 106 L29 79 L34 65 L34 96 L31 130 L32 173 Q34 180 39 174 L43 137 L48 110 L53 137 L57 174 Q62 180 64 173 L65 130 L62 96 L62 65 L67 79 L73 106 Q78 109 79 104 L76 74 L65 44 Q61 35 53 34 Z';
  return <figure className="muscle-map">
    <div className="muscle-map__views">
      <div><svg viewBox="0 0 96 190" role="img" aria-label="Front target areas">
        <circle className="muscle-map__body" cx="48" cy="19" r="12" />
        <path className="muscle-map__body" d={outline} />
        <g className="muscle-map__areas">
          <path className={active('Shoulders')} d="M41 37 Q32 37 30 50 L37 53 L43 43 Z M55 37 Q64 37 66 50 L59 53 L53 43 Z" />
          <path className={active('Chest')} d="M41 44 L47 47 L47 64 L37 61 L37 53 Z M55 44 L49 47 L49 64 L59 61 L59 53 Z" />
          <path className={active('Core')} d="M38 64 L47 67 L47 91 L38 94 Z M58 64 L49 67 L49 91 L58 94 Z" />
          <path className={active('Biceps')} d="M30 53 L36 56 L32 75 L27 73 Z M66 53 L60 56 L64 75 L69 73 Z" />
          <path className={active('Forearms')} d="M26 77 L31 78 L25 99 L21 100 Z M70 77 L65 78 L71 99 L75 100 Z" />
          <path className={active('Hip flexors', 'Hips')} d="M37 97 L46 95 L43 108 L36 115 Z M59 97 L50 95 L53 108 L60 115 Z" />
          <path className={active('Quads', 'Legs')} d="M35 114 L42 109 L44 123 L39 140 L34 137 Z M61 114 L54 109 L52 123 L57 140 L62 137 Z" />
          <path className={active('Adductors')} d="M44 103 L47 108 L43 129 L41 122 Z M52 103 L49 108 L53 129 L55 122 Z" />
          <path className={active('Tibialis', 'Legs')} d="M34 144 L39 146 L36 170 L34 171 Z M62 144 L57 146 L60 170 L62 171 Z" />
          <path className={active('Ankles', 'Feet')} d="M33 174 L39 174 L39 181 L30 181 Z M57 174 L63 174 L66 181 L57 181 Z" />
        </g>
      </svg><span>Front</span></div>
      <div><svg viewBox="0 0 96 190" role="img" aria-label="Back target areas">
        <circle className="muscle-map__body" cx="48" cy="19" r="12" />
        <path className="muscle-map__body" d={outline} />
        <g className="muscle-map__areas">
          <path className={active('Shoulders')} d="M41 37 Q32 37 30 50 L37 53 L43 43 Z M55 37 Q64 37 66 50 L59 53 L53 43 Z" />
          <path className={active('Back')} d="M43 38 L47 42 L47 91 L38 94 L38 62 L39 53 Z M53 38 L49 42 L49 91 L58 94 L58 62 L57 53 Z" />
          <path className={active('Triceps')} d="M30 53 L36 56 L32 75 L27 73 Z M66 53 L60 56 L64 75 L69 73 Z" />
          <path className={active('Forearms')} d="M26 77 L31 78 L25 99 L21 100 Z M70 77 L65 78 L71 99 L75 100 Z" />
          <path className={active('Glutes', 'Hips')} d="M37 98 L47 96 L47 113 L35 116 Z M59 98 L49 96 L49 113 L61 116 Z" />
          <path className={active('Hamstrings', 'Legs')} d="M35 119 L45 117 L40 140 L34 137 Z M61 119 L51 117 L56 140 L62 137 Z" />
          <path className={active('Calves', 'Legs')} d="M34 144 L39 144 L39 154 L36 169 L33 165 Z M62 144 L57 144 L57 154 L60 169 L63 165 Z" />
          <path className={active('Ankles', 'Feet')} d="M33 174 L39 174 L39 181 L30 181 Z M57 174 L63 174 L66 181 L57 181 Z" />
        </g>
      </svg><span>Back</span></div>
    </div>
    <figcaption>Target areas <span>Broad muscle groups · schematic</span></figcaption>
  </figure>;
}
