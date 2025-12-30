"use client";

import { useState } from "react";

export default function KeyboardHelper() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 rounded-full bg-gray-900 p-3 text-white shadow-lg hover:bg-gray-800 z-40"
        title="Keyboard shortcuts"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">⌨️ Keyboard Shortcuts</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Navigate down</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">J</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Navigate up</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Shortlist candidate</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Reject candidate</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Mark as new</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">N</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Open profile</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Clear selection</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Esc</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Add note</span>
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">A</kbd>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t text-xs text-gray-500">
              💡 Tip: Use keyboard shortcuts to process candidates 10x faster!
            </div>
          </div>
        </div>
      )}
    </>
  );
}