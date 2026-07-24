export default function BottomSheet({ open, onClose, children, tone = "paper" }) {
  if (!open) return null;
  const bg = tone === "ink" ? "bg-ink text-cream" : "bg-paper text-ink";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-[2px] animate-fade-in sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`relative w-full max-w-md animate-sheet-up sm:rounded-b-3xl ${bg}`}>
        <div className={`ticket-edge-top pt-4 sm:rounded-t-3xl ${bg}`}>
          <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-current opacity-20" />
          <div className="max-h-[82vh] overflow-y-auto px-5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
