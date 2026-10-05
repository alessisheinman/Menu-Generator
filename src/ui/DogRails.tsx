// Every photo in src/assets/dogs is picked up automatically — just drop new JPGs in that folder.
const modules = import.meta.glob<string>('../assets/dogs/*.jpg', { eager: true, query: '?url', import: 'default' });
const photos = Object.keys(modules).sort().map((k) => modules[k]);
const left = photos.filter((_, i) => i % 2 === 0);
const right = photos.filter((_, i) => i % 2 === 1);

/** Decorative photo columns down both sides of the page (wide screens only). */
export function DogRails() {
  return (
    <>
      <Rail side="left" srcs={left} />
      <Rail side="right" srcs={right} />
    </>
  );
}

function Rail({ side, srcs }: { side: 'left' | 'right'; srcs: string[] }) {
  // The list is rendered twice so the slow scroll loops seamlessly.
  return (
    <div className={`dog-rail dog-rail-${side}`} aria-hidden="true">
      <div className="dog-track">
        {[...srcs, ...srcs].map((src, i) => (
          <img key={i} src={src} alt="" loading="lazy" decoding="async" draggable={false} />
        ))}
      </div>
    </div>
  );
}
