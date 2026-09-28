import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AutocompleteOption = { id: string; label: string; sublabel?: string };

interface PlaceAutocompleteProps {
  value: string;
  selected: boolean;
  placeholder?: string;
  disabled?: boolean;
  disabledHint?: string;
  invalidHint?: string;
  noResultsText?: string;
  autoComplete?: string;
  minChars?: number;
  debounceMs?: number;
  search: (query: string) => Promise<AutocompleteOption[]> | AutocompleteOption[];
  onChangeText: (text: string) => void;
  onSelectOption: (option: AutocompleteOption) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Enter with no suggestion highlighted — used to keep the form's existing "Enter moves to next field" flow. */
  onEnterFallback?: () => void;
}

/**
 * Text input + suggestion dropdown, built without Radix Popover because this
 * form previously hit mobile-WebView-specific focus/touch bugs. Suggestions
 * are selected via pointerdown (not click) with preventDefault so the input
 * never blurs before the tap registers — the classic mobile combobox trap.
 */
export function PlaceAutocomplete({
  value,
  selected,
  placeholder,
  disabled,
  disabledHint,
  invalidHint,
  noResultsText,
  autoComplete,
  minChars = 1,
  debounceMs = 200,
  search,
  onChangeText,
  onSelectOption,
  inputRef,
  onEnterFallback,
}: PlaceAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (disabled || selected || value.trim().length < minChars) {
      setOptions([]);
      setOpen(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.resolve(search(value.trim()))
        .catch(() => [] as AutocompleteOption[])
        .then((results) => {
          if (requestId.current !== id) return;
          setOptions(results);
          setHighlight(0);
          setOpen(true);
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, disabled, selected, minChars, debounceMs]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selectOption = (option: AutocompleteOption) => {
    setOpen(false);
    onSelectOption(option);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && open && options.length) {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp" && open && options.length) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && options[highlight]) selectOption(options[highlight]!);
      else onEnterFallback?.();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showInvalidHint = !disabled && !selected && value.trim().length > 0 && !open && Boolean(invalidHint);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        enterKeyHint="next"
        autoComplete={autoComplete}
        autoCapitalize="words"
        autoCorrect="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={value}
        disabled={disabled}
        placeholder={disabled ? disabledHint : placeholder}
        onChange={(e) => onChangeText(e.target.value)}
        onFocus={() => {
          if (options.length && value.trim().length >= minChars) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cn("input", showInvalidHint && "input-invalid")}
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lift">
          {options.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">{noResultsText}</div>
          )}
          {options.map((option, i) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOption(option)}
              className={cn(
                "block w-full px-4 py-2.5 text-start text-sm transition-colors",
                i === highlight ? "bg-secondary" : "hover:bg-secondary",
              )}
            >
              <span className="font-medium">{option.label}</span>
              {option.sublabel && <span className="text-muted-foreground"> — {option.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
      {showInvalidHint && <span className="mt-1.5 block text-xs text-destructive">{invalidHint}</span>}
    </div>
  );
}
