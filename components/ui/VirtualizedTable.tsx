import React, { useState, useEffect, useRef } from 'react';

interface VirtualizedTableProps {
  columns: Array<{
    key: string;
    header: string;
    width: number;
    cellRenderer?: (value: any, item: any) => React.ReactNode;
  }>;
  data: any[];
  rowHeight?: number;
  height?: number;
  onRowClick?: (item: any, index: number) => void;
  overscan?: number; // Number of rows to render above/below visible area
}

const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  columns,
  data,
  rowHeight = 50,
  height = 400,
  onRowClick,
  overscan = 5
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    data.length - 1,
    Math.floor((scrollTop + height) / rowHeight) + overscan
  );

  // Calculate offsets for empty space above and below visible rows
  const topOffset = startIndex * rowHeight;
  const bottomOffset = (data.length - endIndex - 1) * rowHeight;

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Cleanup event listeners on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollEvent = (e: Event) => {
      setScrollTop((e.target as HTMLDivElement).scrollTop);
    };

    container.addEventListener('scroll', handleScrollEvent);
    return () => container.removeEventListener('scroll', handleScrollEvent);
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center border-b-2 bg-gray-100 font-bold p-2"
        style={{ minHeight: '40px' }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            style={{ width: `${column.width}px` }}
            className="px-2 py-1 truncate"
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Container for virtualized content */}
      <div
        ref={containerRef}
        className="overflow-auto relative"
        style={{ height: `${height}px` }}
        onScroll={handleScroll}
      >
        {/* Top spacer */}
        {topOffset > 0 && (
          <div style={{ height: `${topOffset}px` }} aria-hidden="true" />
        )}

        {/* Visible rows */}
        {data.slice(startIndex, endIndex + 1).map((item, index) => {
          const actualIndex = startIndex + index;
          return (
            <div
              key={actualIndex}
              className={`flex items-center border-b ${
                actualIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              } hover:bg-gray-100 transition-colors cursor-${
                onRowClick ? 'pointer' : 'default'
              }`}
              style={{ height: `${rowHeight}px` }}
              onClick={() => onRowClick && onRowClick(item, actualIndex)}
            >
              {columns.map((column) => {
                const value = item[column.key];
                const cellContent = column.cellRenderer
                  ? column.cellRenderer(value, item)
                  : value;

                return (
                  <div
                    key={column.key}
                    style={{ width: `${column.width}px` }}
                    className="px-2 truncate"
                  >
                    {cellContent}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Bottom spacer */}
        {bottomOffset > 0 && (
          <div style={{ height: `${bottomOffset}px` }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
};

export default VirtualizedTable;