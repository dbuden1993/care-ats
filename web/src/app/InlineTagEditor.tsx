"use client";

import { useState, useRef, useEffect } from "react";

export default function InlineTagEditor({
  onAdd,
  onCancel,
  placeholder = "Enter tag...",
}: {
  onAdd: (tag: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tag = value.trim();
    if (tag) {
      onAdd(tag);
      setValue("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-md bg-black px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
      >
        Cancel
      </button>
    </form>
  );
}