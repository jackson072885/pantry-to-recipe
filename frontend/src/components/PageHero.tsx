type PageHeroProps = {
  pageTitle: string;
  tagline: string;
  className?: string;
};

function PageHero({ pageTitle, tagline, className = "" }: PageHeroProps) {
  const classes = ["page-hero", className].filter(Boolean).join(" ");

  return (
    <header className={classes}>
      <img
        src="/welcome-left-garnish.svg"
        alt=""
        aria-hidden="true"
        className="page-hero-garnish page-hero-garnish--left"
      />
      <img
        src="/welcome-right-garnish.svg"
        alt=""
        aria-hidden="true"
        className="page-hero-garnish page-hero-garnish--right"
      />
      <div className="page-hero-art" aria-hidden="true">
        <span className="page-hero-orb page-hero-orb--soft" />
        <span className="page-hero-orb page-hero-orb--leaf" />
      </div>
      <div className="page-hero-main">
        <div className="page-hero-intro">
          <div className="page-hero-brand-lockup" aria-hidden="true">
            <span className="page-hero-brand">Pantry to Plate</span>
            <svg
              className="page-hero-swoosh"
              width="170"
              height="24"
              viewBox="0 0 170 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M6 13C32 7 52 6 82 12C103 16 125 18 164 11" stroke="#CBE86B" strokeWidth="4" strokeLinecap="round" />
              <path d="M104 16C118 18 129 18 144 16" stroke="#B8D85A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>{pageTitle}</h1>
          <p className="page-hero-subtitle">{tagline}</p>
        </div>
      </div>
    </header>
  );
}

export default PageHero;
