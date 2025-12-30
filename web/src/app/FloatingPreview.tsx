"use client";

import { useEffect, useRef, useState } from "react";
import FocusedCandidateCard from "./FocusedCandidateCard";
import InlineTagEditor from "./InlineTagEditor";

type FloatingPreviewProps = {
  row: any;
  previewData: any;
  isLoading: boolean;
  triggerElement: HTMLElement | null;
  showInlineTagEditor: boolean;
  onCopyPhone: () => void;
  onShortlist: () => void;
  onReject: () => void;
  onReset: () => void;
  onAddNote: () => void;
  onAddTag: () => void;
  onAddTagSubmit: (tag: string) => void;
  onAddTagCancel: () => void;
};

export default function FloatingPreview({
  row,
  previewData,
  isLoading,
  triggerElement,
  showInlineTagEditor,
  onCopyPhone,
  onShortlist,
  onReject,
  onReset,
  onAddNote,
  onAddTag,
  onAddTagSubmit,
  onAddTagCancel,
}: FloatingPreviewProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerElement || !cardRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerElement.getBoundingClientRect();
      const cardRect = cardRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Default: position to the right of the row
      let left = triggerRect.right + 16;
      let top = triggerRect.top;

      // If card would go off right edge, position to the left
      if (left + 400 > viewportWidth) {
        left = triggerRect.left - 400 - 16;
      }

      // If card would go off bottom, adjust up
      if (top + cardRect.height > viewportHeight) {
        top = Math.max(16, viewportHeight - cardRect.height - 16);
      }

      // If card would go off top, adjust down
      if (top < 16) {
        top = 16;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [triggerElement]);

  if (!row) return null;

  return (
    <div
      ref={cardRef}
      className="fixed z-50 w-[400px] animate-fade-in floating-preview-card"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="shadow-2xl rounded-xl border-2 border-blue-400 overflow-hidden">
        <FocusedCandidateCard
          row={row}
          previewData={previewData}
          isLoading={isLoading}
          onCopyPhone={onCopyPhone}
          onShortlist={onShortlist}
          onReject={onReject}
          onReset={onReset}
          onAddNote={onAddNote}
          onAddTag={onAddTag}
        />
        
        {showInlineTagEditor && (
          <div className="bg-white border-t p-4">
            <div className="text-sm font-medium mb-3">Add Tag</div>
            <InlineTagEditor
              onAdd={onAddTagSubmit}
              onCancel={onAddTagCancel}
              placeholder="e.g. spinal, driver, hoist"
            />
          </div>
        )}
      </div>
    </div>
  );
}