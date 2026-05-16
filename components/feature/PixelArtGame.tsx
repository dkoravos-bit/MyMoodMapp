/**
 * PixelArt — Stress-relief pixel painting game
 * Extracted to its own file to reduce Hermes JS bundle parse size.
 *
 * Freeform mode: COLS=24 fixed, square cells, ROWS fills screen height.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  PanResponder,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing } from '@/constants/theme';
import type { DarkColors } from '@/constants/theme';
import { playPixelPaint } from '@/services/gameSounds';

// ─── Chrome heights ───────────────────────────────────────────────────────────
const FREE_COLS = 24;
const HEADER_H  = 100;
const TOOLBAR_H = 92;
const CHROME_H  = HEADER_H + TOOLBAR_H + 44; // 44 = stats bar

// ─── PixelArtGame ─────────────────────────────────────────────────────────────
export default function PixelArtGame({ C }: { C: typeof DarkColors }) {
  const [dims, setDims] = useState(() => {
    const d = Dimensions.get('window');
    return { width: Math.max(320, d.width || 320), height: Math.max(568, d.height || 568) };
  });
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window: w }) => {
      setDims({ width: Math.max(320, w.width || 320), height: Math.max(568, w.height || 568) });
    });
    return () => sub?.remove();
  }, []);

  const SW = dims.width;
  const SH = dims.height;

  // Square cells — FREE_COLS columns fill screen width
  const cellSize   = Math.max(1, Math.floor(SW / FREE_COLS));
  const availH     = Math.max(cellSize, SH - CHROME_H);
  const FREE_ROWS  = Math.max(FREE_COLS, Math.floor(availH / cellSize));
  const TOTAL_FREE = FREE_COLS * FREE_ROWS;

  // ── Freeform state ─────────────────────────────────────────────────────────
  const FREE_PALETTE = [
    '#FF6B6B','#FF8E53','#F5A623','#FFD93D','#95E06C','#4ECDC4',
    '#38BDF8','#7C83FF','#A78BFA','#E879F9','#F472B6','#FFFFFF',
    '#94A3B8','#475569','#1E293B','#0A0B1E','#FF0000','#00FF88','#0088FF','#FF00CC',
  ];
  const [freeCells,   setFreeCells]   = useState<(string|null)[]>(() => Array(TOTAL_FREE).fill(null));
  const [activeColor, setActiveColor] = useState(FREE_PALETTE[6]);
  const [erasing,     setErasing]     = useState(false);
  const [freeFilled,  setFreeFilled]  = useState(0);

  const prevTotalRef = useRef(TOTAL_FREE);
  useEffect(() => {
    if (prevTotalRef.current === TOTAL_FREE) return;
    prevTotalRef.current = TOTAL_FREE;
    freeCellsBufRef.current = Array(TOTAL_FREE).fill(null);
    freeFilledRef.current   = 0;
    freeDirtyRef.current    = false;
    setFreeCells(Array(TOTAL_FREE).fill(null));
    setFreeFilled(0);
  }, [TOTAL_FREE]);

  const freeActiveColorRef = useRef(activeColor);
  const freeErasingRef     = useRef(erasing);
  freeActiveColorRef.current = activeColor;
  freeErasingRef.current     = erasing;

  const lastPaintedRef  = useRef(-1);
  const freeCellsBufRef = useRef<(string|null)[]>(Array(TOTAL_FREE).fill(null));
  const freeDirtyRef    = useRef(false);
  const freeFilledRef   = useRef(0);

  // Flush dirty buffer to React state at 60fps
  useEffect(() => {
    const id = setInterval(() => {
      if (!freeDirtyRef.current) return;
      freeDirtyRef.current = false;
      setFreeCells([...freeCellsBufRef.current]);
      setFreeFilled(freeFilledRef.current);
    }, 60);
    return () => clearInterval(id);
  }, []);

  const freeBoardW = cellSize * FREE_COLS;
  const freeBoardH = cellSize * FREE_ROWS;
  const freePct    = Math.round((freeFilled / Math.max(1, TOTAL_FREE)) * 100);

  const freeCanvasRef = useRef<View>(null);
  const freeOrigin    = useRef({ x: 0, y: 0 });

  const freePaint = useCallback((i: number) => {
    if (i < 0 || i >= TOTAL_FREE || i === lastPaintedRef.current) return;
    lastPaintedRef.current = i;
    playPixelPaint();
    const buf      = freeCellsBufRef.current;
    const wasEmpty = buf[i] === null;
    const newVal   = freeErasingRef.current ? null : freeActiveColorRef.current;
    if (buf[i] === newVal) return;
    buf[i] = newVal;
    if (!freeErasingRef.current && wasEmpty) freeFilledRef.current += 1;
    if (freeErasingRef.current && !wasEmpty) freeFilledRef.current = Math.max(0, freeFilledRef.current - 1);
    freeDirtyRef.current = true;
  }, [TOTAL_FREE]);

  const freeHitTest = useCallback((pageX: number, pageY: number) => {
    const col = Math.floor((pageX - freeOrigin.current.x) / cellSize);
    const row = Math.floor((pageY - freeOrigin.current.y) / cellSize);
    if (col >= 0 && col < FREE_COLS && row >= 0 && row < FREE_ROWS) {
      freePaint(row * FREE_COLS + col);
    }
  }, [cellSize, FREE_ROWS, freePaint]);

  const drawPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => true,
    onPanResponderGrant: (e) => {
      lastPaintedRef.current = -1;
      freeCanvasRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
        freeOrigin.current = { x: px, y: py };
      });
      freeHitTest(e.nativeEvent.pageX, e.nativeEvent.pageY);
    },
    onPanResponderMove:      (e) => { freeHitTest(e.nativeEvent.pageX, e.nativeEvent.pageY); },
    onPanResponderRelease:   () => { lastPaintedRef.current = -1; },
    onPanResponderTerminate: () => { lastPaintedRef.current = -1; },
  }), [freeHitTest]);

  const clearFree = () => {
    freeCellsBufRef.current = Array(TOTAL_FREE).fill(null);
    freeFilledRef.current   = 0;
    freeDirtyRef.current    = false;
    setFreeCells(Array(TOTAL_FREE).fill(null));
    setFreeFilled(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#08091A', paddingTop: HEADER_H }}>
      {/* Stats bar */}
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', includeFontPadding: false } as any}>
          {freeFilled} / {TOTAL_FREE} · {FREE_COLS}×{FREE_ROWS} · {freePct}%
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setErasing(!erasing)}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
              borderWidth: 1.5,
              borderColor: erasing ? '#FF6B6B' : 'rgba(255,255,255,0.12)',
              backgroundColor: erasing ? '#FF6B6B20' : 'transparent',
            }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="auto-fix-high" size={12} color={erasing ? '#FF6B6B' : 'rgba(255,255,255,0.4)'} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: erasing ? '#FF6B6B' : 'rgba(255,255,255,0.4)', includeFontPadding: false } as any}>
              {erasing ? 'Erasing' : 'Erase'}
            </Text>
          </Pressable>
          <Pressable
            onPress={clearFree}
            style={({ pressed }) => [{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            }, pressed && { opacity: 0.6 }]}
          >
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', includeFontPadding: false } as any}>Clear</Text>
          </Pressable>
        </View>
      </View>

      {/* Canvas */}
      <View
        ref={freeCanvasRef}
        onLayout={() => {
          freeCanvasRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
            freeOrigin.current = { x: px, y: py };
          });
        }}
        style={{
          width: freeBoardW, height: freeBoardH,
          alignSelf: 'center',
          flexDirection: 'row', flexWrap: 'wrap',
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        }}
        {...drawPan.panHandlers}
      >
        {freeCells.map((color, i) => (
          <View
            key={i}
            style={{
              width: cellSize, height: cellSize,
              backgroundColor: color ?? '#0A0B1E',
              borderRightWidth: 0.5, borderBottomWidth: 0.5,
              borderColor: 'rgba(255,255,255,0.04)',
            }}
          >
            {color ? (
              <View style={{
                position: 'absolute', top: 1, left: 1,
                width: Math.max(2, cellSize * 0.3),
                height: Math.max(2, cellSize * 0.25),
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 1,
              }} />
            ) : null}
          </View>
        ))}
      </View>

      {/* Colour toolbar */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: TOOLBAR_H,
        backgroundColor: 'rgba(8,9,26,0.97)',
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12, paddingTop: 10,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{
            width: 24, height: 24, borderRadius: 5,
            backgroundColor: erasing ? 'transparent' : activeColor,
            borderWidth: 2, borderColor: erasing ? '#FF6B6B' : '#fff',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {erasing ? <MaterialIcons name="auto-fix-high" size={14} color="#FF6B6B" /> : null}
          </View>
          <View style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <View style={{ height: 3, width: `${freePct}%` as any, backgroundColor: erasing ? '#FF6B6B' : activeColor, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', includeFontPadding: false } as any}>{freePct}%</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {FREE_PALETTE.map(col => (
            <Pressable
              key={col}
              onPress={() => { setActiveColor(col); setErasing(false); }}
              style={[{
                width: 32, height: 32, borderRadius: 7,
                backgroundColor: col,
                borderWidth: activeColor === col && !erasing ? 3 : 1,
                borderColor: activeColor === col && !erasing ? '#fff' : 'rgba(255,255,255,0.12)',
              }]}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
