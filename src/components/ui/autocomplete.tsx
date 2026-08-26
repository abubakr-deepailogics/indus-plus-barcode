"use client";

import React, { useState, useEffect, useRef } from "react";

interface AutocompleteProps<T> {
  value: string;
  onChange: (val: string) => void;
  onSelect: (item: T) => void;
  fetchSuggestions: (query: string) => Promise<T[]>;
  renderSuggestion: (item: T) => React.ReactNode;
  getSuggestionValue: (item: T) => string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  minChars?: number;
  debounceMs?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  disabled?: boolean;
}

export function Autocomplete<T>({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  renderSuggestion,
  placeholder = "",
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  minChars = 1,
  debounceMs = 200,
  onKeyDown,
  onFocus,
  disabled,
}: AutocompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Read via a ref instead of a dependency: callers often pass a new
  // fetchSuggestions closure on every render (e.g. one bound to other form
  // state). Depending on it directly would refetch every Autocomplete on the
  // page whenever any of that state changes, not just when this field's own
  // value does.
  const fetchSuggestionsRef = useRef(fetchSuggestions);
  useEffect(() => {
    fetchSuggestionsRef.current = fetchSuggestions;
  });

  useEffect(() => {
    if (disabled || value.trim().length < minChars) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    setIsLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await fetchSuggestionsRef.current(value);
        setSuggestions(data || []);
        setActiveIndex(-1);
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(delayDebounceFn);
  }, [value, minChars, debounceMs, disabled]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const activeElement = dropdownRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          const item = suggestions[activeIndex];
          onSelect(item);
          setShowSuggestions(false);
          setActiveIndex(-1);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        setActiveIndex(-1);
        return;
      }
    }

    if (e.key === "Enter" || e.key === "Tab") {
      setShowSuggestions(false);
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (disabled) return;
          setShowSuggestions(true);
          if (onFocus) onFocus();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={dropdownRef}
          className={`absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#e2e8f0] shadow-xl rounded-xl py-1 z-50 max-h-48 overflow-y-auto ${dropdownClassName}`}
        >
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelect(item);
                setShowSuggestions(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 flex items-center justify-between border-b border-slate-50 last:border-0 cursor-pointer ${
                idx === activeIndex ? "bg-indigo-50 text-indigo-700" : ""
              }`}
            >
              {renderSuggestion(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
