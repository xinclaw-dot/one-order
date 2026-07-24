const CATEGORIES = ["Semua", "Makanan", "Minuman", "Topping"];

export default function CategoryTabs({ active, onChange }) {
  return (
    <div className="sticky top-[76px] z-20 -mx-4 flex gap-2 overflow-x-auto bg-white/90 px-4 py-3 backdrop-blur no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition ${
              isActive
                ? "bg-gradient-to-r from-chili to-guava text-cream shadow-md shadow-chili/25"
                : "bg-white text-ink/60 ring-1 ring-ink/10 hover:text-ink"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
