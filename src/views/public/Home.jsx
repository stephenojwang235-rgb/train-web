export default function Home() {
  return (
    <section className="homepage-background" aria-label="NICC Campus Ministry campus background">
      {/* Responsive hero: phones download ~74 KB instead of the full 256 KB
          JPEG; WebP-first with progressive-JPEG fallback. fetchpriority=high
          because this is the LCP image on the landing page. */}
      <picture>
        <source
          type="image/webp"
          srcSet="/images/campus-homepage-480.webp 480w, /images/campus-homepage-768.webp 768w, /images/campus-homepage-1054.webp 1054w"
          sizes="100vw"
        />
        <img
          src="/images/campus-homepage-768.jpg"
          srcSet="/images/campus-homepage-480.jpg 480w, /images/campus-homepage-768.jpg 768w, /images/campus-homepage-1054.jpg 1054w"
          sizes="100vw"
          alt=""
          role="presentation"
          fetchpriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>
    </section>
  )
}

