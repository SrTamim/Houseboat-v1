'use client';

/**
 * Ambient background motion for the account area (design: the `.aurora-move` +
 * `.orbfield` layers shared by every haorboat-account-*.html). Fixed, behind all
 * content (`-z-*`), pointer-events-none, and fully hidden under
 * prefers-reduced-motion via the `motion-reduce:hidden` utilities.
 *
 * Keyframes (auroraDrift / float1-3) are defined in tailwind.config.ts.
 */
export function AmbientMotion() {
  return (
    <>
      {/* Wrapper clips the -inset-[20%] bleed so it never widens the page
          (a fixed, negatively-inset layer can otherwise extend scrollWidth and
          cause a phantom horizontal scrollbar on mobile). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-30 overflow-hidden motion-reduce:hidden"
      >
        <div
          className="absolute -inset-[20%] opacity-50 mix-blend-multiply [mask-image:radial-gradient(120%_120%_at_50%_0%,#000_40%,transparent_92%)] dark:opacity-90 dark:mix-blend-screen"
          style={{
            background:
              'radial-gradient(38% 44% at 20% 30%, color-mix(in srgb,var(--blue) 55%,transparent), transparent 60%),' +
              'radial-gradient(34% 40% at 82% 22%, color-mix(in srgb,#7a5cff 50%,transparent), transparent 60%),' +
              'radial-gradient(40% 46% at 62% 82%, color-mix(in srgb,var(--amber) 42%,transparent), transparent 62%)',
            filter: 'blur(60px) saturate(120%)',
            animation: 'auroraDrift 26s ease-in-out infinite alternate',
          }}
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 overflow-hidden motion-reduce:hidden"
      >
        <span
          className="absolute left-[6%] top-[16%] h-[220px] w-[220px] rounded-full opacity-50 blur-[2px]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%,rgba(255,255,255,.5),transparent 42%),' +
              'radial-gradient(circle at 68% 74%,color-mix(in srgb,var(--blue) 70%,transparent),transparent 60%)',
            animation: 'float1 18s ease-in-out infinite',
          }}
        />
        <span
          className="absolute right-[10%] top-[30%] h-[140px] w-[140px] rounded-full opacity-50 blur-[2px]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%,rgba(255,255,255,.5),transparent 42%),' +
              'radial-gradient(circle at 68% 74%,color-mix(in srgb,#7a5cff 70%,transparent),transparent 60%)',
            animation: 'float2 22s ease-in-out infinite',
          }}
        />
        <span
          className="absolute bottom-[12%] left-[44%] h-[90px] w-[90px] rounded-full opacity-50 blur-[2px]"
          style={{
            background:
              'radial-gradient(circle at 32% 28%,rgba(255,255,255,.55),transparent 42%),' +
              'radial-gradient(circle at 68% 74%,color-mix(in srgb,var(--amber) 70%,transparent),transparent 60%)',
            animation: 'float3 15s ease-in-out infinite',
          }}
        />
      </div>
    </>
  );
}
