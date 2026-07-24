const START_YEAR = 2026;

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const yearLabel = currentYear > START_YEAR ? `${START_YEAR} - ${currentYear}` : `${START_YEAR}`;

  return (
    <footer className="px-5 py-5 text-center">
      <p className="text-[11px] font-medium text-ink-soft/70">
        Copyright By Orderin Aja © {yearLabel}. All rights reserved.
      </p>
    </footer>
  );
}
