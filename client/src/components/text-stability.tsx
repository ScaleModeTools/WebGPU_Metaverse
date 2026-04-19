import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes
} from "react";

import {
  clearCache,
  layoutWithLines,
  prepareWithSegments,
  type PrepareOptions
} from "@chenglou/pretext";

import { cn } from "@/lib/class-name";

interface PretextParagraphProps
  extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  readonly text: string;
  readonly whiteSpace?: PrepareOptions["whiteSpace"];
  readonly wordBreak?: PrepareOptions["wordBreak"];
}

interface StableInlineTextProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  readonly reserveTexts?: readonly string[];
  readonly stabilizeNumbers?: boolean;
  readonly text: string;
}

interface TypographySnapshot {
  readonly font: string;
  readonly lineHeightPx: number;
  readonly widthPx: number;
}

let pretextFontRevision = 0;
let releaseFontTracking: (() => void) | null = null;
const pretextFontRevisionSubscribers = new Set<() => void>();

function notifyPretextFontRevision(): void {
  clearCache();
  pretextFontRevision += 1;

  for (const notifySubscriber of pretextFontRevisionSubscribers) {
    notifySubscriber();
  }
}

function ensurePretextFontTracking(): void {
  if (releaseFontTracking !== null || typeof document === "undefined") {
    return;
  }

  const fontSet = document.fonts;

  if (fontSet === undefined) {
    return;
  }

  const handleFontUpdate = () => {
    notifyPretextFontRevision();
  };

  void fontSet.ready.then(() => {
    handleFontUpdate();
  });

  fontSet.addEventListener("loadingdone", handleFontUpdate);
  fontSet.addEventListener("loadingerror", handleFontUpdate);

  releaseFontTracking = () => {
    fontSet.removeEventListener("loadingdone", handleFontUpdate);
    fontSet.removeEventListener("loadingerror", handleFontUpdate);
    releaseFontTracking = null;
  };
}

function subscribeToPretextFontRevision(notifySubscriber: () => void): () => void {
  ensurePretextFontTracking();
  pretextFontRevisionSubscribers.add(notifySubscriber);

  return () => {
    pretextFontRevisionSubscribers.delete(notifySubscriber);

    if (
      pretextFontRevisionSubscribers.size === 0 &&
      releaseFontTracking !== null
    ) {
      releaseFontTracking();
    }
  };
}

function readPretextFontRevision(): number {
  return pretextFontRevision;
}

function usePretextFontRevision(): number {
  return useSyncExternalStore(
    subscribeToPretextFontRevision,
    readPretextFontRevision,
    () => 0
  );
}

function roundPixels(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function buildCanvasFont(computedStyle: CSSStyleDeclaration): string {
  return [
    computedStyle.fontStyle,
    computedStyle.fontVariant,
    computedStyle.fontWeight,
    computedStyle.fontStretch,
    computedStyle.fontSize,
    computedStyle.fontFamily
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
}

function readContentWidth(
  paragraphElement: HTMLParagraphElement,
  computedStyle: CSSStyleDeclaration
): number {
  return roundPixels(
    paragraphElement.clientWidth -
      Number.parseFloat(computedStyle.paddingLeft) -
      Number.parseFloat(computedStyle.paddingRight)
  );
}

function readLineHeight(computedStyle: CSSStyleDeclaration): number {
  if (computedStyle.lineHeight !== "normal") {
    return roundPixels(Number.parseFloat(computedStyle.lineHeight));
  }

  return roundPixels(Number.parseFloat(computedStyle.fontSize) * 1.2);
}

function readTypographySnapshot(
  paragraphElement: HTMLParagraphElement,
  widthPx?: number
): TypographySnapshot | null {
  const computedStyle = globalThis.getComputedStyle(paragraphElement);
  const nextWidthPx = roundPixels(
    widthPx ?? readContentWidth(paragraphElement, computedStyle)
  );
  const lineHeightPx = readLineHeight(computedStyle);
  const font = buildCanvasFont(computedStyle);

  if (nextWidthPx <= 0 || lineHeightPx <= 0 || font.length === 0) {
    return null;
  }

  return {
    font,
    lineHeightPx,
    widthPx: nextWidthPx
  };
}

function typographySnapshotsMatch(
  left: TypographySnapshot | null,
  right: TypographySnapshot | null
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return (
    left.font === right.font &&
    left.lineHeightPx === right.lineHeightPx &&
    left.widthPx === right.widthPx
  );
}

function createPrepareOptions(
  whiteSpace: PrepareOptions["whiteSpace"],
  wordBreak: PrepareOptions["wordBreak"]
): PrepareOptions {
  return {
    ...(whiteSpace === undefined ? {} : { whiteSpace }),
    ...(wordBreak === undefined ? {} : { wordBreak })
  };
}

function createStableTextValues(
  reserveTexts: readonly string[] | undefined,
  stabilizeNumbers: boolean,
  text: string
): readonly string[] {
  const rawValues = reserveTexts === undefined ? [text] : [...reserveTexts, text];
  const expandedValues = stabilizeNumbers
    ? rawValues.flatMap((value) => [value, value.replaceAll(/\d/g, "8")])
    : rawValues;

  return expandedValues.filter(
    (value, index) => expandedValues.indexOf(value) === index
  );
}

export function createStableCountReserveTexts(
  singularLabel: string,
  pluralLabel: string,
  maxDigits: number = 3
): readonly string[] {
  const reserveTexts = [`0 ${pluralLabel}`];

  for (let digitCount = 1; digitCount <= maxDigits; digitCount += 1) {
    const digits = "8".repeat(digitCount);

    reserveTexts.push(`${digits} ${singularLabel}`);
    reserveTexts.push(`${digits} ${pluralLabel}`);
  }

  return Object.freeze(
    reserveTexts.filter(
      (value, index) => reserveTexts.indexOf(value) === index
    )
  );
}

const preWrapLineStyle: CSSProperties = {
  display: "block",
  whiteSpace: "pre-wrap"
};

const wrappedLineStyle: CSSProperties = {
  display: "block"
};

export function PretextParagraph({
  className,
  style,
  text,
  whiteSpace = "normal",
  wordBreak = "normal",
  ...props
}: PretextParagraphProps) {
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const [typographySnapshot, setTypographySnapshot] =
    useState<TypographySnapshot | null>(null);
  const pretextFontRevision = usePretextFontRevision();

  useLayoutEffect(() => {
    const paragraphElement = paragraphRef.current;

    if (paragraphElement === null) {
      return;
    }

    const syncTypographySnapshot = (widthPx?: number) => {
      const nextSnapshot = readTypographySnapshot(paragraphElement, widthPx);

      setTypographySnapshot((currentSnapshot) =>
        typographySnapshotsMatch(currentSnapshot, nextSnapshot)
          ? currentSnapshot
          : nextSnapshot
      );
    };

    syncTypographySnapshot();

    if (typeof globalThis.ResizeObserver !== "function") {
      return;
    }

    const resizeObserver = new globalThis.ResizeObserver((entries) => {
      const [entry] = entries;
      syncTypographySnapshot(entry?.contentRect.width);
    });

    resizeObserver.observe(paragraphElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [className, pretextFontRevision, style]);

  const preparedText = useMemo(() => {
    if (typographySnapshot === null || text.length === 0) {
      return null;
    }

    return prepareWithSegments(
      text,
      typographySnapshot.font,
      createPrepareOptions(whiteSpace, wordBreak)
    );
  }, [
    pretextFontRevision,
    text,
    typographySnapshot?.font,
    whiteSpace,
    wordBreak
  ]);

  const textLayout = useMemo(() => {
    if (preparedText === null || typographySnapshot === null) {
      return null;
    }

    return layoutWithLines(
      preparedText,
      typographySnapshot.widthPx,
      typographySnapshot.lineHeightPx
    );
  }, [
    preparedText,
    typographySnapshot?.lineHeightPx,
    typographySnapshot?.widthPx
  ]);

  return (
    <p
      {...props}
      className={cn(className)}
      ref={paragraphRef}
      style={style}
    >
      {textLayout === null
        ? text
        : textLayout.lines.map((line, lineIndex) => (
            <span
              key={`${line.start.segmentIndex}:${line.start.graphemeIndex}:${lineIndex}`}
              style={whiteSpace === "pre-wrap" ? preWrapLineStyle : wrappedLineStyle}
            >
              {line.text.length === 0 ? "\u00a0" : line.text}
            </span>
          ))}
    </p>
  );
}

export function StableInlineText({
  className,
  reserveTexts,
  stabilizeNumbers = true,
  text,
  ...props
}: StableInlineTextProps) {
  const stableTextValues = useMemo(
    () => createStableTextValues(reserveTexts, stabilizeNumbers, text),
    [reserveTexts, stabilizeNumbers, text]
  );

  return (
    <span
      {...props}
      className={cn(
        "inline-grid items-center justify-items-center whitespace-nowrap text-center tabular-nums",
        className
      )}
    >
      {stableTextValues.map((stableTextValue) => (
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
          key={stableTextValue}
        >
          {stableTextValue}
        </span>
      ))}
      <span className="col-start-1 row-start-1 whitespace-nowrap">
        {text}
      </span>
    </span>
  );
}
