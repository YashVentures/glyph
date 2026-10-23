import React, { useState, useRef, useEffect } from 'react';

export default function ResizableSplit({
  viewMode = 'split', // 'doc' | 'split' | 'canvas'
  leftPane,
  rightPane,
  defaultSplitPercent = 45,
  minDocWidth = 300,
  minCanvasWidth = 350
}) {
  const containerRef = useRef(null);
  const [splitPercent, setSplitPercent] = useState(defaultSplitPercent);
  const [isDragging, setIsDragging] = useState(false);

  // Handle divider drag
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const totalWidth = rect.width;

      let newLeftWidth = clientX - rect.left;
      if (newLeftWidth < minDocWidth) newLeftWidth = minDocWidth;
      if (totalWidth - newLeftWidth < minCanvasWidth) newLeftWidth = totalWidth - minCanvasWidth;

      const newPercent = (newLeftWidth / totalWidth) * 100;
      setSplitPercent(Math.max(15, Math.min(85, newPercent)));
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minDocWidth, minCanvasWidth]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Left Pane (Document / Notes) */}
      <div style={{
        display: viewMode === 'canvas' ? 'none' : 'flex',
        flexDirection: 'column',
        width: viewMode === 'doc' ? '100%' : `${splitPercent}%`,
        height: '100%',
        overflow: 'hidden',
        borderRight: viewMode === 'split' ? '1px solid var(--border-subtle)' : 'none',
        flexShrink: 0
      }}>
        {leftPane}
      </div>

      {/* Resizable Divider (Only shown in Split View) */}
      {viewMode === 'split' && (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSplitPercent(50)}
          title="Drag to resize panes (Double click to center)"
          style={{
            width: '8px',
            marginLeft: '-4px',
            marginRight: '-4px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDragging ? 'var(--accent-primary)' : 'transparent',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={e => {
            if (!isDragging) e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.4)';
          }}
          onMouseLeave={e => {
            if (!isDragging) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{
            width: '2px',
            height: '24px',
            borderRadius: '2px',
            backgroundColor: isDragging ? '#FFFFFF' : 'var(--border-strong)'
          }} />
        </div>
      )}

      {/* Right Pane (Canvas) */}
      <div style={{
        display: viewMode === 'doc' ? 'none' : 'flex',
        flexDirection: 'column',
        width: viewMode === 'split' ? `${100 - splitPercent}%` : '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {rightPane}
      </div>
    </div>
  );
}
