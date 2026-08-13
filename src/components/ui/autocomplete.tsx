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
}

export function Autocomplete<T>({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  renderSuggestion,
  getSuggestionValue,
  placeholder = "",
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  minChars = 2,
  debounceMs = 200,
  onKeyDown,
  onFocus,
}: AutocompleteProps<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < minChars) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await fetchSuggestions(value);
        setSuggestions(data || []);
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(delayDebounceFn);
  }, [value, minChars, debounceMs, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          setShowSuggestions(true);
          if (onFocus) onFocus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            setShowSuggestions(false);
          }
          if (onKeyDown) onKeyDown(e);
        }}
        placeholder={placeholder}
        className={inputClassName}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#e2e8f0] shadow-xl rounded-xl py-1 z-50 max-h-48 overflow-y-auto ${dropdownClassName}`}>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                const val = getSuggestionValue(item);
                onSelect(item);
                setShowSuggestions(false);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-700 flex items-center justify-between border-b border-slate-50 last:border-0 cursor-pointer"
            >
              {renderSuggestion(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
