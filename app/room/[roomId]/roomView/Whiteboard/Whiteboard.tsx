"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MediaRoom } from "../../../../../media/core/MediaRoom";
import styles from "./Whiteboard.module.css";

const WHITEBOARD_CHANNEL = "classroom-whiteboard";

type Point = { x: number; y: number };

type DrawEvent = {
  type: "draw";
  strokeId: string;
  color: string;
  size: number;
  points: Point[];
  isEnd?: boolean;
};

type EraseEvent = {
  type: "erase";
  strokeId: string;
  size: number;
  points: Point[];
  isEnd?: boolean;
};

type TextEvent = {
  type: "text";
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
};

type TextMoveEvent = {
  type: "text_move";
  id: string;
  x: number;
  y: number;
};

type TextDeleteEvent = {
  type: "text_delete";
  id: string;
};

type ClearEvent = {
  type: "clear";
};

type WhiteboardEvent =
  | DrawEvent
  | EraseEvent
  | TextEvent
  | TextMoveEvent
  | TextDeleteEvent
  | ClearEvent;

type WhiteboardProps = {
  room: MediaRoom;
};

type StrokeState = {
  mode: "draw" | "erase";
  id: string;
  color: string;
  size: number;
  lastPoint: Point;
  pendingPoints: Point[];
  lastSentAt: number;
};

type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
};

type TextEditorState = {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
};

type DragState = {
  id: string;
  offset: Point;
  lastSentAt: number;
};

function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Point).x === "number" &&
    typeof (value as Point).y === "number"
  );
}

function isWhiteboardEvent(value: unknown): value is WhiteboardEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as WhiteboardEvent;
  if (event.type === "clear") {
    return true;
  }
  if (event.type === "text_delete") {
    return typeof (event as TextDeleteEvent).id === "string";
  }
  if (event.type === "text") {
    return (
      typeof (event as TextEvent).id === "string" &&
      typeof (event as TextEvent).text === "string" &&
      typeof (event as TextEvent).color === "string" &&
      typeof (event as TextEvent).size === "number" &&
      isPoint({ x: (event as TextEvent).x, y: (event as TextEvent).y })
    );
  }
  if (event.type === "text_move") {
    return (
      typeof (event as TextMoveEvent).id === "string" &&
      isPoint({ x: (event as TextMoveEvent).x, y: (event as TextMoveEvent).y })
    );
  }
  if (event.type === "erase") {
    return (
      typeof (event as EraseEvent).strokeId === "string" &&
      typeof (event as EraseEvent).size === "number" &&
      Array.isArray((event as EraseEvent).points) &&
      (event as EraseEvent).points.every(isPoint)
    );
  }
  if (event.type === "draw") {
    return (
      typeof (event as DrawEvent).strokeId === "string" &&
      typeof (event as DrawEvent).color === "string" &&
      typeof (event as DrawEvent).size === "number" &&
      Array.isArray((event as DrawEvent).points) &&
      (event as DrawEvent).points.every(isPoint)
    );
  }
  return false;
}

export default function Whiteboard({ room }: WhiteboardProps) {
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const strokeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const eventsRef = useRef<WhiteboardEvent[]>([]);
  const remoteLastPointRef = useRef<Record<string, Point>>({});
  const strokeRef = useRef<StrokeState | null>(null);
  const textItemsRef = useRef<TextItem[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const redrawPendingRef = useRef(false);
  const pendingTextPointRef = useRef<Point | null>(null);
  const isPlacingTextRef = useRef(false);
  const [tool, setTool] = useState<"draw" | "text" | "erase">("draw");
  const [color, setColor] = useState("#f8fafc");
  const [size, setSize] = useState(4);
  const [editor, setEditor] = useState<TextEditorState | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const editorInputRef = useRef<HTMLInputElement | null>(null);
  const palette = useMemo(
    () => ["#f8fafc", "#ef4444", "#38bdf8", "#f97316", "#facc15", "#22c55e"],
    []
  );

  const getCanvasMetrics = useCallback(() => {
    if (!strokeCanvasRef.current || !textCanvasRef.current) {
      return null;
    }
    return canvasSizeRef.current;
  }, []);

  const toCanvasPoint = useCallback((point: Point) => {
    const metrics = getCanvasMetrics();
    if (!metrics) {
      return point;
    }
    return {
      x: point.x * metrics.width,
      y: point.y * metrics.height,
    };
  }, [getCanvasMetrics]);

  const applyStrokeSegment = useCallback(
    (event: DrawEvent | EraseEvent, lastPoint?: Point) => {
      const ctx = strokeCtxRef.current;
      if (!ctx || !event.points.length) {
        return;
      }
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (event.type === "erase") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        ctx.lineWidth = event.size * 2;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = event.color;
        ctx.lineWidth = event.size;
      }
      ctx.beginPath();
      const first = toCanvasPoint(event.points[0]);
      if (lastPoint) {
        const start = toCanvasPoint(lastPoint);
        ctx.moveTo(start.x, start.y);
      } else {
        ctx.moveTo(first.x, first.y);
      }
      event.points.forEach((point) => {
        const next = toCanvasPoint(point);
        ctx.lineTo(next.x, next.y);
      });
      ctx.stroke();
      ctx.restore();
    },
    [toCanvasPoint]
  );

  const drawText = useCallback(
    (event: Pick<TextItem, "x" | "y" | "text" | "color" | "size">) => {
      const ctx = textCtxRef.current;
      if (!ctx) {
        return;
      }
      const point = toCanvasPoint({ x: event.x, y: event.y });
      ctx.fillStyle = event.color;
      ctx.font = `${event.size}px "Segoe UI", sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(event.text, point.x, point.y);
    },
    [toCanvasPoint]
  );

  const clearStrokesCanvas = useCallback(() => {
    const canvas = strokeCanvasRef.current;
    const ctx = strokeCtxRef.current;
    if (!canvas || !ctx) {
      return;
    }
    const size = canvasSizeRef.current;
    ctx.clearRect(0, 0, size.width, size.height);
  }, []);

  const clearTextCanvas = useCallback(() => {
    const canvas = textCanvasRef.current;
    const ctx = textCtxRef.current;
    if (!canvas || !ctx) {
      return;
    }
    const size = canvasSizeRef.current;
    ctx.clearRect(0, 0, size.width, size.height);
  }, []);

  const redrawAll = useCallback(() => {
    clearStrokesCanvas();
    const lastPoints: Record<string, Point> = {};
    eventsRef.current.forEach((event) => {
      if (event.type === "clear") {
        Object.keys(lastPoints).forEach((key) => delete lastPoints[key]);
        clearStrokesCanvas();
        return;
      }
      if (event.type === "draw" || event.type === "erase") {
        const lastPoint = lastPoints[event.strokeId];
        applyStrokeSegment(event, lastPoint);
        const finalPoint = event.points[event.points.length - 1];
        if (finalPoint) {
          lastPoints[event.strokeId] = finalPoint;
        }
        if (event.isEnd) {
          delete lastPoints[event.strokeId];
        }
      }
    });
    clearTextCanvas();
    textItemsRef.current.forEach((item) => {
      drawText(item);
    });
  }, [applyStrokeSegment, clearStrokesCanvas, clearTextCanvas, drawText]);

  const scheduleRedraw = useCallback(() => {
    if (redrawPendingRef.current) {
      return;
    }
    redrawPendingRef.current = true;
    requestAnimationFrame(() => {
      redrawPendingRef.current = false;
      redrawAll();
    });
  }, [redrawAll]);

  const upsertTextItem = useCallback((item: TextItem) => {
    const items = textItemsRef.current;
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
      items.push(item);
    } else {
      items[index] = item;
    }
  }, []);

  const applyTextMove = useCallback((move: TextMoveEvent) => {
    const items = textItemsRef.current;
    const index = items.findIndex((entry) => entry.id === move.id);
    if (index === -1) {
      return;
    }
    items[index] = { ...items[index], x: move.x, y: move.y };
  }, []);

  const handleRemoteEvent = useCallback(
    (payload: unknown) => {
      if (!isWhiteboardEvent(payload)) {
        return;
      }
      if (payload.type === "clear") {
        eventsRef.current = [];
        remoteLastPointRef.current = {};
        textItemsRef.current = [];
        redrawAll();
        return;
      }
      eventsRef.current.push(payload);
      if (payload.type === "text") {
        upsertTextItem(payload);
        scheduleRedraw();
        return;
      }
      if (payload.type === "text_move") {
        applyTextMove(payload);
        scheduleRedraw();
        return;
      }
      if (payload.type === "text_delete") {
        textItemsRef.current = textItemsRef.current.filter(
          (item) => item.id !== payload.id
        );
        scheduleRedraw();
        return;
      }
      if (payload.type === "erase") {
        const lastPoint = remoteLastPointRef.current[payload.strokeId];
        applyStrokeSegment(payload, lastPoint);
        const finalPoint = payload.points[payload.points.length - 1];
        if (finalPoint) {
          remoteLastPointRef.current[payload.strokeId] = finalPoint;
        }
        if (payload.isEnd) {
          delete remoteLastPointRef.current[payload.strokeId];
        }
        return;
      }
      const lastPoint = remoteLastPointRef.current[payload.strokeId];
      applyStrokeSegment(payload, lastPoint);
      const finalPoint = payload.points[payload.points.length - 1];
      if (finalPoint) {
        remoteLastPointRef.current[payload.strokeId] = finalPoint;
      }
      if (payload.isEnd) {
        delete remoteLastPointRef.current[payload.strokeId];
      }
    },
    [applyStrokeSegment, redrawAll, scheduleRedraw, upsertTextItem]
  );

  useEffect(() => {
    if (!room) {
      return;
    }
    return room.onData(WHITEBOARD_CHANNEL, handleRemoteEvent);
  }, [handleRemoteEvent, room]);

  useEffect(() => {
    const strokeCanvas = strokeCanvasRef.current;
    const textCanvas = textCanvasRef.current;
    const container = containerRef.current;
    if (!strokeCanvas || !textCanvas || !container) {
      return;
    }
    const strokeContext = strokeCanvas.getContext("2d");
    const textContext = textCanvas.getContext("2d");
    if (!strokeContext || !textContext) {
      return;
    }
    strokeCtxRef.current = strokeContext;
    textCtxRef.current = textContext;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvasSizeRef.current = { width: rect.width, height: rect.height };
      strokeCanvas.width = Math.max(1, rect.width * ratio);
      strokeCanvas.height = Math.max(1, rect.height * ratio);
      strokeCanvas.style.width = `${rect.width}px`;
      strokeCanvas.style.height = `${rect.height}px`;
      textCanvas.width = Math.max(1, rect.width * ratio);
      textCanvas.height = Math.max(1, rect.height * ratio);
      textCanvas.style.width = `${rect.width}px`;
      textCanvas.style.height = `${rect.height}px`;
      strokeContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      textContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      redrawAll();
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [redrawAll]);

  const sendEvent = useCallback(
    (event: WhiteboardEvent) => {
      room.sendData(WHITEBOARD_CHANNEL, event);
    },
    [room]
  );

  const toNormalizedPoint = useCallback(
    (event: PointerEvent) => {
      const canvas = strokeCanvasRef.current;
      if (!canvas) {
        return { x: 0, y: 0 };
      }
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      return { x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) };
    },
    []
  );

  const toCanvasPosition = useCallback(
    (point: Point) => toCanvasPoint(point),
    [toCanvasPoint]
  );

  const hitTestText = useCallback(
    (point: Point) => {
      const ctx = textCtxRef.current;
      if (!ctx) {
        return null;
      }
      const canvasPoint = toCanvasPosition(point);
      const items = textItemsRef.current;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        ctx.font = `${item.size}px "Segoe UI", sans-serif`;
        const textWidth = ctx.measureText(item.text).width;
        const textHeight = item.size * 1.15;
        const topLeft = toCanvasPosition({ x: item.x, y: item.y });
        if (
          canvasPoint.x >= topLeft.x &&
          canvasPoint.x <= topLeft.x + textWidth &&
          canvasPoint.y >= topLeft.y &&
          canvasPoint.y <= topLeft.y + textHeight
        ) {
          return item;
        }
      }
      return null;
    },
    [toCanvasPosition]
  );

  const flushStroke = useCallback(
    (final: boolean) => {
      const stroke = strokeRef.current;
      if (!stroke || !stroke.pendingPoints.length) {
        return;
      }
      const points = stroke.pendingPoints.splice(0);
      const event =
        stroke.mode === "erase"
          ? ({
              type: "erase",
              strokeId: stroke.id,
              size: stroke.size,
              points,
              isEnd: final ? true : undefined,
            } satisfies EraseEvent)
          : ({
              type: "draw",
              strokeId: stroke.id,
              color: stroke.color,
              size: stroke.size,
              points,
              isEnd: final ? true : undefined,
            } satisfies DrawEvent);
      eventsRef.current.push(event);
      sendEvent(event);
      stroke.lastSentAt = performance.now();
    },
    [sendEvent]
  );

  const commitText = useCallback(() => {
    if (!editor) {
      return;
    }
    const text = editorValue.trim();
    if (!text) {
      const deleteEvent: TextDeleteEvent = { type: "text_delete", id: editor.id };
      textItemsRef.current = textItemsRef.current.filter(
        (item) => item.id !== editor.id
      );
      eventsRef.current.push(deleteEvent);
      sendEvent(deleteEvent);
      scheduleRedraw();
      setEditor(null);
      setEditorValue("");
      return;
    }
    const textEvent: TextEvent = {
      type: "text",
      id: editor.id,
      x: editor.x,
      y: editor.y,
      text,
      color: editor.color,
      size: editor.size,
    };
    eventsRef.current.push(textEvent);
    upsertTextItem(textEvent);
    scheduleRedraw();
    sendEvent(textEvent);
    setEditor(null);
    setEditorValue("");
  }, [editor, editorValue, scheduleRedraw, sendEvent, upsertTextItem]);

  const openTextEditor = useCallback(
    (point: Point) => {
      const editorSize = Math.max(14, size * 3);
      const editorId = crypto.randomUUID();
      setEditor({
        id: editorId,
        x: point.x,
        y: point.y,
        color,
        size: editorSize,
      });
      setEditorValue("");
    },
    [color, size]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      const canvas = strokeCanvasRef.current;
      if (!canvas) {
        return;
      }
      const normalized = toNormalizedPoint(event.nativeEvent);
      if (tool === "text") {
        if (editor) {
          return;
        }
        const target = hitTestText(normalized);
        if (target) {
          canvas.setPointerCapture(event.pointerId);
          dragRef.current = {
            id: target.id,
            offset: { x: normalized.x - target.x, y: normalized.y - target.y },
            lastSentAt: performance.now(),
          };
          return;
        }
        isPlacingTextRef.current = true;
        pendingTextPointRef.current = normalized;
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      const strokeId = crypto.randomUUID();
      const mode = tool === "erase" ? "erase" : "draw";
      strokeRef.current = {
        mode,
        id: strokeId,
        color,
        size,
        lastPoint: normalized,
        pendingPoints: [],
        lastSentAt: performance.now(),
      };
      if (mode === "erase") {
        const eraseEvent: EraseEvent = {
          type: "erase",
          strokeId,
          size,
          points: [normalized],
        };
        eventsRef.current.push(eraseEvent);
        applyStrokeSegment(eraseEvent);
        sendEvent(eraseEvent);
      } else {
        const drawEvent: DrawEvent = {
          type: "draw",
          strokeId,
          color,
          size,
          points: [normalized],
        };
        eventsRef.current.push(drawEvent);
        applyStrokeSegment(drawEvent);
        sendEvent(drawEvent);
      }
    },
    [
      applyStrokeSegment,
      color,
      editor,
      hitTestText,
      sendEvent,
      size,
      tool,
      toNormalizedPoint,
    ]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPlacingTextRef.current) {
        pendingTextPointRef.current = toNormalizedPoint(event.nativeEvent);
        return;
      }
      const drag = dragRef.current;
      if (drag) {
        const next = toNormalizedPoint(event.nativeEvent);
        const nextPos = {
          x: Math.min(Math.max(next.x - drag.offset.x, 0), 1),
          y: Math.min(Math.max(next.y - drag.offset.y, 0), 1),
        };
        const items = textItemsRef.current;
        const index = items.findIndex((entry) => entry.id === drag.id);
        if (index !== -1) {
          items[index] = { ...items[index], x: nextPos.x, y: nextPos.y };
          scheduleRedraw();
          const now = performance.now();
          if (now - drag.lastSentAt > 60) {
            const moveEvent: TextMoveEvent = {
              type: "text_move",
              id: drag.id,
              x: nextPos.x,
              y: nextPos.y,
            };
            eventsRef.current.push(moveEvent);
            sendEvent(moveEvent);
            drag.lastSentAt = now;
          }
        }
        return;
      }
      const stroke = strokeRef.current;
      if (!stroke) {
        return;
      }
      const next = toNormalizedPoint(event.nativeEvent);
      const segment =
        stroke.mode === "erase"
          ? ({
              type: "erase",
              strokeId: stroke.id,
              size: stroke.size,
              points: [next],
            } satisfies EraseEvent)
          : ({
              type: "draw",
              strokeId: stroke.id,
              color: stroke.color,
              size: stroke.size,
              points: [next],
            } satisfies DrawEvent);
      applyStrokeSegment(segment, stroke.lastPoint);
      stroke.lastPoint = next;
      stroke.pendingPoints.push(next);
      const now = performance.now();
      if (stroke.pendingPoints.length >= 6 || now - stroke.lastSentAt > 48) {
        flushStroke(false);
      }
    },
    [applyStrokeSegment, flushStroke, scheduleRedraw, sendEvent, toNormalizedPoint]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPlacingTextRef.current) {
        const point = pendingTextPointRef.current;
        isPlacingTextRef.current = false;
        pendingTextPointRef.current = null;
        if (point) {
          openTextEditor(point);
        }
        return;
      }
      const drag = dragRef.current;
      if (drag) {
        const next = toNormalizedPoint(event.nativeEvent);
        const nextPos = {
          x: Math.min(Math.max(next.x - drag.offset.x, 0), 1),
          y: Math.min(Math.max(next.y - drag.offset.y, 0), 1),
        };
        const moveEvent: TextMoveEvent = {
          type: "text_move",
          id: drag.id,
          x: nextPos.x,
          y: nextPos.y,
        };
        eventsRef.current.push(moveEvent);
        sendEvent(moveEvent);
        const canvas = strokeCanvasRef.current;
        if (canvas) {
          canvas.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
        return;
      }
      const stroke = strokeRef.current;
      if (!stroke) {
        return;
      }
      const canvas = strokeCanvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (stroke.pendingPoints.length) {
        flushStroke(true);
      } else {
        const endEvent =
          stroke.mode === "erase"
            ? ({
                type: "erase",
                strokeId: stroke.id,
                size: stroke.size,
                points: [],
                isEnd: true,
              } satisfies EraseEvent)
            : ({
                type: "draw",
                strokeId: stroke.id,
                color: stroke.color,
                size: stroke.size,
                points: [],
                isEnd: true,
              } satisfies DrawEvent);
        eventsRef.current.push(endEvent);
        sendEvent(endEvent);
      }
      strokeRef.current = null;
    },
    [flushStroke, openTextEditor, sendEvent, toNormalizedPoint]
  );

  const handleClear = useCallback(() => {
    const clearEvent: ClearEvent = { type: "clear" };
    eventsRef.current = [];
    remoteLastPointRef.current = {};
    textItemsRef.current = [];
    redrawAll();
    sendEvent(clearEvent);
  }, [redrawAll, sendEvent]);

  const handleCanvasDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (tool !== "text") {
        return;
      }
      const normalized = toNormalizedPoint(event.nativeEvent);
      const target = hitTestText(normalized);
      if (!target) {
        return;
      }
      setEditor({
        id: target.id,
        x: target.x,
        y: target.y,
        color: target.color,
        size: target.size,
      });
      setEditorValue(target.text);
    },
    [hitTestText, tool, toNormalizedPoint]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    editorInputRef.current?.focus();
  }, [editor]);

  return (
    <section className={styles.whiteboard}>
      <header className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button
            className={`${styles.toolButton} ${
              tool === "draw" ? styles.active : ""
            }`}
            onClick={() => setTool("draw")}
            type="button"
          >
            Draw
          </button>
          <button
            className={`${styles.toolButton} ${
              tool === "erase" ? styles.active : ""
            }`}
            onClick={() => setTool("erase")}
            type="button"
          >
            Erase
          </button>
          <button
            className={`${styles.toolButton} ${
              tool === "text" ? styles.active : ""
            }`}
            onClick={() => setTool("text")}
            type="button"
          >
            Text
          </button>
        </div>
        <div className={styles.toolGroup}>
          <label className={styles.sizeControl}>
            <span>Size</span>
            <input
              type="range"
              min="2"
              max="12"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
          <div className={styles.palette}>
            {palette.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`${styles.swatch} ${
                  swatch === color ? styles.active : ""
                }`}
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
        </div>
        <button className={styles.clearButton} onClick={handleClear} type="button">
          Clear
        </button>
      </header>
      <div className={styles.canvasShell} ref={containerRef}>
        <canvas
          ref={strokeCanvasRef}
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleCanvasDoubleClick}
        />
        <canvas ref={textCanvasRef} className={styles.textCanvas} />
        {editor ? (
          <input
            ref={editorInputRef}
            className={styles.textEditor}
            autoFocus
            style={{
              left: `${editor.x * canvasSizeRef.current.width}px`,
              top: `${editor.y * canvasSizeRef.current.height}px`,
              color: editor.color,
              fontSize: `${editor.size}px`,
            }}
            value={editorValue}
            placeholder="Type and press Enter"
            onChange={(event) => setEditorValue(event.target.value)}
            onBlur={commitText}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitText();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setEditor(null);
                setEditorValue("");
              }
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
